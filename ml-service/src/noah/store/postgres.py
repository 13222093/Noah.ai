"""``PostgresSink``: the store side of ``noah.records.Sink`` (B-031, B-033).

Raw payloads go to object storage (and are indexed in ``raw_payloads``);
normalized records go to Postgres. Every write is an INSERT with
``ON CONFLICT DO NOTHING``: a re-poll or re-import is a no-op, nothing is
ever updated, and the return value is the number of rows that were new.
The database triggers would reject an UPDATE or DELETE anyway.

Each method runs in its own transaction, so a batch is written entirely or
not at all.

Uniqueness (db/migrations/0003): observations are unique per
``(station_id, ts)`` and flood reports per ``(source, external_id,
ts_start)`` among original rows (``supersedes_id IS NULL``). The first
delivery wins; a re-poll, a restart or a repeated STALE reading adds
nothing. A changed value for an existing key must be sent as a correction
with ``supersedes_id`` set, otherwise it is silently ignored.

``PostgresSink`` (and ``PostgresHealthSource``) also implement
``noah.api.health.HealthSource`` over ``connector_runs``.
"""

from __future__ import annotations

import math
from typing import Any, Iterable, Sequence

from noah.records import (
    ConnectorRun,
    FloodReport,
    Observation,
    RainProduct,
    RawPayload,
    RunStatus,
)
from noah.store.objects import ObjectStore, raw_key
from noah.timeunits import ensure_utc

__all__ = ["PostgresSink", "PostgresHealthSource", "UnknownStationError"]

OBS_UNITS = frozenset({"cm", "mm", "m3/s"})


class UnknownStationError(LookupError):
    """Observations reference stations that are not in ``station_identifiers``.

    Nothing from the batch was written. Add the station (or an alias) to
    ``config/stations.yaml`` and apply it; never invent a station row here.
    """

    def __init__(self, missing: Iterable[tuple[str, str]]):
        self.missing = sorted(set(missing))
        shown = ", ".join(f"{s}:{e!r}" for s, e in self.missing[:10])
        more = f" (+{len(self.missing) - 10} more)" if len(self.missing) > 10 else ""
        super().__init__(f"unknown stations: {shown}{more}")


_INSERT_RAW = """
INSERT INTO raw_payloads (key, source, fetched_at, sha256, size_bytes, content_type, url)
VALUES (%s, %s, %s, %s, %s, %s, %s)
ON CONFLICT DO NOTHING
"""

_INSERT_OBS = """
INSERT INTO observations (station_id, ts, value, unit, quality_flag, raw_ref, supersedes_id)
SELECT * FROM unnest(%s::bigint[], %s::timestamptz[], %s::float8[], %s::text[],
                     %s::text[], %s::text[], %s::bigint[])
ON CONFLICT DO NOTHING
"""

_INSERT_FLOOD = """
INSERT INTO flood_reports (source, external_id, unit_id, unit_code, ts_start, ts_end,
                           depth_cm, geom, meta, raw_ref, supersedes_id)
VALUES (%(source)s, %(external_id)s, %(unit_id)s, %(unit_code)s, %(ts_start)s, %(ts_end)s,
        %(depth_cm)s,
        CASE WHEN %(lon)s::float8 IS NULL OR %(lat)s::float8 IS NULL THEN NULL
             ELSE ST_SetSRID(ST_MakePoint(%(lon)s::float8, %(lat)s::float8), 4326) END,
        %(meta)s, %(raw_ref)s, %(supersedes_id)s)
ON CONFLICT DO NOTHING
"""

_INSERT_RAIN = """
INSERT INTO rain_products (source, issued_at, valid_at, kind, uri, meta)
VALUES (%s, %s, %s, %s, %s, %s)
ON CONFLICT DO NOTHING
"""

_INSERT_RUN = """
INSERT INTO connector_runs (connector, started_at, finished_at, status, rows_written, newest_ts, error)
VALUES (%s, %s, %s, %s, %s, %s, %s)
ON CONFLICT DO NOTHING
"""


_RUN_COLUMNS = "connector, started_at, finished_at, status, rows_written, newest_ts, error"


def _opt_utc(dt: Any) -> Any:
    return None if dt is None else ensure_utc(dt)


def _run_from_row(row: Sequence[Any]) -> ConnectorRun:
    connector, started_at, finished_at, status, rows_written, newest_ts, error = row
    return ConnectorRun(
        connector=connector,
        started_at=ensure_utc(started_at),
        finished_at=ensure_utc(finished_at),
        status=RunStatus(status),
        rows_written=rows_written,
        newest_ts=_opt_utc(newest_ts),
        error=error,
    )


class PostgresHealthSource:
    """``noah.api.health.HealthSource`` over the ``connector_runs`` table.
    Read-only. ``error`` is returned to the caller as stored; ``compute_health``
    never exposes it in the API response."""

    def __init__(self, conn: Any):
        self.conn = conn

    def recent_runs(self, connector: str, limit: int = 5) -> Sequence[ConnectorRun]:
        rows = self.conn.execute(
            f"SELECT {_RUN_COLUMNS} FROM connector_runs WHERE connector = %s "
            "ORDER BY finished_at DESC, id DESC LIMIT %s",
            (connector, max(int(limit), 0)),
        ).fetchall()
        return [_run_from_row(r) for r in rows]

    def last_successful_run(self, connector: str) -> ConnectorRun | None:
        row = self.conn.execute(
            f"SELECT {_RUN_COLUMNS} FROM connector_runs WHERE connector = %s AND status IN ('ok', 'partial') "
            "ORDER BY finished_at DESC, id DESC LIMIT 1",
            (connector,),
        ).fetchone()
        return _run_from_row(row) if row else None


class PostgresSink:
    """``Sink`` backed by a psycopg 3 connection and an ``ObjectStore``."""

    def __init__(self, conn: Any, objects: ObjectStore, *, chunk_size: int = 5000):
        self.conn = conn
        self.objects = objects
        self.chunk_size = chunk_size
        self._station_cache: dict[tuple[str, str], int] = {}

    # -- raw payloads -----------------------------------------------------

    def write_raw(self, payload: RawPayload) -> str:
        key = raw_key(payload)
        stored = self.objects.put(key, payload.content, payload.content_type)
        with self.conn.transaction():
            self.conn.execute(
                _INSERT_RAW,
                (
                    key,
                    payload.source,
                    ensure_utc(payload.fetched_at),
                    stored.sha256,
                    stored.size_bytes,
                    payload.content_type,
                    payload.url,
                ),
            )
        return key

    # -- observations -----------------------------------------------------

    def resolve_stations(self, pairs: Iterable[tuple[str, str]]) -> dict[tuple[str, str], int]:
        wanted = {p for p in pairs if p not in self._station_cache}
        if wanted:
            sources = [s for s, _ in wanted]
            externals = [e for _, e in wanted]
            rows = self.conn.execute(
                """
                SELECT si.source, si.external_id, si.station_id
                FROM station_identifiers si
                JOIN unnest(%s::text[], %s::text[]) AS w(source, external_id)
                  ON w.source = si.source AND w.external_id = si.external_id
                """,
                (sources, externals),
            ).fetchall()
            for source, external_id, station_id in rows:
                self._station_cache[(source, external_id)] = station_id
        return {p: self._station_cache[p] for p in pairs if p in self._station_cache}

    def write_observations(self, rows: Sequence[Observation]) -> int:
        if not rows:
            return 0
        pairs = {(r.station_source, r.station_external_id) for r in rows}
        ids = self.resolve_stations(pairs)
        missing = pairs - ids.keys()
        if missing:
            raise UnknownStationError(missing)
        for r in rows:
            if r.unit not in OBS_UNITS:
                raise ValueError(f"unit {r.unit!r} is not normalized (expected cm, mm or m3/s)")
            if isinstance(r.value, float) and math.isinf(r.value):
                raise ValueError("infinite observation value")
        written = 0
        with self.conn.transaction():
            for i in range(0, len(rows), self.chunk_size):
                chunk = rows[i : i + self.chunk_size]
                cur = self.conn.execute(
                    _INSERT_OBS,
                    (
                        [ids[(r.station_source, r.station_external_id)] for r in chunk],
                        [ensure_utc(r.ts) for r in chunk],
                        [float(r.value) for r in chunk],
                        [r.unit for r in chunk],
                        [str(r.quality_flag) for r in chunk],
                        [r.raw_ref for r in chunk],
                        [r.supersedes_id for r in chunk],
                    ),
                )
                written += max(cur.rowcount, 0)
        return written

    # -- flood reports ----------------------------------------------------

    def _resolve_units(self, codes: set[str]) -> dict[str, int]:
        """Map a source area code to a spatial unit only when exactly one
        unit carries it; otherwise keep the code and leave unit_id NULL."""
        if not codes:
            return {}
        rows = self.conn.execute(
            "SELECT code, min(id), count(*) FROM spatial_units WHERE code = ANY(%s) GROUP BY code",
            (sorted(codes),),
        ).fetchall()
        return {code: uid for code, uid, n in rows if n == 1}

    def write_flood_reports(self, rows: Sequence[FloodReport]) -> int:
        if not rows:
            return 0
        from psycopg.types.json import Jsonb

        units = self._resolve_units({r.unit_code for r in rows if r.unit_code})
        written = 0
        with self.conn.transaction():
            with self.conn.cursor() as cur:
                for r in rows:
                    cur.execute(
                        _INSERT_FLOOD,
                        {
                            "source": r.source,
                            "external_id": r.external_id,
                            "unit_id": units.get(r.unit_code) if r.unit_code else None,
                            "unit_code": r.unit_code,
                            "ts_start": ensure_utc(r.ts_start),
                            "ts_end": _opt_utc(r.ts_end),
                            "depth_cm": r.depth_cm,
                            "lon": r.lon,
                            "lat": r.lat,
                            "meta": Jsonb(dict(r.meta)),
                            "raw_ref": r.raw_ref,
                            "supersedes_id": r.supersedes_id,
                        },
                    )
                    written += max(cur.rowcount, 0)
        return written

    # -- rain products ----------------------------------------------------

    def write_rain_products(self, rows: Sequence[RainProduct]) -> int:
        if not rows:
            return 0
        from psycopg.types.json import Jsonb

        written = 0
        with self.conn.transaction():
            with self.conn.cursor() as cur:
                for r in rows:
                    cur.execute(
                        _INSERT_RAIN,
                        (r.source, ensure_utc(r.issued_at), ensure_utc(r.valid_at), r.kind, r.uri, Jsonb(dict(r.meta))),
                    )
                    written += max(cur.rowcount, 0)
        return written

    # -- connector runs (write) and health (read) --------------------------

    def recent_runs(self, connector: str, limit: int = 5) -> Sequence[ConnectorRun]:
        return PostgresHealthSource(self.conn).recent_runs(connector, limit)

    def last_successful_run(self, connector: str) -> ConnectorRun | None:
        return PostgresHealthSource(self.conn).last_successful_run(connector)

    def record_run(self, run: ConnectorRun) -> None:
        with self.conn.transaction():
            self.conn.execute(
                _INSERT_RUN,
                (
                    run.connector,
                    ensure_utc(run.started_at),
                    ensure_utc(run.finished_at),
                    str(run.status),
                    run.rows_written,
                    _opt_utc(run.newest_ts),
                    (run.error or None) and run.error[:500],
                ),
            )
