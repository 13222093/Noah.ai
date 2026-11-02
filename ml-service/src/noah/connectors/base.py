"""Connector framework (B-035).

A connector is one public source polled on a fixed interval. One run is:

    fetch (conditional GET, identified User-Agent, timeout)
      -> sink.write_raw(payload)            raw bytes verbatim, returns raw_ref
      -> parse(content) -> normalized rows   units and UTC fixed here, flags set
      -> drop rows already written           idempotent re-poll
      -> sink.write_*(rows)                  append only
      -> sink.record_run(ConnectorRun)       feeds /api/v1/health

Rules this module enforces (docs/plan/04_DATA_SOURCES.md "Rules for
connectors", guardrails 4, 7, 8, 12):

- A run never raises. Any exception becomes a ``FAILED`` run with a short,
  URL-free error message, so one connector cannot stop the others.
- The poll interval can never be set below the source cadence
  (``min_interval_s``). Backoff after failures only ever lengthens it.
- Backoff jitter is derived from a SHA-256 hash of the connector id and the
  failure count, not from a random generator (guardrail 5 bans unseeded
  randomness in production paths; the hash also makes schedules testable).
- Suspicious values are flagged, never dropped.
"""

from __future__ import annotations

import hashlib
import logging
import os
import re
from abc import ABC, abstractmethod
from collections import OrderedDict
from collections.abc import Callable, Hashable, Mapping, Sequence
from dataclasses import dataclass, field, replace
from datetime import datetime, timedelta
from email.utils import parsedate_to_datetime
from typing import Literal, Protocol

from ..records import (
    ConnectorRun,
    FloodReport,
    Observation,
    QualityFlag,
    RainProduct,
    RawPayload,
    RunStatus,
    Sink,
)
from ..timeunits import UTC, ensure_utc, utc_now

__all__ = [
    "Connector",
    "FetchError",
    "FetchResponse",
    "Fetcher",
    "HealthSpec",
    "HttpxFetcher",
    "ParseError",
    "ParseResult",
    "Range",
    "backoff_delay_s",
    "combine_flags",
    "is_stale",
    "range_flag",
    "safe_error",
    "user_agent",
]

logger = logging.getLogger("noah.connectors")

USER_AGENT_PRODUCT = "NoahAI/0.1"
CONTACT_PLACEHOLDER = "set NOAH_CONTACT_EMAIL"
MAX_RESPONSE_BYTES = 10 * 1024 * 1024


def user_agent(env: Mapping[str, str] | None = None) -> str:
    """``NoahAI/0.1 (+contact: <NOAH_CONTACT_EMAIL>)``; a placeholder when unset."""
    env = os.environ if env is None else env
    contact = env.get("NOAH_CONTACT_EMAIL", "").strip()
    # Keep the header well formed whatever the variable holds.
    contact = re.sub(r"[^\w.@+\-]", "", contact)[:120] or CONTACT_PLACEHOLDER
    return f"{USER_AGENT_PRODUCT} (+contact: {contact})"


# --------------------------------------------------------------------------
# HTTP
# --------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class FetchResponse:
    status_code: int
    content: bytes
    content_type: str
    url: str
    fetched_at: datetime
    headers: Mapping[str, str] = field(default_factory=dict)

    def header(self, name: str) -> str | None:
        lname = name.lower()
        for k, v in self.headers.items():
            if k.lower() == lname:
                return v
        return None


class Fetcher(Protocol):
    def get(self, url: str, *, headers: Mapping[str, str], timeout: float) -> FetchResponse: ...


class HttpxFetcher:
    """Production fetcher. One shared client, bounded redirects and body size."""

    def __init__(self, client: object | None = None) -> None:
        import httpx  # imported lazily so parsers and tests do not need it

        self._httpx = httpx
        self._client = client or httpx.Client(follow_redirects=True, max_redirects=3)

    def get(self, url: str, *, headers: Mapping[str, str], timeout: float) -> FetchResponse:
        r = self._client.get(url, headers=dict(headers), timeout=timeout)  # type: ignore[attr-defined]
        content = r.content
        if len(content) > MAX_RESPONSE_BYTES:
            raise FetchError(f"response larger than {MAX_RESPONSE_BYTES} bytes")
        return FetchResponse(
            status_code=r.status_code,
            content=content,
            content_type=r.headers.get("content-type", "application/octet-stream"),
            url=str(r.url),
            fetched_at=utc_now(),
            headers=dict(r.headers),
        )


class FetchError(Exception):
    def __init__(self, message: str, *, retry_after_s: float | None = None) -> None:
        super().__init__(message)
        self.retry_after_s = retry_after_s


class ParseError(Exception):
    """The payload does not have the structure the parser was written against."""


def _retry_after(value: str | None, now: datetime) -> float | None:
    if not value:
        return None
    value = value.strip()
    if value.isdigit():
        return float(value)
    try:
        when = parsedate_to_datetime(value)
    except (TypeError, ValueError):
        return None
    if when.tzinfo is None:
        when = when.replace(tzinfo=UTC)
    return max(0.0, (when - now).total_seconds())


_URL_RE = re.compile(r"https?://\S+")


def safe_error(exc: BaseException, limit: int = 200) -> str:
    """Short error text for ``connector_runs``: type and message, URLs removed."""
    text = _URL_RE.sub("<url>", str(exc)).replace("\n", " ").strip()
    out = f"{type(exc).__name__}: {text}" if text else type(exc).__name__
    return out[:limit]


# --------------------------------------------------------------------------
# Backoff
# --------------------------------------------------------------------------


def _unit_hash(key: str) -> float:
    """Deterministic value in [0, 1) from a string."""
    digest = hashlib.sha256(key.encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "big") / 2**64


def backoff_delay_s(
    interval_s: float,
    consecutive_failures: int,
    *,
    key: str,
    cap_s: float = 3600.0,
    retry_after_s: float | None = None,
) -> float:
    """Seconds until the next run.

    No failures: ``interval_s``. After ``n`` consecutive failures:
    ``min(cap, interval * 2**n)`` times a jitter factor in [1.0, 1.25) taken
    from ``sha256(key:n)``. The result is never below ``interval_s`` (the
    source cadence) and never below a server's ``Retry-After``.
    """
    if interval_s <= 0:
        raise ValueError("interval_s must be positive")
    if consecutive_failures <= 0:
        delay = float(interval_s)
    else:
        exp = min(consecutive_failures, 32)
        raw = min(cap_s, interval_s * (2**exp))
        delay = min(cap_s, raw * (1.0 + 0.25 * _unit_hash(f"{key}:{consecutive_failures}")))
        delay = max(float(interval_s), delay)
    if retry_after_s is not None:
        delay = max(delay, float(retry_after_s))
    return delay


# --------------------------------------------------------------------------
# Quality
# --------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class Range:
    lo: float
    hi: float

    def contains(self, value: float) -> bool:
        return self.lo <= value <= self.hi


def range_flag(value: float, rng: Range | None) -> QualityFlag:
    if value != value:  # NaN
        return QualityFlag.SUSPECT
    if rng is not None and not rng.contains(value):
        return QualityFlag.SUSPECT
    return QualityFlag.OK


def is_stale(ts: datetime, fetched_at: datetime, max_age: timedelta) -> bool:
    """True when the source reports a measurement time older than ``max_age``."""
    return ensure_utc(fetched_at) - ensure_utc(ts) > max_age


_FLAG_PRIORITY = {
    QualityFlag.MISSING_UNIT: 4,
    QualityFlag.SUSPECT: 3,
    QualityFlag.STALE: 2,
    QualityFlag.MANUAL: 1,
    QualityFlag.OK: 0,
}


def combine_flags(*flags: QualityFlag) -> QualityFlag:
    """One flag per row: MISSING_UNIT > SUSPECT > STALE > MANUAL > OK."""
    return max(flags, key=_FLAG_PRIORITY.__getitem__, default=QualityFlag.OK)


# --------------------------------------------------------------------------
# Connector
# --------------------------------------------------------------------------


@dataclass
class ParseResult:
    observations: list[Observation] = field(default_factory=list)
    flood_reports: list[FloodReport] = field(default_factory=list)
    rain_products: list[RainProduct] = field(default_factory=list)
    row_errors: int = 0  # rows that could not be parsed (run becomes PARTIAL)
    skipped: int = 0  # rows deliberately ignored (wrong disaster type, outside DKI)
    newest_ts: datetime | None = None

    @property
    def total(self) -> int:
        return len(self.observations) + len(self.flood_reports) + len(self.rain_products)


@dataclass(frozen=True, slots=True)
class HealthSpec:
    """What ``/api/v1/health`` needs to know about a connector.

    ``freshness="data"``: age is measured from the newest source timestamp
    (a gauge that stops reporting is stale even if our poll works).
    ``freshness="run"``: age is measured from the last successful run; for
    event sources (reports, warnings) where silence is normal.
    """

    connector: str
    enabled: bool
    interval_s: int
    stale_after_min: float = 15.0
    freshness: Literal["data", "run"] = "data"


_SEEN_LIMIT = 50_000


class Connector(ABC):
    id: str = ""
    url: str = ""
    #: Source cadence; the configured interval may never be shorter.
    min_interval_s: int = 300
    timeout_s: float = 20.0
    accept: str = "*/*"
    freshness: Literal["data", "run"] = "data"
    stale_after_min: float = 15.0

    def __init__(
        self,
        *,
        fetcher: Fetcher | None = None,
        clock: Callable[[], datetime] = utc_now,
        interval_s: int | None = None,
        env: Mapping[str, str] | None = None,
    ) -> None:
        if not self.id:
            raise TypeError("connector subclasses must set id")
        interval = self.min_interval_s if interval_s is None else int(interval_s)
        if interval < self.min_interval_s:
            raise ValueError(
                f"{self.id}: interval {interval}s is faster than the source cadence {self.min_interval_s}s"
            )
        self.interval_s = interval
        self._env = os.environ if env is None else env
        self._fetcher = fetcher
        self.clock = clock
        # Conditional GET validators and the last body digest, per connector.
        self._etag: str | None = None
        self._last_modified: str | None = None
        self._last_digest: str | None = None
        self._last_newest_ts: datetime | None = None
        # Idempotent re-poll: newest ts written per station, keys of reports/products written.
        self._obs_last_ts: dict[tuple[str, str], datetime] = {}
        self._seen: OrderedDict[Hashable, None] = OrderedDict()
        self.last_retry_after_s: float | None = None

    # --- configuration ----------------------------------------------------
    @property
    def enabled(self) -> bool:
        return bool(self.url)

    @property
    def fetcher(self) -> Fetcher:
        if self._fetcher is None:
            self._fetcher = HttpxFetcher()
        return self._fetcher

    def health_spec(self) -> HealthSpec:
        return HealthSpec(
            connector=self.id,
            enabled=self.enabled,
            interval_s=self.interval_s,
            stale_after_min=self.stale_after_min,
            freshness=self.freshness,
        )

    def request_headers(self) -> dict[str, str]:
        headers = {"User-Agent": user_agent(self._env), "Accept": self.accept}
        if self._etag:
            headers["If-None-Match"] = self._etag
        if self._last_modified:
            headers["If-Modified-Since"] = self._last_modified
        return headers

    # --- one run ----------------------------------------------------------
    def fetch(self) -> FetchResponse | None:
        """GET the source. ``None`` means unchanged (304 or identical body)."""
        resp = self.fetcher.get(self.url, headers=self.request_headers(), timeout=self.timeout_s)
        self.last_retry_after_s = None
        if resp.status_code == 304:
            return None
        if resp.status_code in (429, 503):
            self.last_retry_after_s = _retry_after(resp.header("Retry-After"), resp.fetched_at)
            raise FetchError(f"HTTP {resp.status_code}", retry_after_s=self.last_retry_after_s)
        if not 200 <= resp.status_code < 300:
            raise FetchError(f"HTTP {resp.status_code}")
        if hashlib.sha256(resp.content).hexdigest() == self._last_digest:
            return None
        return resp

    @abstractmethod
    def parse(self, content: bytes, *, fetched_at: datetime, raw_ref: str | None) -> ParseResult:
        """Turn one payload into normalized records. Raise ``ParseError`` on a
        structural mismatch; count unparseable rows in ``row_errors``."""

    def run(self, sink: Sink) -> ConnectorRun:
        """One isolated run. Never raises; the outcome is in the returned run."""
        started = ensure_utc(self.clock())
        status, rows, newest, error = RunStatus.FAILED, 0, self._last_newest_ts, None
        try:
            resp = self.fetch()
            if resp is None:
                status = RunStatus.OK
            else:
                raw_ref = sink.write_raw(
                    RawPayload(
                        source=self.id,
                        fetched_at=resp.fetched_at,
                        content=resp.content,
                        content_type=resp.content_type,
                        url=resp.url,
                    )
                )
                result = self.parse(resp.content, fetched_at=resp.fetched_at, raw_ref=raw_ref)
                fresh, commit = self._drop_already_written(result)
                if fresh.observations:
                    rows += sink.write_observations(fresh.observations)
                if fresh.flood_reports:
                    rows += sink.write_flood_reports(fresh.flood_reports)
                if fresh.rain_products:
                    rows += sink.write_rain_products(fresh.rain_products)
                commit()
                if result.newest_ts is not None and (newest is None or result.newest_ts > newest):
                    newest = result.newest_ts
                self._last_newest_ts = newest
                self._etag = resp.header("ETag")
                self._last_modified = resp.header("Last-Modified")
                self._last_digest = hashlib.sha256(resp.content).hexdigest()
                status = RunStatus.PARTIAL if result.row_errors else RunStatus.OK
        except Exception as exc:  # isolation: nothing escapes a run
            error = safe_error(exc)
            logger.warning("connector %s failed: %s", self.id, error)
        run = ConnectorRun(
            connector=self.id,
            started_at=started,
            finished_at=ensure_utc(self.clock()),
            status=status,
            rows_written=rows,
            newest_ts=newest,
            error=error,
        )
        try:
            sink.record_run(run)
        except Exception as exc:
            logger.error("connector %s: record_run failed: %s", self.id, safe_error(exc))
        return run

    # --- idempotency ------------------------------------------------------
    def report_key(self, row: FloodReport) -> Hashable:
        return ("fr", row.source, row.external_id, row.ts_start)

    def product_key(self, row: RainProduct) -> Hashable:
        return ("rp", row.source, row.meta.get("identifier", row.uri), row.issued_at, row.valid_at)

    def _drop_already_written(self, result: ParseResult) -> tuple[ParseResult, Callable[[], None]]:
        """Filter rows this connector already wrote; the returned ``commit``
        marks the rest as written once the sink calls succeeded.

        Observations: per station only timestamps newer than the last one
        written pass (a source repeating an old reading writes nothing new).
        The store should still enforce uniqueness, because this memory does
        not survive a restart.
        """
        obs: list[Observation] = []
        new_last: dict[tuple[str, str], datetime] = {}
        for o in result.observations:
            key = (o.station_source, o.station_external_id)
            last = new_last.get(key, self._obs_last_ts.get(key))
            if last is not None and o.ts <= last:
                continue
            obs.append(o)
            new_last[key] = o.ts
        reports, products, keys = [], [], []
        for r in result.flood_reports:
            k = self.report_key(r)
            if k in self._seen or k in keys:
                continue
            reports.append(r)
            keys.append(k)
        for p in result.rain_products:
            k = self.product_key(p)
            if k in self._seen or k in keys:
                continue
            products.append(p)
            keys.append(k)

        def commit() -> None:
            self._obs_last_ts.update(new_last)
            for k in keys:
                self._seen[k] = None
            while len(self._seen) > _SEEN_LIMIT:
                self._seen.popitem(last=False)

        fresh = replace(result, observations=obs, flood_reports=reports, rain_products=products)
        return fresh, commit


def newest(timestamps: Sequence[datetime | None]) -> datetime | None:
    present = [t for t in timestamps if t is not None]
    return max(present) if present else None
