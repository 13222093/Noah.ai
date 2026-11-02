"""/api/v1/health (B-040) backed by MemorySink as the HealthSource."""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from noah.api.app import create_app
from noah.api.settings import Settings
from noah.connectors.base import HealthSpec
from noah.connectors.memory import MemorySink
from noah.records import ConnectorRun, RunStatus

NOW = datetime(2026, 11, 2, 14, 0, tzinfo=timezone.utc)
SPECS = [
    HealthSpec("s1_posko_banjir", True, 300, 15.0, "data"),
    HealthSpec("s15_petabencana", True, 300, 15.0, "run"),
    HealthSpec("s4_bpbd_infobanjir", False, 3600, 75.0, "run"),
]


def _run(conn, minutes_ago, status=RunStatus.OK, newest_min_ago=None, error=None):
    t = NOW - timedelta(minutes=minutes_ago)
    newest = NOW - timedelta(minutes=newest_min_ago) if newest_min_ago is not None else None
    return ConnectorRun(conn, t - timedelta(seconds=2), t, status, rows_written=1, newest_ts=newest, error=error)


def _client(sink, specs=SPECS):
    app = create_app(Settings(env="test"), health_source=sink, health_specs=specs, clock=lambda: NOW)
    return TestClient(app, raise_server_exceptions=False)


def _fresh_sink():
    sink = MemorySink()
    sink.record_run(_run("s1_posko_banjir", 3, newest_min_ago=5))
    sink.record_run(_run("s15_petabencana", 2, newest_min_ago=60 * 24 * 3))  # old reports are fine
    return sink


def test_all_fresh_is_200():
    resp = _client(_fresh_sink()).get("/api/v1/health")
    assert resp.status_code == 200
    assert resp.headers["cache-control"] == "no-store"
    body = resp.json()
    assert body["status"] == "ok" and body["checked_at"] == "2026-11-02T14:00:00Z"
    s1 = body["connectors"]["s1_posko_banjir"]
    assert s1 == {
        "enabled": True,
        "freshness": "data",
        "stale_after_min": 15.0,
        "last_run_at": "2026-11-02T13:57:00Z",
        "last_status": "ok",
        "last_success_at": "2026-11-02T13:57:00Z",
        "newest_ts": "2026-11-02T13:55:00Z",
        "age_min": 5.0,
        "consecutive_failures": 0,
        "stale": False,
    }
    assert body["connectors"]["s15_petabencana"]["age_min"] == 2.0
    # disabled connectors are listed, never make the service unhealthy
    s4 = body["connectors"]["s4_bpbd_infobanjir"]
    assert s4["enabled"] is False and s4["last_status"] is None and s4["stale"] is True


def test_stale_source_data_is_503_even_if_polling_works():
    sink = _fresh_sink()
    sink.record_run(_run("s1_posko_banjir", 1, newest_min_ago=16))  # DSDA page frozen
    resp = _client(sink).get("/api/v1/health")
    assert resp.status_code == 503
    body = resp.json()
    assert body["status"] == "degraded"
    assert body["connectors"]["s1_posko_banjir"]["stale"] is True
    assert body["connectors"]["s1_posko_banjir"]["age_min"] == 16.0


def test_connector_that_stopped_running_is_stale():
    sink = MemorySink()
    sink.record_run(_run("s1_posko_banjir", 3, newest_min_ago=5))
    sink.record_run(_run("s15_petabencana", 20, newest_min_ago=None))
    resp = _client(sink).get("/api/v1/health")
    assert resp.status_code == 503
    assert resp.json()["connectors"]["s15_petabencana"]["stale"] is True


def test_failed_last_run_is_503_and_error_text_never_leaks():
    sink = _fresh_sink()
    secret = "OperationalError: password=hunter2 host=db.internal"
    sink.record_run(_run("s15_petabencana", 1, RunStatus.FAILED, error=secret))
    sink.record_run(_run("s15_petabencana", 0.5, RunStatus.FAILED, error=secret))
    resp = _client(sink).get("/api/v1/health")
    assert resp.status_code == 503
    c = resp.json()["connectors"]["s15_petabencana"]
    assert c["last_status"] == "failed" and c["consecutive_failures"] == 2
    assert c["last_success_at"] == "2026-11-02T13:58:00Z"
    assert "hunter2" not in resp.text and "OperationalError" not in resp.text


def test_partial_counts_as_success():
    sink = _fresh_sink()
    sink.record_run(_run("s1_posko_banjir", 1, RunStatus.PARTIAL, newest_min_ago=4))
    assert _client(sink).get("/api/v1/health").status_code == 200


def test_never_ran_is_503():
    resp = _client(MemorySink()).get("/api/v1/health")
    assert resp.status_code == 503
    assert all(c["last_run_at"] is None for c in resp.json()["connectors"].values())


def test_no_health_source_is_unconfigured_503():
    app = create_app(Settings(env="test"), environ={})
    with TestClient(app) as c:
        resp = c.get("/api/v1/health")
    assert resp.status_code == 503
    assert resp.json() == {"status": "unconfigured"}
    assert resp.headers["cache-control"] == "no-store"


def test_broken_health_source_does_not_leak():
    class Broken(MemorySink):
        def recent_runs(self, connector, limit=5):
            raise RuntimeError("could not connect to postgres://noah:s3cret@db/noah")

    resp = _client(Broken()).get("/api/v1/health")
    assert resp.status_code == 503
    assert resp.json()["error"]["code"] == "unavailable"
    assert "s3cret" not in resp.text


def test_default_specs_cover_every_connector():
    app = create_app(Settings(env="test"), health_source=MemorySink(), clock=lambda: NOW)
    with TestClient(app) as c:
        names = set(c.get("/api/v1/health").json()["connectors"])
    assert names == {
        "s1_posko_banjir",
        "s4_bpbd_infobanjir",
        "s5_bmkg_nowcast",
        "s5_bmkg_nowcast_image",
        "s15_petabencana",
    }


@pytest.mark.parametrize("method", ["post", "put", "delete"])
def test_health_is_read_only(method):
    assert getattr(_client(_fresh_sink()), method)("/api/v1/health").status_code == 405
