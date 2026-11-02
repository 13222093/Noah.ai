"""B-031/B-032: static checks on the SQL files. pglast (the PostgreSQL parser)
checks syntax; skipped if pglast is not installed."""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from noah.store.migrate import MigrationError, default_migrations_dir, discover_migrations

REPO = Path(__file__).resolve().parents[3]
MIGRATIONS = sorted(default_migrations_dir().glob("*.sql"))
DROP_SQL = REPO / "supabase" / "manual" / "B-032_drop_legacy.sql"
STORE_SRC = REPO / "ml-service" / "src" / "noah" / "store"

APPEND_ONLY = [
    "observations", "pump_states", "flood_reports", "forecasts", "verifications",
    "rain_products", "raw_payloads", "connector_runs", "forecast_runs",
    "polder_params", "recommendations", "recommendation_events", "audit_log",
]
PLAN_03_TABLES = [
    "spatial_units", "stations", "observations", "pumps", "pump_states", "polder_params",
    "rain_products", "flood_reports", "forecasts", "event_definitions", "verifications",
    "recommendations", "users", "audit_log",
    # plan issue P7 additions
    "operator_contacts", "connector_runs", "station_unit_map", "forecast_runs",
]


def _all_sql() -> str:
    return "\n".join(p.read_text(encoding="utf-8") for p in MIGRATIONS)


def test_migrations_are_contiguous():
    ms = discover_migrations()
    assert [m.version for m in ms] == [f"{i:04d}" for i in range(1, len(ms) + 1)]
    assert len(ms) >= 4


def test_checksum_ignores_line_endings(tmp_path):
    (tmp_path / "0001_a.sql").write_bytes(b"SELECT 1;\r\nSELECT 2;\r\n")
    crlf = discover_migrations(tmp_path)[0].checksum
    (tmp_path / "0001_a.sql").write_bytes(b"SELECT 1;\nSELECT 2;\n")
    assert discover_migrations(tmp_path)[0].checksum == crlf


@pytest.mark.parametrize("name", ["1_x.sql", "0001-x.sql", "0001_X.sql"])
def test_bad_file_names_rejected(tmp_path, name):
    (tmp_path / name).write_text("SELECT 1;")
    with pytest.raises(MigrationError):
        discover_migrations(tmp_path)


def test_duplicate_versions_rejected(tmp_path):
    (tmp_path / "0001_a.sql").write_text("SELECT 1;")
    (tmp_path / "0001_b.sql").write_text("SELECT 1;")
    with pytest.raises(MigrationError):
        discover_migrations(tmp_path)


@pytest.mark.parametrize("table", PLAN_03_TABLES)
def test_every_planned_table_is_created(table):
    assert re.search(rf"CREATE TABLE {table} \(", _all_sql()), table


@pytest.mark.parametrize("table", APPEND_ONLY)
def test_fact_tables_are_append_only(table):
    assert f"SELECT noah_make_append_only('{table}');" in _all_sql()


@pytest.mark.parametrize("table", [t for t in APPEND_ONLY if t not in ("raw_payloads", "forecast_runs", "connector_runs",
                                                                        "polder_params", "recommendation_events", "audit_log")])
def test_fact_tables_have_supersedes_id(table):
    body = re.search(rf"CREATE TABLE {table} \((.*?)\n\);", _all_sql(), re.S).group(1)
    assert "supersedes_id" in body


def test_only_timestamptz_no_naive_timestamps():
    sql = re.sub(r"--[^\n]*", "", _all_sql())
    assert not re.search(r"\btimestamp\b(?!tz)(?! with time zone)", sql, re.I)


def test_store_never_upserts_facts():
    """ON CONFLICT DO UPDATE is allowed only for configuration (stations)."""
    for path in STORE_SRC.glob("*.py"):
        text = path.read_text(encoding="utf-8")
        if "DO UPDATE" in text:
            assert path.name == "stations.py", path
            assert not re.search(r"INSERT INTO (observations|flood_reports|rain_products|forecasts|pump_states)", text)
    assert "DO UPDATE" not in re.sub(r"--[^\n]*", "", _all_sql())


def test_drop_sql_never_commits_by_itself():
    statements = re.sub(r"--[^\n]*", "", DROP_SQL.read_text(encoding="utf-8"))
    assert not re.search(r"^\s*COMMIT\s*;", statements, re.M | re.I)
    assert "noah.b032_confirm" in statements
    assert "CASCADE" not in statements.upper()


# ---------------------------------------------------------------- pglast


@pytest.mark.parametrize("path", MIGRATIONS + [DROP_SQL], ids=lambda p: p.name)
def test_sql_parses(path):
    pglast = pytest.importorskip("pglast")
    stmts = pglast.parse_sql(path.read_text(encoding="utf-8"))
    assert stmts


@pytest.mark.parametrize("path", MIGRATIONS + [DROP_SQL], ids=lambda p: p.name)
def test_plpgsql_bodies_parse(path):
    pglast = pytest.importorskip("pglast")
    from pglast import ast

    sql = path.read_text(encoding="utf-8")
    for raw in pglast.parse_sql(sql):
        stmt = raw.stmt
        if isinstance(stmt, ast.CreateFunctionStmt):
            lang = next((o.arg.sval for o in stmt.options if o.defname == "language"), None)
            if lang == "plpgsql":
                start = raw.stmt_location or 0
                text = sql[start : start + raw.stmt_len] if raw.stmt_len else sql[start:]
                assert pglast.parse_plpgsql(text)
