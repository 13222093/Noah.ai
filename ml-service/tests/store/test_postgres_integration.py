"""B-031/B-033: the schema against a real PostgreSQL + PostGIS.

Runs only when ``NOAH_TEST_DATABASE_URL`` points at a throwaway database
(CI starts ``postgis/postgis:16-3.4``). With ``NOAH_REQUIRE_DB=1`` a missing
URL is an error instead of a skip, so CI cannot pass by skipping. Rows
written here can never be deleted (that is the point), so every test uses
fresh keys and the database must be disposable. Never point this at a live
database.
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

URL = os.environ.get("NOAH_TEST_DATABASE_URL")
if not URL:
    if os.environ.get("NOAH_REQUIRE_DB") == "1":
        raise RuntimeError("NOAH_REQUIRE_DB=1 but NOAH_TEST_DATABASE_URL is not set")
    pytest.skip("NOAH_TEST_DATABASE_URL not set (integration tests run in CI)", allow_module_level=True)

psycopg = pytest.importorskip("psycopg")
from psycopg import errors  # noqa: E402

from noah.api.health import compute_health  # noqa: E402
from noah.connectors.base import HealthSpec  # noqa: E402
from noah.importers import s2_tma_2020 as s2  # noqa: E402
from noah.records import (  # noqa: E402
    ConnectorRun,
    FloodReport,
    Observation,
    QualityFlag,
    RainProduct,
    RawPayload,
    RunStatus,
)
from noah.store.migrate import discover_migrations, migrate  # noqa: E402
from noah.store.objects import LocalObjectStore  # noqa: E402
from noah.store.postgres import PostgresHealthSource, PostgresSink, UnknownStationError  # noqa: E402
from noah.store.stations import apply_station_config, load_station_config  # noqa: E402

UTC = timezone.utc
FIXTURE = Path(__file__).resolve().parents[1] / "importers" / "fixtures" / "tma_2020_sample.csv"


@pytest.fixture(scope="module")
def conn():
    with psycopg.connect(URL, autocommit=True) as c:
        migrate(c)
        apply_station_config(c, load_station_config())
        yield c


@pytest.fixture
def sink(conn, tmp_path):
    return PostgresSink(conn, LocalObjectStore(tmp_path))


def _uid() -> str:
    return uuid.uuid4().hex[:10]


def _ts(minutes: int = 0) -> datetime:
    # Unique per test run: a random offset in a far-past window.
    base = datetime(2001, 1, 1, tzinfo=UTC) + timedelta(minutes=int(uuid.uuid4().int % 10_000_000))
    return base + timedelta(minutes=minutes)


def test_all_migrations_applied_and_rerun_is_noop(conn):
    applied = {r[0] for r in conn.execute("SELECT version FROM schema_migrations")}
    assert applied == {m.version for m in discover_migrations()}
    assert migrate(conn) == []
    assert conn.execute("SELECT count(*) FROM stations").fetchone()[0] == len(load_station_config().stations)


# ---------------------------------------------------------------- append-only


def _seed_rows(conn) -> dict[str, tuple[str, int | str]]:
    """Insert one row into every append-only table; return table -> (pk column, value)."""
    u = _uid()
    one = lambda sql, *a: conn.execute(sql, a).fetchone()[0]  # noqa: E731
    station = one("SELECT id FROM stations WHERE code = 'manggarai'")
    unit = one("INSERT INTO spatial_units (kind, code, name) VALUES ('polder', %s, 'Test polder') RETURNING id", f"t-{u}")
    pump = one("INSERT INTO pumps (code, kind, source, polder_id) VALUES (%s, 'mobile', 'manual', %s) RETURNING id", f"p-{u}", unit)
    raw = f"raw/test/2001/01/01/20010101T000000Z_{u}00.json"
    conn.execute(
        "INSERT INTO raw_payloads (key, source, fetched_at, sha256, size_bytes, content_type) "
        "VALUES (%s, 'test', now(), %s, 0, 'application/json')", (raw, "0" * 64))
    conn.execute(
        "INSERT INTO event_definitions (version, description, rule, valid_from) VALUES (%s, 'test', '{}', now())",
        (f"v-{u}",))
    run_id = f"bt-{u}"
    conn.execute("INSERT INTO forecast_runs (run_id, kind, started_at) VALUES (%s, 'backtest', now())", (run_id,))
    ids = {
        "raw_payloads": ("key", raw),
        "forecast_runs": ("run_id", run_id),
        "observations": ("id", one(
            "INSERT INTO observations (station_id, ts, value, unit, raw_ref) VALUES (%s, %s, 1, 'cm', %s) RETURNING id",
            station, _ts(), raw)),
        "pump_states": ("id", one(
            "INSERT INTO pump_states (pump_id, ts, is_on, source) VALUES (%s, %s, true, 'manual') RETURNING id", pump, _ts())),
        "rain_products": ("id", one(
            "INSERT INTO rain_products (source, issued_at, valid_at, kind, uri) VALUES ('test', now(), now(), 'obs', %s) RETURNING id",
            f"rasters/test/{u}.png")),
        "flood_reports": ("id", one(
            "INSERT INTO flood_reports (source, external_id, ts_start, depth_cm, geom) "
            "VALUES ('bpbd_rt', %s, now(), 30, ST_SetSRID(ST_MakePoint(106.8, -6.2), 4326)) RETURNING id", u)),
        "forecasts": ("id", one(
            "INSERT INTO forecasts (source, model_version, run_id, issued_at, unit_id, lead_min, valid_from, valid_to, probability) "
            "VALUES ('baseline', 'v0', %s, now(), %s, 60, now(), now() + interval '1 hour', 0.5) RETURNING id", run_id, unit)),
        "connector_runs": ("id", one(
            "INSERT INTO connector_runs (connector, started_at, finished_at, status) VALUES (%s, now(), now(), 'ok') RETURNING id",
            f"test-{u}")),
        "polder_params": ("polder_id", one(
            "INSERT INTO polder_params (polder_id, valid_from, source) VALUES (%s, now(), 'test') RETURNING polder_id", unit)),
        "audit_log": ("id", one("INSERT INTO audit_log (action, object) VALUES ('test', %s) RETURNING id", u)),
    }
    ids["verifications"] = ("id", one(
        "INSERT INTO verifications (forecast_id, event_def_version, outcome) VALUES (%s, %s, 'hit') RETURNING id",
        ids["forecasts"][1], f"v-{u}"))
    ids["recommendations"] = ("id", one(
        "INSERT INTO recommendations (forecast_id, unit_id, action_type, text_id) VALUES (%s, %s, 'drawdown', 't1') RETURNING id",
        ids["forecasts"][1], unit))
    ids["recommendation_events"] = ("id", one(
        "INSERT INTO recommendation_events (recommendation_id, kind, channel) VALUES (%s, 'sent', 'dashboard') RETURNING id",
        ids["recommendations"][1]))
    return ids


# table -> a non-identity column to "update" to itself (any UPDATE must raise)
APPEND_ONLY = {
    "observations": "value", "pump_states": "is_on", "flood_reports": "depth_cm",
    "forecasts": "probability", "verifications": "outcome", "rain_products": "meta",
    "raw_payloads": "url", "connector_runs": "rows_written", "forecast_runs": "description",
    "polder_params": "source", "recommendations": "text_id", "recommendation_events": "note",
    "audit_log": "action",
}


@pytest.fixture(scope="module")
def seeded(conn):
    return _seed_rows(conn)


@pytest.mark.parametrize("table", APPEND_ONLY)
def test_update_delete_truncate_raise(conn, seeded, table):
    col, val = seeded[table]
    with pytest.raises(errors.RaiseException, match="append-only"):
        conn.execute(f"UPDATE {table} SET {APPEND_ONLY[table]} = {APPEND_ONLY[table]} WHERE {col} = %s", (val,))
    with pytest.raises(errors.RaiseException, match="append-only"):
        conn.execute(f"DELETE FROM {table} WHERE {col} = %s", (val,))
    with pytest.raises(errors.RaiseException, match="append-only"):
        conn.execute(f"TRUNCATE {table} CASCADE")
    assert conn.execute(f"SELECT count(*) FROM {table} WHERE {col} = %s", (val,)).fetchone()[0] == 1


def test_app_role_lacks_update_and_delete_privileges(conn, seeded):
    """Layer 1: an application role that is only granted SELECT/INSERT fails on
    privileges. Layer 2: even a role granted ALL (as Supabase's defaults do)
    is stopped by the trigger."""
    col, val = seeded["observations"]
    for role in ("noah_ci_app", "noah_ci_all"):
        conn.execute(f"DO $$ BEGIN CREATE ROLE {role} NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$")
    conn.execute("GRANT SELECT, INSERT ON observations TO noah_ci_app")
    conn.execute("GRANT ALL ON observations TO noah_ci_all")
    try:
        conn.execute("SET ROLE noah_ci_app")
        with pytest.raises(errors.InsufficientPrivilege):
            conn.execute("UPDATE observations SET value = 2 WHERE id = %s", (val,))
        with pytest.raises(errors.InsufficientPrivilege):
            conn.execute("DELETE FROM observations WHERE id = %s", (val,))
        conn.execute("RESET ROLE")
        conn.execute("SET ROLE noah_ci_all")
        with pytest.raises(errors.RaiseException):
            conn.execute("UPDATE observations SET value = 2 WHERE id = %s", (val,))
    finally:
        conn.execute("RESET ROLE")


def test_event_definitions_sign_off_once(conn):
    v = f"v-{_uid()}"
    conn.execute("INSERT INTO event_definitions (version, description, rule, valid_from) VALUES (%s, 'x', '{}', now())", (v,))
    conn.execute("UPDATE event_definitions SET agreed_with = 'DSDA' WHERE version = %s", (v,))
    with pytest.raises(errors.RaiseException):
        conn.execute("UPDATE event_definitions SET agreed_with = 'BPBD' WHERE version = %s", (v,))
    with pytest.raises(errors.RaiseException):
        conn.execute("UPDATE event_definitions SET rule = '{\"a\": 1}' WHERE version = %s", (v,))
    with pytest.raises(errors.RaiseException):
        conn.execute("DELETE FROM event_definitions WHERE version = %s", (v,))


# ---------------------------------------------------------------- sink


def _raw(sink, u):
    return sink.write_raw(RawPayload("s1_posko_banjir", datetime.now(UTC), f"<p>{u}</p>".encode(), "text/html"))


def test_observations_unique_per_station_and_ts(conn, sink):
    u = _uid()
    ref1, ref2 = _raw(sink, u), _raw(sink, u + "b")
    ts = _ts()
    obs = Observation("s1_posko_banjir", "122", ts, 534.0, "cm", raw_ref=ref1)
    assert sink.write_observations([obs]) == 1
    assert sink.write_observations([obs]) == 0  # re-poll
    # a later poll repeating the old timestamp, flagged stale, adds nothing
    assert sink.write_observations([Observation("s1_posko_banjir", "122", ts, 534.0, "cm", QualityFlag.STALE, ref2)]) == 0
    # a different value for the same ts is ignored unless sent as a correction
    assert sink.write_observations([Observation("s1_posko_banjir", "122", ts, 540.0, "cm", raw_ref=ref2)]) == 0
    (orig_id,) = conn.execute(
        "SELECT o.id FROM observations o JOIN stations s ON s.id = o.station_id "
        "WHERE s.code = 'manggarai' AND o.ts = %s", (ts,)).fetchone()
    fix = Observation("s1_posko_banjir", "122", ts, 540.0, "cm", QualityFlag.MANUAL, ref2, supersedes_id=orig_id)
    assert sink.write_observations([fix]) == 1
    assert sink.write_observations([fix]) == 0
    # the S2 alias resolves to the same station
    assert sink.write_observations([Observation("s2_opendata", "PA. Manggarai", ts, 534.0, "cm")]) == 0


def test_unknown_station_writes_nothing(conn, sink):
    ts = _ts()
    batch = [
        Observation("s1_posko_banjir", "122", ts, 500.0, "cm"),
        Observation("s1_posko_banjir", "does-not-exist", ts, 1.0, "cm"),
    ]
    with pytest.raises(UnknownStationError):
        sink.write_observations(batch)
    n = conn.execute(
        "SELECT count(*) FROM observations o JOIN stations s ON s.id = o.station_id WHERE s.code='manggarai' AND ts=%s",
        (ts,)).fetchone()[0]
    assert n == 0


def test_raw_ref_resolves(conn, sink):
    key = _raw(sink, _uid())
    row = conn.execute("SELECT sha256, size_bytes FROM raw_payloads WHERE key = %s", (key,)).fetchone()
    assert row is not None and sink.objects.exists(key)
    assert len(sink.objects.get(key)) == row[1]


def test_flood_reports_unique_per_source_external_id_start(conn, sink):
    u = _uid()
    start = _ts()
    r = FloodReport("bpbd_rt", u, "3171010001001", start, None, 40.0, 106.85, -6.21, meta={"rw": "001"})
    assert sink.write_flood_reports([r]) == 1
    assert sink.write_flood_reports([r]) == 0
    ended = FloodReport("bpbd_rt", u, "3171010001001", start, start + timedelta(hours=3), 20.0)
    assert sink.write_flood_reports([ended]) == 0  # not a correction: ignored
    (rid,) = conn.execute("SELECT id FROM flood_reports WHERE source='bpbd_rt' AND external_id=%s", (u,)).fetchone()
    fix = FloodReport("bpbd_rt", u, "3171010001001", start, start + timedelta(hours=3), 20.0, supersedes_id=rid)
    assert sink.write_flood_reports([fix]) == 1
    assert conn.execute("SELECT count(*) FROM flood_reports WHERE external_id=%s", (u,)).fetchone()[0] == 2


def test_rain_products(sink):
    p = RainProduct("s5_bmkg_nowcast", _ts(), _ts(10), "nowcast", f"rasters/s5/{_uid()}.png", {"frame": 1})
    assert sink.write_rain_products([p]) == 1
    assert sink.write_rain_products([p]) == 0


def test_runs_and_health_source(conn, sink):
    c = f"test_conn_{_uid()}"
    t0 = datetime.now(UTC) - timedelta(minutes=30)
    sink.record_run(ConnectorRun(c, t0, t0 + timedelta(seconds=5), RunStatus.OK, 3, t0 - timedelta(minutes=2)))
    sink.record_run(ConnectorRun(c, t0 + timedelta(minutes=10), t0 + timedelta(minutes=10, seconds=5),
                                 RunStatus.PARTIAL, 1, t0 + timedelta(minutes=8)))
    sink.record_run(ConnectorRun(c, t0 + timedelta(minutes=20), t0 + timedelta(minutes=20, seconds=5),
                                 RunStatus.FAILED, 0, None, "timeout"))
    sink.record_run(ConnectorRun(c, t0 + timedelta(minutes=20), t0 + timedelta(minutes=20, seconds=5),
                                 RunStatus.FAILED, 0, None, "timeout"))  # duplicate: no-op
    hs = PostgresHealthSource(conn)
    runs = hs.recent_runs(c, 5)
    assert [r.status for r in runs] == [RunStatus.FAILED, RunStatus.PARTIAL, RunStatus.OK]
    assert hs.recent_runs(c, 1)[0].status is RunStatus.FAILED
    last_ok = sink.last_successful_run(c)
    assert last_ok.status is RunStatus.PARTIAL and last_ok.newest_ts == t0 + timedelta(minutes=8)
    assert hs.last_successful_run("never-ran") is None
    health = compute_health([HealthSpec(c, True, 300)], hs, datetime.now(UTC))
    assert health.status == "degraded" and health.connectors[c].consecutive_failures == 1


def test_s2_fixture_import_is_idempotent(conn, sink):
    config = load_station_config()
    first = s2.run_import(FIXTURE, sink, station_config=config)
    second = s2.run_import(FIXTURE, sink, station_config=config)
    assert first.observations == 19 and second.written == 0
    flags = dict(conn.execute(
        "SELECT quality_flag, count(*) FROM observations WHERE raw_ref = %s GROUP BY 1", (first.raw_ref,)).fetchall())
    assert flags == {"ok": 16, "suspect": 3}
