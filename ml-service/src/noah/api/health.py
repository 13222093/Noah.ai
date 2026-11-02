"""Per-connector freshness for ``GET /api/v1/health`` (B-040).

``HealthSource`` is the read side of ``connector_runs``. Implementations:
``noah.connectors.memory.MemorySink`` (tests, dry runs) and the Postgres
store (``noah.store``), which reads the ``connector_runs`` table.

Freshness per connector (``HealthSpec.freshness``):
- ``data``: ``age_min`` = minutes since the newest *source* timestamp seen by
  the last successful run (a gauge that stops reporting goes stale even if
  our polling works). Used for S1 water levels and nowcast images.
- ``run``: ``age_min`` = minutes since the last successful run finished. Used
  for event sources (BPBD RTs, BMKG warnings, PetaBencana) where "nothing
  new" is the normal state.

``stale`` is ``age_min > stale_after_min`` (15 min unless the source cadence
is longer, e.g. hourly BPBD) or no successful run at all. The service is
healthy only if every enabled connector is fresh and its last run did not
fail. Disabled connectors (endpoint not configured) are listed but do not
count. Error texts from runs are never returned (guardrail 10/12): they stay
in ``connector_runs`` for operators with database access.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from typing import Literal, Protocol

from pydantic import BaseModel

from ..connectors.base import HealthSpec
from ..records import ConnectorRun, RunStatus
from ..timeunits import ensure_utc, to_iso_utc

__all__ = ["ConnectorHealth", "HealthResponse", "HealthSource", "compute_health"]


class HealthSource(Protocol):
    def recent_runs(self, connector: str, limit: int = 5) -> Sequence[ConnectorRun]:
        """Most recent runs of one connector, newest first."""
        ...

    def last_successful_run(self, connector: str) -> ConnectorRun | None:
        """Newest run with status ok or partial."""
        ...


class ConnectorHealth(BaseModel):
    enabled: bool
    freshness: Literal["data", "run"]
    stale_after_min: float
    last_run_at: str | None
    last_status: str | None  # ok | partial | failed | null (never ran)
    last_success_at: str | None
    newest_ts: str | None
    age_min: float | None
    consecutive_failures: int
    stale: bool


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    checked_at: str
    connectors: dict[str, ConnectorHealth]


def _iso(dt: datetime | None) -> str | None:
    return to_iso_utc(dt) if dt is not None else None


def _minutes(now: datetime, then: datetime | None) -> float | None:
    if then is None:
        return None
    return round((now - ensure_utc(then)).total_seconds() / 60.0, 1)


def compute_health(specs: Sequence[HealthSpec], source: HealthSource, now: datetime) -> HealthResponse:
    now = ensure_utc(now)
    out: dict[str, ConnectorHealth] = {}
    healthy = bool(specs)
    for spec in specs:
        runs = list(source.recent_runs(spec.connector, 5))
        last = runs[0] if runs else None
        success = source.last_successful_run(spec.connector)
        failures = 0
        for r in runs:
            if r.status is not RunStatus.FAILED:
                break
            failures += 1
        newest_ts = success.newest_ts if success else None
        if spec.freshness == "data":
            age = _minutes(now, newest_ts)
        else:
            age = _minutes(now, success.finished_at if success else None)
        stale = age is None or age > spec.stale_after_min
        failed = last is not None and last.status is RunStatus.FAILED
        if spec.enabled and (stale or failed):
            healthy = False
        out[spec.connector] = ConnectorHealth(
            enabled=spec.enabled,
            freshness=spec.freshness,
            stale_after_min=spec.stale_after_min,
            last_run_at=_iso(last.finished_at) if last else None,
            last_status=last.status.value if last else None,
            last_success_at=_iso(success.finished_at) if success else None,
            newest_ts=_iso(newest_ts),
            age_min=age,
            consecutive_failures=failures,
            stale=stale,
        )
    return HealthResponse(status="ok" if healthy else "degraded", checked_at=to_iso_utc(now), connectors=out)
