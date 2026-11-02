"""Import the S2 Open Data Jakarta TMA archive ``tma_2020.xlsx.csv`` (B-041).

Source: S2 (``docs/plan/04_DATA_SOURCES.md``), 21 DSDA posts, 2019-12-23 to
2020-01-31. Columns: ``nama_pintu_air, lokasi, latitude, longitude, tanggal,
tinggi_air, status_siaga``.

Conclusions about the file (evidence in ``docs/data/s2_tma_2020.md``):

- ``tinggi_air`` is in **millimetres** at 1 cm resolution: every value is a
  multiple of 10, Manggarai spans 4870 to 9690 (487 to 969 cm), and the
  ``status_siaga`` labels change exactly at 7500 / 8510 / 9520 mm, which
  bracket DSDA's official 750 / 850 / 950 cm. The live S1 page confirms the
  scale: its raw field is mm (Manggarai 5340 next to a table value of 534 cm,
  raw Siaga values 9500/8500/7500). Converted to cm here.
- ``tanggal`` is naive local time, taken as WIB (UTC+7) and stored as UTC.
  Pending DSDA confirmation (audit Q11).
- The file is a series of snapshots of the Posko Banjir table: every post
  has exactly 1479 rows, and a post that did not update repeats its last
  reading. A repeated (post, timestamp) is the same fact: one observation
  is emitted, the repeats are counted in the report, and the raw file in
  object storage keeps every copy. The database enforces one original row
  per (station, ts), so a re-import is a no-op.

Quality flags (flag, never drop):
- ``suspect``: negative level at a post whose config does not allow it,
  an isolated spike (see ``QcConfig``), or two different values for the same
  post and timestamp (the first value in file order is kept, flagged).

CLI::

    python -m noah.importers.s2_tma_2020 --dry-run
    python -m noah.importers.s2_tma_2020 --derive-thresholds
    python -m noah.importers.s2_tma_2020            # writes via PostgresSink
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import math
import os
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

from noah.records import (
    ConnectorRun,
    FloodReport,
    Observation,
    QualityFlag,
    RainProduct,
    RawPayload,
    RunStatus,
    Sink,
)
from noah.timeunits import UTC, length_to_cm, parse_wib_local, utc_now

__all__ = [
    "SOURCE",
    "CONNECTOR",
    "DEFAULT_PATH",
    "ARCHIVE_FETCHED_AT",
    "S2Row",
    "ParseError",
    "ImportReport",
    "LevelDerivation",
    "normalize_label",
    "parse_status",
    "parse_rows",
    "build_observations",
    "derive_siaga_thresholds",
    "run_import",
    "DryRunSink",
]

SOURCE = "s2_opendata"
CONNECTOR = "s2_tma_2020_import"
SOURCE_UNIT = "mm"
EXPECTED_COLUMNS = (
    "nama_pintu_air",
    "lokasi",
    "latitude",
    "longitude",
    "tanggal",
    "tinggi_air",
    "status_siaga",
)
# ml-service/src/noah/importers/s2_tma_2020.py -> ml-service/data/
DEFAULT_PATH = Path(__file__).resolve().parents[3] / "data" / "tma_2020.xlsx.csv"
# The archive has no download timestamp. The earliest evidence that the
# project held it is the commit that added it (5f0fa0e, 2026-03-01 17:30:58
# WIB). A fixed value keeps the raw_ref deterministic, so re-imports are no-ops.
ARCHIVE_FETCHED_AT = datetime(2026, 3, 1, 10, 30, 58, tzinfo=UTC)

_STATUS = {
    "normal": "normal",
    "siaga 3": "siaga_3",
    "siaga 2": "siaga_2",
    "siaga 1": "siaga_1",
}
_ORDER = ("normal", "siaga_3", "siaga_2", "siaga_1")


@dataclass(frozen=True, slots=True)
class S2Row:
    line: int  # 1-based line in the file (header is line 1)
    label: str  # normalized nama_pintu_air
    river: str
    lat: float | None
    lon: float | None
    ts: datetime  # UTC
    value_mm: float
    status: str | None  # normal | siaga_3 | siaga_2 | siaga_1 | None if unreadable


@dataclass(frozen=True, slots=True)
class ParseError:
    line: int
    reason: str


@dataclass
class ImportReport:
    rows_read: int = 0
    rows_unparsed: int = 0
    posts: int = 0
    observations: int = 0
    by_flag: Counter = field(default_factory=Counter)
    suspect_reasons: Counter = field(default_factory=Counter)
    repeated_rows: int = 0  # rows that repeated an earlier (post, ts, value)
    conflicting_keys: int = 0  # (post, ts) with more than one distinct value
    per_post: dict[str, dict[str, int]] = field(default_factory=dict)
    ts_min: datetime | None = None
    ts_max: datetime | None = None
    written: int | None = None  # rows the sink reported as new (None in a pure build)
    raw_ref: str | None = None
    errors: list[ParseError] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return {
            "rows_read": self.rows_read,
            "rows_unparsed": self.rows_unparsed,
            "posts": self.posts,
            "observations": self.observations,
            "by_flag": dict(self.by_flag),
            "suspect_reasons": dict(self.suspect_reasons),
            "repeated_rows": self.repeated_rows,
            "conflicting_keys": self.conflicting_keys,
            "ts_min_utc": self.ts_min.isoformat() if self.ts_min else None,
            "ts_max_utc": self.ts_max.isoformat() if self.ts_max else None,
            "written": self.written,
            "raw_ref": self.raw_ref,
            "first_errors": [f"line {e.line}: {e.reason}" for e in self.errors[:10]],
            "per_post": self.per_post,
        }


def normalize_label(label: str) -> str:
    """``"P.A. Istiqlal  "`` -> ``"P.A. Istiqlal"`` (trim, collapse spaces)."""
    return " ".join(label.split())


def parse_status(text: str) -> str | None:
    """``"Status : Siaga 3"`` -> ``"siaga_3"``; unknown text -> None."""
    t = " ".join(text.split()).lower()
    if t.startswith("status"):
        t = t[len("status") :].lstrip(" :")
    return _STATUS.get(t)


def _float_or_none(text: str) -> float | None:
    text = text.strip()
    if not text:
        return None
    value = float(text)
    return None if math.isnan(value) else value


def parse_rows(text: str) -> tuple[list[S2Row], list[ParseError]]:
    """Parse the CSV. Bad rows are reported, not raised, and never guessed."""
    reader = csv.reader(io.StringIO(text))
    try:
        header = next(reader)
    except StopIteration:
        return [], [ParseError(1, "empty file")]
    header = [h.strip().lstrip("﻿") for h in header]
    if tuple(header) != EXPECTED_COLUMNS:
        raise ValueError(f"unexpected header {header}; expected {list(EXPECTED_COLUMNS)}")
    rows: list[S2Row] = []
    errors: list[ParseError] = []
    for line, rec in enumerate(reader, start=2):
        if not rec or all(not c.strip() for c in rec):
            continue
        if len(rec) != len(EXPECTED_COLUMNS):
            errors.append(ParseError(line, f"expected {len(EXPECTED_COLUMNS)} fields, got {len(rec)}"))
            continue
        name, river, lat, lon, tanggal, tinggi, status = rec
        label = normalize_label(name)
        if not label:
            errors.append(ParseError(line, "empty nama_pintu_air"))
            continue
        try:
            ts = parse_wib_local(tanggal)
        except ValueError as exc:
            errors.append(ParseError(line, f"bad tanggal {tanggal!r}: {exc}"))
            continue
        try:
            value = _float_or_none(tinggi)
        except ValueError:
            errors.append(ParseError(line, f"bad tinggi_air {tinggi!r}"))
            continue
        if value is None:
            errors.append(ParseError(line, "missing tinggi_air (gap recorded, not filled)"))
            continue
        try:
            lat_f, lon_f = _float_or_none(lat), _float_or_none(lon)
        except ValueError:
            lat_f = lon_f = None
        rows.append(
            S2Row(
                line=line,
                label=label,
                river=" ".join(river.split()),
                lat=lat_f,
                lon=lon_f,
                ts=ts,
                value_mm=value,
                status=parse_status(status),
            )
        )
    return rows, errors


# --------------------------------------------------------------------------
# Normalization and flags
# --------------------------------------------------------------------------


def build_observations(
    rows: Sequence[S2Row],
    *,
    raw_ref: str | None = None,
    allows_negative: Mapping[str, bool] | None = None,
    spike_cm: float = 100.0,
    spike_max_gap: timedelta = timedelta(minutes=180),
    station_source: str = SOURCE,
) -> tuple[list[Observation], ImportReport]:
    """Turn parsed rows into ``Observation`` records (cm, UTC) with flags.

    Exactly one observation per (post, timestamp), matching the database key
    ``observations (station_id, ts)``. Exact repeats are counted in
    ``repeated_rows``. Several distinct values for one timestamp keep the
    first in file order, flagged ``suspect``; the others are counted in
    ``conflicting_keys`` and remain in the raw file.
    """
    allows_negative = allows_negative or {}
    report = ImportReport(rows_read=len(rows))
    by_post: dict[str, list[S2Row]] = defaultdict(list)
    for r in rows:
        by_post[r.label].append(r)
    report.posts = len(by_post)

    out: list[Observation] = []
    for label in sorted(by_post):
        post_rows = by_post[label]
        # (ts) -> ordered distinct values with copy counts, in file order.
        per_ts: dict[datetime, dict[float, int]] = {}
        for r in post_rows:
            per_ts.setdefault(r.ts, {})
            per_ts[r.ts][r.value_mm] = per_ts[r.ts].get(r.value_mm, 0) + 1
        times = sorted(per_ts)

        # Spike detection on the series of unambiguous readings.
        series = [(t, length_to_cm(next(iter(per_ts[t])), SOURCE_UNIT)) for t in times if len(per_ts[t]) == 1]
        spikes: set[datetime] = set()
        for (t0, v0), (t1, v1), (t2, v2) in zip(series, series[1:], series[2:]):
            d_prev, d_next = v1 - v0, v1 - v2
            if (
                abs(d_prev) >= spike_cm
                and abs(d_next) >= spike_cm
                and (d_prev > 0) == (d_next > 0)
                and abs(v2 - v0) < spike_cm / 2
                and (t2 - t0) <= spike_max_gap
            ):
                spikes.add(t1)

        counts: Counter = Counter()
        for t in times:
            values = per_ts[t]
            conflict = len(values) > 1
            if conflict:
                report.conflicting_keys += 1
            report.repeated_rows += sum(values.values()) - len(values)
            value_mm = next(iter(values))  # first distinct value in file order
            value_cm = length_to_cm(value_mm, SOURCE_UNIT)
            reasons = []
            if conflict:
                reasons.append("conflicting_values_same_ts")
            if value_cm < 0 and not allows_negative.get(label, False):
                reasons.append("negative_level")
            if t in spikes:
                reasons.append("isolated_spike")
            flag = QualityFlag.SUSPECT if reasons else QualityFlag.OK
            for reason in reasons:
                report.suspect_reasons[reason] += 1
            out.append(
                Observation(
                    station_source=station_source,
                    station_external_id=label,
                    ts=t,
                    value=value_cm,
                    unit="cm",
                    quality_flag=flag,
                    raw_ref=raw_ref,
                )
            )
            counts[flag.value] += 1
        report.per_post[label] = dict(counts)
        report.by_flag.update(counts)
        if times:
            report.ts_min = min(report.ts_min or times[0], times[0])
            report.ts_max = max(report.ts_max or times[-1], times[-1])
    report.observations = len(out)
    return out, report


# --------------------------------------------------------------------------
# Siaga threshold evidence (B-034)
# --------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class LevelDerivation:
    level: str
    max_below_cm: float | None  # highest level seen with a lower status
    min_at_cm: float | None  # lowest level seen with this status
    candidates_cm: tuple[float, ...]  # multiples of 10 cm in [max_below, min_at]
    value_cm: float | None  # set only when unambiguous
    reason: str


def derive_siaga_thresholds(
    rows: Iterable[S2Row], *, max_bracket_cm: float = 10.0
) -> dict[str, dict[str, Any]]:
    """Infer Siaga thresholds per post from the ``status_siaga`` labels.

    A level's threshold is reported only when all of these hold:
    1. the post's labels are consistent: every value seen at a status is below
       every value seen at a higher status (no overlap);
    2. the level itself and the status immediately below it were observed;
    3. the bracket ``[max_below, min_at]`` is at most ``max_bracket_cm`` wide
       and contains exactly one multiple of 10 cm.
    Rule 3 assumes DSDA thresholds are whole multiples of 10 cm (true of every
    published value we know: Manggarai 750/850/950). On Manggarai the rule
    reproduces the official values exactly. Everything derived here still
    needs DSDA confirmation; anything ambiguous stays null.
    """
    by_post: dict[str, dict[str, set[float]]] = defaultdict(lambda: {s: set() for s in _ORDER})
    for r in rows:
        if r.status is not None:
            by_post[r.label][r.status].add(length_to_cm(r.value_mm, SOURCE_UNIT))
    result: dict[str, dict[str, Any]] = {}
    for label in sorted(by_post):
        st = by_post[label]
        present = [s for s in _ORDER if st[s]]
        consistent = all(max(st[a]) < min(st[b]) for a, b in zip(present, present[1:]))
        levels: dict[str, LevelDerivation] = {}
        for i, lv in enumerate(_ORDER[1:], start=1):
            below_status = _ORDER[i - 1]
            lower_vals = [v for s in _ORDER[:i] for v in st[s]]
            max_below = max(lower_vals) if lower_vals else None
            min_at = min(st[lv]) if st[lv] else None
            cands: tuple[float, ...] = ()
            if max_below is not None and min_at is not None and max_below <= min_at:
                lo = math.ceil(max_below / 10) * 10
                cands = tuple(float(c) for c in range(int(lo), int(math.floor(min_at)) + 1, 10))
            if not consistent:
                value, reason = None, "status labels overlap at this post"
            elif not st[lv]:
                value, reason = None, "level not observed"
            elif not st[below_status]:
                value, reason = None, f"{below_status} not observed"
            elif min_at - max_below > max_bracket_cm:
                value, reason = None, f"bracket wider than {max_bracket_cm:g} cm"
            elif len(cands) != 1:
                value, reason = None, f"{len(cands)} candidate values"
            else:
                value, reason = cands[0], "unambiguous"
            levels[lv] = LevelDerivation(lv, max_below, min_at, cands, value, reason)
        result[label] = {
            "consistent": consistent,
            "statuses_seen": present,
            "levels": {
                lv: {
                    "max_below_cm": d.max_below_cm,
                    "min_at_cm": d.min_at_cm,
                    "candidates_cm": list(d.candidates_cm),
                    "value_cm": d.value_cm,
                    "reason": d.reason,
                }
                for lv, d in levels.items()
            },
        }
    return result


# --------------------------------------------------------------------------
# Running the import
# --------------------------------------------------------------------------


class DryRunSink:
    """A ``Sink`` that keeps nothing but counts. Used by ``--dry-run``."""

    def __init__(self) -> None:
        self.raw: list[RawPayload] = []
        self.observations = 0
        self.runs: list[ConnectorRun] = []

    def write_raw(self, payload: RawPayload) -> str:
        from noah.store.objects import raw_key

        self.raw.append(payload)
        return raw_key(payload)

    def write_observations(self, rows: Sequence[Observation]) -> int:
        self.observations += len(rows)
        return len(rows)

    def write_flood_reports(self, rows: Sequence[FloodReport]) -> int:
        return len(rows)

    def write_rain_products(self, rows: Sequence[RainProduct]) -> int:
        return len(rows)

    def record_run(self, run: ConnectorRun) -> None:
        self.runs.append(run)


def _allows_negative_from_config(config: Any | None) -> dict[str, bool]:
    if config is None:
        return {}
    out: dict[str, bool] = {}
    for st in config.stations:
        for ident in st.identities:
            if ident.source == SOURCE:
                out[ident.external_id] = st.allows_negative
    return out


def run_import(
    path: str | os.PathLike[str],
    sink: Sink,
    *,
    station_config: Any | None = None,
    fetched_at: datetime = ARCHIVE_FETCHED_AT,
    batch_size: int = 5000,
) -> ImportReport:
    """Store the file as a raw payload, then write normalized observations."""
    started = utc_now()
    content = Path(path).read_bytes()
    raw_ref = sink.write_raw(
        RawPayload(
            source=SOURCE,
            fetched_at=fetched_at,
            content=content,
            content_type="text/csv",
            url="https://data.jakarta.go.id (S2; exact dataset URL not recorded)",
        )
    )
    rows, errors = parse_rows(content.decode("utf-8-sig"))
    qc = getattr(station_config, "qc", None)
    obs, report = build_observations(
        rows,
        raw_ref=raw_ref,
        allows_negative=_allows_negative_from_config(station_config),
        spike_cm=getattr(qc, "spike_cm", 100.0),
        spike_max_gap=timedelta(minutes=getattr(qc, "spike_max_gap_minutes", 180.0)),
    )
    report.rows_read += len(errors)
    report.rows_unparsed = len(errors)
    report.errors = errors
    report.raw_ref = raw_ref
    written = 0
    status = RunStatus.OK if not errors else RunStatus.PARTIAL
    error_msg = None
    try:
        for i in range(0, len(obs), batch_size):
            written += sink.write_observations(obs[i : i + batch_size])
    except Exception as exc:
        status = RunStatus.FAILED
        error_msg = f"{type(exc).__name__}: {str(exc)[:200]}"
        raise
    finally:
        report.written = written
        sink.record_run(
            ConnectorRun(
                connector=CONNECTOR,
                started_at=started,
                finished_at=utc_now(),
                status=status,
                rows_written=written,
                newest_ts=report.ts_max,
                error=error_msg or (f"{len(errors)} rows unparsed" if errors else None),
            )
        )
    return report


def _load_config_or_none(path: str | None) -> Any | None:
    from noah.store.stations import load_station_config

    try:
        return load_station_config(path)
    except FileNotFoundError:
        return None


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m noah.importers.s2_tma_2020", description=__doc__.split("\n\n")[0])
    parser.add_argument("--path", default=str(DEFAULT_PATH), help="CSV path (default: ml-service/data/tma_2020.xlsx.csv)")
    parser.add_argument("--stations", help="stations.yaml (default: config/stations.yaml)")
    parser.add_argument("--dry-run", action="store_true", help="parse and count; write nothing")
    parser.add_argument("--derive-thresholds", action="store_true", help="print Siaga threshold evidence as JSON")
    parser.add_argument("--per-post", action="store_true", help="include per-post counts in the report")
    args = parser.parse_args(argv)

    if args.derive_thresholds:
        rows, _ = parse_rows(Path(args.path).read_text(encoding="utf-8-sig"))
        print(json.dumps(derive_siaga_thresholds(rows), indent=2, ensure_ascii=False))
        return 0

    config = _load_config_or_none(args.stations)
    if config is None:
        print("warning: config/stations.yaml not found; negative levels flagged at every post", file=sys.stderr)

    if args.dry_run:
        sink: Any = DryRunSink()
        report = run_import(args.path, sink, station_config=config)
    else:
        url = os.environ.get("NOAH_DATABASE_URL")
        if not url:
            print("NOAH_DATABASE_URL is not set (use --dry-run to only parse)", file=sys.stderr)
            return 2
        import psycopg

        from noah.store.objects import object_store_from_env
        from noah.store.postgres import PostgresSink

        with psycopg.connect(url) as conn:
            sink = PostgresSink(conn, object_store_from_env())
            report = run_import(args.path, sink, station_config=config)

    out = report.as_dict()
    if not args.per_post:
        out.pop("per_post")
    out["dry_run"] = bool(args.dry_run)
    print(json.dumps(out, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
