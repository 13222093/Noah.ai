"""Normalized records and the sink contract shared by connectors and the store.

Connectors (``noah.connectors``) produce these records; the store
(``noah.store``) persists them. Both sides code against this module only, so
either can be replaced (for example by SCCIC ISSP's data hub, plan 03).

Field names follow the data model in ``docs/plan/03_TARGET_ARCHITECTURE.md``.
Conventions (guardrails 6, 7, 8):
- Every datetime is timezone-aware UTC (use ``noah.timeunits.ensure_utc``).
- Units are normalized before a record is built: water level in cm relative
  to the station datum, rainfall in mm, discharge in m3/s.
- Records are facts: the store appends them and never updates or deletes.
  A correction is a new record with ``supersedes_id`` set.
- Suspicious values are flagged through ``quality_flag``, never dropped.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Any, Protocol, Sequence

__all__ = [
    "QualityFlag",
    "RunStatus",
    "RawPayload",
    "Observation",
    "FloodReport",
    "RainProduct",
    "ConnectorRun",
    "Sink",
]


class QualityFlag(StrEnum):
    OK = "ok"
    SUSPECT = "suspect"  # outside the configured plausible range or a sudden jump
    MISSING_UNIT = "missing_unit"
    STALE = "stale"  # the source repeated an old timestamp
    MANUAL = "manual"  # entered or corrected by a person


class RunStatus(StrEnum):
    OK = "ok"
    PARTIAL = "partial"  # fetched, but some rows failed to parse
    FAILED = "failed"


@dataclass(frozen=True, slots=True)
class RawPayload:
    """One fetched response, stored verbatim in object storage."""

    source: str  # connector id, e.g. "s1_posko_banjir"
    fetched_at: datetime
    content: bytes
    content_type: str
    url: str | None = None


@dataclass(frozen=True, slots=True)
class Observation:
    """A row for ``observations``. The store resolves the station by
    ``(station_source, station_external_id)`` against ``stations``."""

    station_source: str
    station_external_id: str
    ts: datetime  # measurement time reported by the source, UTC
    value: float
    unit: str  # "cm", "mm", "m3/s"
    quality_flag: QualityFlag = QualityFlag.OK
    raw_ref: str | None = None  # key returned by Sink.write_raw
    supersedes_id: int | None = None


@dataclass(frozen=True, slots=True)
class FloodReport:
    """A row for ``flood_reports`` (BPBD RT reports, PetaBencana, ...).
    ``unit_code`` is the source's area code (e.g. an RT code); the store
    resolves it to ``spatial_units`` and keeps the code when it cannot."""

    source: str  # bpbd_rt | pasukan_biru | jaki | petabencana | cctv
    external_id: str
    unit_code: str | None
    ts_start: datetime
    ts_end: datetime | None
    depth_cm: float | None
    lon: float | None = None
    lat: float | None = None
    raw_ref: str | None = None
    meta: dict[str, Any] = field(default_factory=dict)
    supersedes_id: int | None = None


@dataclass(frozen=True, slots=True)
class RainProduct:
    """A row for ``rain_products``; the raster itself lives at ``uri``."""

    source: str
    issued_at: datetime
    valid_at: datetime
    kind: str  # nowcast | obs | nwp
    uri: str  # object-storage key of the image or grid
    meta: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class ConnectorRun:
    """One scheduled run of a connector; feeds ``/api/v1/health`` freshness."""

    connector: str
    started_at: datetime
    finished_at: datetime
    status: RunStatus
    rows_written: int = 0
    newest_ts: datetime | None = None  # newest source timestamp seen this run
    error: str | None = None  # short message, never a secret or full payload


class Sink(Protocol):
    """Where connectors write. Implementations: an in-memory sink for tests
    (``noah.connectors``) and the Postgres + object-storage store
    (``noah.store``). Every write method appends; none updates or deletes."""

    def write_raw(self, payload: RawPayload) -> str:
        """Store the payload verbatim and return its ``raw_ref`` key."""
        ...

    def write_observations(self, rows: Sequence[Observation]) -> int: ...

    def write_flood_reports(self, rows: Sequence[FloodReport]) -> int: ...

    def write_rain_products(self, rows: Sequence[RainProduct]) -> int: ...

    def record_run(self, run: ConnectorRun) -> None: ...
