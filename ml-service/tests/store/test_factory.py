"""F1/F2: the store factory (worker sink, API health source) without a real database."""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from noah.api.app import create_app
from noah.api.settings import Settings
from noah.connectors import __main__ as cli
from noah.connectors.base import HealthSpec
from noah.connectors.memory import MemorySink
from noah.records import ConnectorRun, RunStatus
from noah.store.factory import (
    PostgresUrlHealthSource,
    ReconnectingPostgresSink,
    StoreConfigError,
    health_source_from_env,
    make_sink,
    object_store_checked,
)
from noah.store.objects import LocalObjectStore
from noah.store.postgres import PostgresSink

SECRET_URL = "postgresql://noah_ingest:s3cret-pw@db.example.invalid:5432/noah"
NOW = datetime(2026, 11, 2, 14, 0, tzinfo=timezone.utc)


class FakeConn:
    """Answers the two connector_runs queries from a list of runs."""

    def __init__(self, runs=()):
        self.runs = list(runs)
        self.closed = False
        self.broken = False
        self.queries = 0

    def execute(self, sql, params=()):
        self.queries += 1
        connector = params[0]
        mine = sorted((r for r in self.runs if r.connector == connector), key=lambda r: r.finished_at, reverse=True)
        if "status IN" in sql:
            mine = [r for r in mine if r.status is not RunStatus.FAILED][:1]
        else:
            mine = mine[: params[1]]
        rows = [(r.connector, r.started_at, r.finished_at, r.status.value, r.rows_written, r.newest_ts, r.error) for r in mine]
        return SimpleNamespace(fetchall=lambda: rows, fetchone=lambda: rows[0] if rows else None)

    def close(self):
        self.closed = True


# ---------------------------------------------------------------- make_sink


def test_make_sink_without_database_url_fails_closed(tmp_path):
    with pytest.raises(StoreConfigError, match="NOAH_DATABASE_URL is not set"):
        make_sink({"NOAH_OBJECT_STORE_DIR": str(tmp_path)})


def test_make_sink_blank_database_url_fails_closed(tmp_path):
    with pytest.raises(StoreConfigError, match="NOAH_DATABASE_URL"):
        make_sink({"NOAH_DATABASE_URL": "   ", "NOAH_OBJECT_STORE_DIR": str(tmp_path)})


def test_make_sink_local_store_is_postgres_sink_and_connects_lazily(tmp_path):
    opened = []

    def connect(url):
        opened.append(url)
        return FakeConn()

    objects_dir = tmp_path / "objects"
    sink = make_sink(
        {"NOAH_DATABASE_URL": SECRET_URL, "NOAH_OBJECT_STORE": "local", "NOAH_OBJECT_STORE_DIR": str(objects_dir)},
        connect_fn=connect,
    )
    assert isinstance(sink, PostgresSink) and isinstance(sink, ReconnectingPostgresSink)
    assert isinstance(sink.objects, LocalObjectStore)
    assert sink.objects.root == objects_dir.resolve()
    assert objects_dir.is_dir()  # created at startup, not on the first payload
    assert opened == []  # no connection until first use
    assert "s3cret" not in repr(sink)
    conn = sink.conn
    assert opened == [SECRET_URL] and sink.conn is conn  # reused while healthy


def test_reconnecting_sink_reopens_broken_connection(tmp_path):
    conns = []

    def connect(url):
        conns.append(FakeConn())
        return conns[-1]

    sink = make_sink({"NOAH_DATABASE_URL": SECRET_URL, "NOAH_OBJECT_STORE_DIR": str(tmp_path)}, connect_fn=connect)
    first = sink.conn
    sink._station_cache[("s1", "x")] = 1
    first.broken = True
    second = sink.conn
    assert second is not first and first.closed and len(conns) == 2
    assert sink._station_cache == {}  # ids are re-resolved on the new connection
    second.closed = True
    assert sink.conn is conns[2]


def test_object_store_default_is_local(tmp_path):
    store = object_store_checked({"NOAH_OBJECT_STORE_DIR": str(tmp_path / "o")})
    assert isinstance(store, LocalObjectStore)


def test_object_store_s3_without_bucket_is_clear_error():
    with pytest.raises(StoreConfigError, match="NOAH_S3_BUCKET"):
        object_store_checked({"NOAH_OBJECT_STORE": "s3"})


def test_object_store_s3_without_boto3_is_clear_error():
    # boto3 is not a requirement until the object-storage provider is chosen.
    try:
        import boto3  # noqa: F401
    except ImportError:
        with pytest.raises(StoreConfigError, match="boto3"):
            object_store_checked({"NOAH_OBJECT_STORE": "s3", "NOAH_S3_BUCKET": "noah"})
    else:  # pragma: no cover - only when boto3 is installed
        pytest.skip("boto3 installed")


def test_object_store_unknown_kind_is_clear_error():
    with pytest.raises(StoreConfigError, match="unknown NOAH_OBJECT_STORE"):
        object_store_checked({"NOAH_OBJECT_STORE": "ftp"})


@pytest.mark.skipif(os.name == "nt", reason="POSIX permissions")
def test_object_store_unwritable_dir_is_clear_error(tmp_path):  # pragma: no cover - POSIX only
    ro = tmp_path / "ro"
    ro.mkdir()
    ro.chmod(0o500)
    try:
        if os.access(ro, os.W_OK):
            pytest.skip("running as root")
        with pytest.raises(StoreConfigError, match="not writable"):
            object_store_checked({"NOAH_OBJECT_STORE_DIR": str(ro)})
    finally:
        ro.chmod(0o700)


# ------------------------------------------------------------- worker CLI


def test_worker_cli_fails_closed_without_database(monkeypatch, capsys, tmp_path):
    monkeypatch.delenv("NOAH_DATABASE_URL", raising=False)
    monkeypatch.setenv("NOAH_OBJECT_STORE_DIR", str(tmp_path))

    class NoFetch:
        def get(self, *a, **k):  # pragma: no cover - must never be called
            raise AssertionError("no connector may run without a sink")

    code = cli.main(["run", "--once", "--sink", "noah.store.factory:make_sink"], fetcher=NoFetch())
    err = capsys.readouterr().err
    assert code == 2
    assert "NOAH_DATABASE_URL is not set" in err


def test_worker_cli_reads_noah_sink_env(monkeypatch, capsys):
    monkeypatch.setenv("NOAH_SINK", "noah.store.factory:make_sink")
    code = cli.main(["run", "--once"])
    assert code == 2 and "NOAH_DATABASE_URL is not set" in capsys.readouterr().err


def test_worker_cli_never_prints_urls(monkeypatch, capsys):
    import types

    mod = types.ModuleType("fake_sink_mod")

    def boom():
        raise RuntimeError(f"could not connect to {SECRET_URL}")

    mod.boom = boom
    monkeypatch.setitem(__import__("sys").modules, "fake_sink_mod", mod)
    code = cli.main(["run", "--once", "--sink", "fake_sink_mod:boom"])
    err = capsys.readouterr().err
    assert code == 2 and "s3cret" not in err and "db.example.invalid" not in err and "<url>" in err


def test_worker_cli_bad_factory_name(capsys):
    assert cli.main(["run", "--once", "--sink", "noah.store.factory:nope"]) == 2
    assert "cannot load sink factory" in capsys.readouterr().err


# ------------------------------------------------------ API health wiring


SPECS = [HealthSpec("s1_posko_banjir", True, 300, 15.0, "data")]


def _fresh_run():
    t = NOW - timedelta(minutes=2)
    return ConnectorRun("s1_posko_banjir", t - timedelta(seconds=1), t, RunStatus.OK, 3, NOW - timedelta(minutes=4))


def test_health_source_from_env_none_without_url():
    assert health_source_from_env({}) is None
    assert health_source_from_env({"NOAH_DATABASE_URL": ""}) is None


def test_health_source_from_env_makes_no_connection():
    opened = []
    src = health_source_from_env({"NOAH_DATABASE_URL": SECRET_URL}, connect_fn=lambda u: opened.append(u))
    assert isinstance(src, PostgresUrlHealthSource) and opened == []
    assert "s3cret" not in repr(src)


def test_create_app_unconfigured_is_503_json():
    app = create_app(Settings(env="test"), environ={})
    with TestClient(app, raise_server_exceptions=False) as c:
        resp = c.get("/api/v1/health")
        live = c.get("/api/v1/openapi.json")
    assert resp.status_code == 503 and resp.json() == {"status": "unconfigured"}
    assert live.status_code == 200  # the container liveness probe stays green


def test_create_app_wires_postgres_health_source_from_env(monkeypatch):
    conns: list[FakeConn] = []

    def fake_connect(url, **kwargs):
        assert url == SECRET_URL
        conns.append(FakeConn([_fresh_run()]))
        return conns[-1]

    monkeypatch.setattr("noah.store.factory.connect", fake_connect)
    app = create_app(
        Settings(env="test"),
        environ={"NOAH_DATABASE_URL": SECRET_URL},
        health_specs=SPECS,
        clock=lambda: NOW,
    )
    assert isinstance(app.state.health_source, PostgresUrlHealthSource)
    assert conns == []  # startup makes no connection
    with TestClient(app, raise_server_exceptions=False) as c:
        resp = c.get("/api/v1/health")
    assert resp.status_code == 200 and resp.json()["status"] == "ok"
    # One short-lived connection per request, closed afterwards.
    assert len(conns) == 1 and conns[0].closed and conns[0].queries == 2


def test_create_app_health_source_unreachable_is_503_without_details(monkeypatch):
    def fake_connect(url, **kwargs):
        raise OSError(f"connection to {SECRET_URL} failed: timeout")

    monkeypatch.setattr("noah.store.factory.connect", fake_connect)
    app = create_app(Settings(env="test"), environ={"NOAH_DATABASE_URL": SECRET_URL}, health_specs=SPECS)
    with TestClient(app, raise_server_exceptions=False) as c:
        resp = c.get("/api/v1/health")
    assert resp.status_code == 503
    assert resp.json()["error"]["code"] == "unavailable"
    assert "s3cret" not in resp.text and "db.example.invalid" not in resp.text


@pytest.mark.parametrize("fresh, expected", [(True, 200), (False, 503)])
def test_create_app_with_fake_health_source(fresh, expected):
    sink = MemorySink()
    run = _fresh_run()
    if not fresh:
        run = ConnectorRun(run.connector, run.started_at, run.finished_at, RunStatus.FAILED, error="x")
    sink.record_run(run)
    app = create_app(Settings(env="test"), environ={}, health_source=sink, health_specs=SPECS, clock=lambda: NOW)
    with TestClient(app, raise_server_exceptions=False) as c:
        resp = c.get("/api/v1/health")
    assert resp.status_code == expected
    assert resp.json()["status"] == ("ok" if fresh else "degraded")
