"""In-memory ``Sink`` and ``HealthSource`` for tests and ``--dry-run``.

Nothing leaves the process. It mirrors the append-only contract of the real
store (``noah.store``): every write appends, nothing is updated or deleted.
"""

from __future__ import annotations

import hashlib
from collections.abc import Sequence
from dataclasses import dataclass, field

from ..records import ConnectorRun, FloodReport, Observation, RainProduct, RawPayload, RunStatus
from ..timeunits import ensure_utc

__all__ = ["MemorySink"]

_EXT = {
    "text/html": "html",
    "application/json": "json",
    "application/geo+json": "json",
    "application/xml": "xml",
    "text/xml": "xml",
    "application/rss+xml": "xml",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
}


def raw_key(payload: RawPayload) -> str:
    """Deterministic object-storage style key: ``raw/<source>/<YYYY/MM/DD>/<HHMMSS>-<sha12>.<ext>``."""
    ts = ensure_utc(payload.fetched_at)
    digest = hashlib.sha256(payload.content).hexdigest()[:12]
    base_type = payload.content_type.split(";", 1)[0].strip().lower()
    ext = _EXT.get(base_type, "bin")
    return f"raw/{payload.source}/{ts:%Y/%m/%d}/{ts:%H%M%S}-{digest}.{ext}"


@dataclass
class MemorySink:
    raw: dict[str, RawPayload] = field(default_factory=dict)
    observations: list[Observation] = field(default_factory=list)
    flood_reports: list[FloodReport] = field(default_factory=list)
    rain_products: list[RainProduct] = field(default_factory=list)
    runs: list[ConnectorRun] = field(default_factory=list)

    # --- Sink -------------------------------------------------------------
    def write_raw(self, payload: RawPayload) -> str:
        key = raw_key(payload)
        self.raw.setdefault(key, payload)  # same bytes at the same second: same object
        return key

    def write_observations(self, rows: Sequence[Observation]) -> int:
        self.observations.extend(rows)
        return len(rows)

    def write_flood_reports(self, rows: Sequence[FloodReport]) -> int:
        self.flood_reports.extend(rows)
        return len(rows)

    def write_rain_products(self, rows: Sequence[RainProduct]) -> int:
        self.rain_products.extend(rows)
        return len(rows)

    def record_run(self, run: ConnectorRun) -> None:
        self.runs.append(run)

    # --- HealthSource -----------------------------------------------------
    def recent_runs(self, connector: str, limit: int = 5) -> Sequence[ConnectorRun]:
        mine = [r for r in self.runs if r.connector == connector]
        mine.sort(key=lambda r: r.finished_at, reverse=True)
        return mine[:limit]

    def last_successful_run(self, connector: str) -> ConnectorRun | None:
        ok = [r for r in self.runs if r.connector == connector and r.status is not RunStatus.FAILED]
        return max(ok, key=lambda r: r.finished_at, default=None)

    # --- helpers ----------------------------------------------------------
    def counts(self) -> dict[str, int]:
        return {
            "raw": len(self.raw),
            "observations": len(self.observations),
            "flood_reports": len(self.flood_reports),
            "rain_products": len(self.rain_products),
            "runs": len(self.runs),
        }
