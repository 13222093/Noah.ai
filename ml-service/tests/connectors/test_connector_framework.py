"""Framework tests (B-035): backoff, isolation, conditional GET, idempotent
re-poll, flagging, stale detection, scheduler and the dry-run CLI."""

from datetime import datetime, timedelta, timezone

import pytest

from noah.connectors import __main__ as cli
from noah.connectors.base import (
    Connector,
    FetchError,
    ParseResult,
    backoff_delay_s,
    combine_flags,
    safe_error,
    user_agent,
)
from noah.connectors.memory import MemorySink
from noah.connectors.s1_posko_banjir import PoskoBanjirConnector
from noah.connectors.scheduler import Scheduler
from noah.records import Observation, QualityFlag, RunStatus

from connector_helpers import S1_FETCHED_AT, Clock, FakeFetcher, fixture_bytes, response

UTC = timezone.utc


class Dummy(Connector):
    id = "dummy"
    url = "https://dummy.example/data"
    min_interval_s = 60

    def __init__(self, values=None, explode=False, **kw):
        super().__init__(**kw)
        self.values = values or {}
        self.explode = explode

    def parse(self, content, *, fetched_at, raw_ref):
        if self.explode:
            raise RuntimeError("parser bug at https://secret.example/?token=abc")
        ts = datetime.fromisoformat(content.decode())
        obs = [
            Observation("dummy", sid, ts, v, "cm", combine_flags(QualityFlag.SUSPECT if v > 100 else QualityFlag.OK), raw_ref)
            for sid, v in self.values.items()
        ]
        return ParseResult(observations=obs, newest_ts=ts)


def _resp(ts="2026-11-02T13:40:00+00:00", **kw):
    return response(ts.encode(), content_type="text/plain", **kw)


# --- backoff ------------------------------------------------------------------


def test_backoff_schedule_is_deterministic_bounded_and_never_below_cadence():
    seq = [backoff_delay_s(300, n, key="s1_posko_banjir") for n in range(0, 8)]
    assert seq[0] == 300
    assert seq == [backoff_delay_s(300, n, key="s1_posko_banjir") for n in range(0, 8)]  # no randomness
    for n in (1, 2, 3):
        base = 300 * 2**n
        assert base <= seq[n] < base * 1.25
    assert all(300 <= d <= 3600 for d in seq)
    assert seq[-1] == 3600  # capped
    assert all(b >= a for a, b in zip(seq, seq[1:]))


def test_backoff_jitter_differs_between_connectors():
    assert backoff_delay_s(300, 2, key="a") != backoff_delay_s(300, 2, key="b")


def test_backoff_respects_retry_after_and_slow_sources():
    assert backoff_delay_s(300, 0, key="x", retry_after_s=900) == 900
    assert backoff_delay_s(3600, 3, key="x", cap_s=3600) == 3600


def test_backoff_rejects_bad_interval():
    with pytest.raises(ValueError):
        backoff_delay_s(0, 1, key="x")


# --- configuration ------------------------------------------------------------


def test_interval_cannot_be_faster_than_source_cadence():
    with pytest.raises(ValueError):
        PoskoBanjirConnector(interval_s=60, env={})
    assert PoskoBanjirConnector(interval_s=600, env={}).interval_s == 600


@pytest.mark.parametrize(
    "env, expected",
    [
        ({}, "NoahAI/0.1 (+contact: set NOAH_CONTACT_EMAIL)"),
        ({"NOAH_CONTACT_EMAIL": "ops@example.go.id"}, "NoahAI/0.1 (+contact: ops@example.go.id)"),
        ({"NOAH_CONTACT_EMAIL": "a@b.c\r\nX-Evil: 1"}, "NoahAI/0.1 (+contact: a@b.cX-Evil1)"),
    ],
)
def test_user_agent(env, expected):
    assert user_agent(env) == expected


def test_safe_error_strips_urls_and_truncates():
    msg = safe_error(RuntimeError("boom at https://h.example/x?token=SECRET " + "y" * 500))
    assert "SECRET" not in msg and "<url>" in msg and len(msg) <= 200


# --- runs -------------------------------------------------------------------


def test_run_writes_raw_then_rows_and_records_run():
    sink = MemorySink()
    c = Dummy({"a": 10.0}, fetcher=FakeFetcher([_resp()]), env={})
    run = c.run(sink)
    assert run.status is RunStatus.OK and run.rows_written == 1 and run.error is None
    assert run.newest_ts == datetime(2026, 11, 2, 13, 40, tzinfo=UTC)
    (key,) = sink.raw
    assert sink.observations[0].raw_ref == key
    assert sink.runs == [run]


def test_identified_user_agent_and_conditional_get():
    fetcher = FakeFetcher([_resp(headers={"ETag": 'W/"1"', "Last-Modified": "Mon, 02 Nov 2026 13:40:00 GMT"}),
                           response(b"", status=304)])
    sink = MemorySink()
    c = Dummy({"a": 1.0}, fetcher=fetcher, env={})
    c.run(sink)
    run2 = c.run(sink)
    first, second = fetcher.requests[0][1], fetcher.requests[1][1]
    assert first["User-Agent"].startswith("NoahAI/0.1 (+contact:")
    assert "If-None-Match" not in first
    assert second["If-None-Match"] == 'W/"1"'
    assert second["If-Modified-Since"] == "Mon, 02 Nov 2026 13:40:00 GMT"
    assert run2.status is RunStatus.OK and run2.rows_written == 0
    assert run2.newest_ts == datetime(2026, 11, 2, 13, 40, tzinfo=UTC)  # carried over
    assert len(sink.raw) == 1


def test_identical_body_is_not_stored_twice():
    sink = MemorySink()
    c = Dummy({"a": 1.0}, fetcher=FakeFetcher([_resp(), _resp()]), env={})
    c.run(sink)
    assert c.run(sink).rows_written == 0
    assert len(sink.raw) == 1 and len(sink.observations) == 1


def test_repoll_with_same_source_timestamp_is_idempotent():
    """A source repeating an old reading appends nothing; a newer one appends."""
    sink = MemorySink()
    fetcher = FakeFetcher([_resp(), _resp("2026-11-02T13:40:00.000+00:00"), _resp("2026-11-02T13:45:00+00:00")])
    c = Dummy({"a": 1.0, "b": 2.0}, fetcher=fetcher, env={})
    assert c.run(sink).rows_written == 2
    assert c.run(sink).rows_written == 0  # different bytes, same instants
    assert c.run(sink).rows_written == 2
    assert [o.ts.minute for o in sink.observations] == [40, 40, 45, 45]


def test_out_of_range_flagged_never_dropped():
    sink = MemorySink()
    Dummy({"a": 1.0, "b": 9999.0}, fetcher=FakeFetcher([_resp()]), env={}).run(sink)
    flags = {o.station_external_id: o.quality_flag for o in sink.observations}
    assert flags == {"a": QualityFlag.OK, "b": QualityFlag.SUSPECT}


def test_s1_stale_station_detected_across_polls(s1_html):
    """Karet repeats 01/11 15:30 WIB: written once flagged STALE, never duplicated."""
    later = s1_html.replace(b"20:40", b"20:45")  # other posts move on 5 min
    fetcher = FakeFetcher([response(s1_html), response(later, fetched_at=S1_FETCHED_AT + timedelta(minutes=5))])
    sink = MemorySink()
    c = PoskoBanjirConnector(fetcher=fetcher, env={})
    assert c.run(sink).rows_written == 37
    run2 = c.run(sink)
    karet = [o for o in sink.observations if o.station_external_id == "163"]
    assert len(karet) == 1 and karet[0].quality_flag is QualityFlag.STALE
    manggarai = [o for o in sink.observations if o.station_external_id == "122"]
    assert [o.ts.minute for o in manggarai] == [40, 45]
    assert run2.rows_written == 37 - 2 - 3  # Karet and Kaliduri repeat; the 20:44/20:39 posts did not move


@pytest.mark.parametrize(
    "resp, msg",
    [
        (response(b"<html>Just a moment...</html>", status=403), "HTTP 403"),
        (response(b"", status=500), "HTTP 500"),
        (TimeoutError("timed out"), "TimeoutError"),
    ],
)
def test_fetch_failures_become_failed_runs(resp, msg):
    sink = MemorySink()
    run = Dummy({"a": 1.0}, fetcher=FakeFetcher([resp]), env={}).run(sink)
    assert run.status is RunStatus.FAILED and msg in run.error
    assert sink.observations == [] and sink.runs == [run]


def test_retry_after_is_honoured():
    c = Dummy(fetcher=FakeFetcher([response(b"", status=429, headers={"Retry-After": "1200"})]), env={})
    run = c.run(MemorySink())
    assert run.status is RunStatus.FAILED and c.last_retry_after_s == 1200


def test_parser_exception_is_isolated_and_secret_free():
    sink = MemorySink()
    run = Dummy(explode=True, fetcher=FakeFetcher([_resp()]), env={}).run(sink)
    assert run.status is RunStatus.FAILED
    assert "token" not in run.error and "secret.example" not in run.error
    assert len(sink.raw) == 1  # raw kept for debugging; no rows


def test_failed_parse_is_retried_on_next_poll_even_if_unchanged():
    sink = MemorySink()
    c = Dummy({"a": 1.0}, explode=True, fetcher=FakeFetcher([_resp(), _resp()]), env={})
    c.run(sink)
    c.explode = False
    assert c.run(sink).rows_written == 1


def test_record_run_failure_does_not_raise():
    class BrokenSink(MemorySink):
        def record_run(self, run):
            raise ConnectionError("db down")

    run = Dummy({"a": 1.0}, fetcher=FakeFetcher([_resp()]), env={}).run(BrokenSink())
    assert run.status is RunStatus.OK


# --- scheduler --------------------------------------------------------------


class Exploding(Dummy):
    id = "exploding"

    def run(self, sink):  # violates the contract on purpose
        raise RuntimeError("escaped")


def test_one_failing_connector_does_not_stop_others():
    clock = Clock(S1_FETCHED_AT)
    sink = MemorySink()
    bad = Dummy(fetcher=FakeFetcher([TimeoutError("t")]), env={}, clock=clock)
    bad.id = "bad"
    good = Dummy({"a": 1.0}, fetcher=FakeFetcher([_resp()]), env={}, clock=clock)
    sched = Scheduler([Exploding(env={}, clock=clock), bad, good], sink, clock=clock)
    runs = sched.run_once()
    assert [r.status for r in runs] == [RunStatus.FAILED, RunStatus.FAILED, RunStatus.OK]
    assert len(sink.observations) == 1


def test_scheduler_backs_off_after_failures_and_resets_after_success():
    clock = Clock(S1_FETCHED_AT)
    sleeps = []
    responses = [TimeoutError("t"), TimeoutError("t"), _resp(), _resp("2026-11-02T13:50:00+00:00")]
    c = Dummy({"a": 1.0}, fetcher=FakeFetcher(responses), env={}, clock=clock)

    def sleep(s):
        sleeps.append(s)
        clock.advance(seconds=s)

    sched = Scheduler([c], MemorySink(), clock=clock, sleep=sleep)
    sched.run_forever(max_cycles=4)
    assert sleeps[0] == pytest.approx(backoff_delay_s(60, 1, key="dummy"), abs=1e-3)
    assert sleeps[1] == pytest.approx(backoff_delay_s(60, 2, key="dummy"), abs=1e-3)
    assert sleeps[2] == pytest.approx(60) and sleeps[3] == pytest.approx(60)
    assert sleeps[1] > sleeps[0] > 60


def test_disabled_connectors_are_skipped():
    from noah.connectors.s4_bpbd_infobanjir import BpbdInfoBanjirConnector

    sched = Scheduler([BpbdInfoBanjirConnector(env={})], MemorySink())
    assert sched.run_once() == [] and sched.skipped == ["s4_bpbd_infobanjir"]


# --- CLI --------------------------------------------------------------------


def test_dry_run_cli_prints_counts(capsys):
    fetcher = FakeFetcher([response(fixture_bytes("s1_posko_banjir_20261102T1342Z.html"))])
    code = cli.main(["run", "--once", "--connector", "s1", "--dry-run"], fetcher=fetcher)
    out = capsys.readouterr().out
    assert code == 0
    assert "s1_posko_banjir: ok rows=37 newest_ts=2026-11-02T13:44:00Z" in out
    assert "observations=37" in out and "raw=1" in out
    assert len(fetcher.requests) == 1


def test_dry_run_cli_reports_failure_exit_code(capsys):
    fetcher = FakeFetcher([response(b"", status=503)])
    assert cli.main(["run", "--once", "--connector", "s15", "--dry-run"], fetcher=fetcher) == 1
    assert "s15_petabencana: failed" in capsys.readouterr().out


def test_cli_lists_disabled_connector(capsys):
    assert cli.main(["run", "--once", "--connector", "s4", "--dry-run"], fetcher=FakeFetcher()) == 0
    assert "s4_bpbd_infobanjir: disabled" in capsys.readouterr().out


def test_cli_without_sink_refuses(monkeypatch, capsys):
    monkeypatch.delenv("NOAH_SINK", raising=False)
    assert cli.main(["run", "--once", "--connector", "s1"], fetcher=FakeFetcher()) == 2
    assert "no sink configured" in capsys.readouterr().err


def test_cli_unknown_connector(capsys):
    assert cli.main(["run", "--once", "--connector", "s99", "--dry-run"], fetcher=FakeFetcher()) == 2
