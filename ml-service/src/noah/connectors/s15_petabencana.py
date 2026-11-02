"""S15: PetaBencana.id crowd reports for DKI Jakarta (B-039).

status: live (format confirmed); flood ``report_data`` needs_endpoint_confirmation

Endpoint (one polite request on 2026-11-02, fixture
``s15_petabencana_reports_*.json``, free text, photo links and report URLs
removed before saving):
``https://data.petabencana.id/reports?admin=ID-JK&timeperiod=<s>&geoformat=geojson``
returned 200 JSON ``{"statusCode": 200, "result": FeatureCollection}``, weak
ETag, ``cache-control: max-age=60``. Each feature: Point ``[lon, lat]`` and
properties ``pkey``, ``created_at`` (ISO UTC, ``Z``), ``source`` (e.g.
``grasp``), ``status``, ``disaster_type``, ``report_data``
(``report_type`` plus type-specific fields), ``tags`` (``city``,
``region_code`` BPS code, ``local_area_id``, ``instance_region_code``), and
user ``text``, ``title`` and ``image_url``.

The week fetched held only an earthquake and a haze report, so no flood
report has been seen yet. For floods the parser reads
``report_data.flood_depth`` as cm (PetaBencana's documented field); this is
the part to confirm on the first real flood report (Q6).

Rules:
- ``timeperiod`` is seconds and is what we ask for: the old proxy silently
  turned "1h" into 24 h (G-039). Poll every 5 min with a 1 h window; overlap
  is removed by ``pkey``.
- Only ``disaster_type == "flood"`` inside DKI (``instance_region_code ==
  "ID-JK"`` or a BPS ``region_code`` starting with ``31``) becomes a
  ``FloodReport(source="petabencana")``. Others are counted as skipped.
- No personal data (guardrail 3): text, title, image and report URLs are never
  copied into records; coordinates are rounded to 4 decimals (about 11 m).
  The raw payload in object storage still holds them, so it inherits the
  raw-store access rules.
- A depth outside 0 to 500 cm is kept and marked ``meta["quality_flag"] =
  "suspect"`` (``FloodReport`` has no flag column).
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from ..records import FloodReport, QualityFlag
from ..timeunits import ensure_utc
from .base import Connector, ParseError, ParseResult, Range, newest

__all__ = ["PetaBencanaConnector", "parse_petabencana", "reports_url", "TIMEPERIODS"]

SOURCE = "s15_petabencana"
BASE_URL = "https://data.petabencana.id/reports"
DEPTH_RANGE = Range(0.0, 500.0)
#: Supported windows, in seconds. Unknown labels raise instead of widening.
TIMEPERIODS = {"1h": 3600, "6h": 21600, "24h": 86400, "3d": 259200, "7d": 604800}


def reports_url(window: str = "1h", admin: str = "ID-JK") -> str:
    if window not in TIMEPERIODS:
        raise ValueError(f"unsupported window {window!r}; expected one of {sorted(TIMEPERIODS)}")
    return f"{BASE_URL}?admin={admin}&timeperiod={TIMEPERIODS[window]}&geoformat=geojson"


def _in_dki(tags: dict[str, Any]) -> bool:
    return tags.get("instance_region_code") == "ID-JK" or str(tags.get("region_code") or "").startswith("31")


def parse_petabencana(content: bytes | str, *, raw_ref: str | None = None) -> ParseResult:
    try:
        d = json.loads(content)
    except json.JSONDecodeError as exc:
        raise ParseError(f"not JSON: {exc.msg}") from None
    if d.get("statusCode") != 200 or not isinstance(d.get("result"), dict):
        raise ParseError("unexpected envelope")
    feats = d["result"].get("features")
    if not isinstance(feats, list):
        raise ParseError("no features array")
    out = ParseResult()
    for f in feats:
        p = (f or {}).get("properties") or {}
        tags = p.get("tags") or {}
        if p.get("disaster_type") != "flood" or not _in_dki(tags):
            out.skipped += 1
            continue
        try:
            pkey = str(p["pkey"])
            # ISO with "Z"; a timestamp without an offset is rejected, not guessed.
            ts = ensure_utc(datetime.fromisoformat(str(p["created_at"]).replace("Z", "+00:00")))
            lon, lat = (f.get("geometry") or {}).get("coordinates")[:2]
            lon, lat = round(float(lon), 4), round(float(lat), 4)
        except (KeyError, TypeError, ValueError):
            out.row_errors += 1
            continue
        rd = p.get("report_data") or {}
        depth = rd.get("flood_depth")
        depth_cm = float(depth) if isinstance(depth, (int, float)) and not isinstance(depth, bool) else None
        meta: dict[str, Any] = {
            "connector": SOURCE,
            "status": p.get("status"),
            "report_source": p.get("source"),
            "report_type": rd.get("report_type"),
            "city": tags.get("city"),
            "region_code": tags.get("region_code"),
            "unit_code_scheme": "petabencana_local_area_id",
            "quality_flag": QualityFlag.OK.value,
        }
        if depth_cm is not None and not DEPTH_RANGE.contains(depth_cm):
            meta["quality_flag"] = QualityFlag.SUSPECT.value
        out.flood_reports.append(
            FloodReport(
                source="petabencana",
                external_id=pkey,
                unit_code=str(tags["local_area_id"]) if tags.get("local_area_id") else None,
                ts_start=ts,
                ts_end=None,
                depth_cm=depth_cm,
                lon=lon,
                lat=lat,
                raw_ref=raw_ref,
                meta=meta,
            )
        )
    out.newest_ts = newest([r.ts_start for r in out.flood_reports])
    return out


class PetaBencanaConnector(Connector):
    id = SOURCE
    min_interval_s = 300  # backlog: every 5 to 10 min
    accept = "application/json"
    freshness = "run"  # no reports is the normal dry-weather state

    def __init__(self, *, window: str = "1h", **kw: Any) -> None:
        super().__init__(**kw)
        self.url = reports_url(window)

    def report_key(self, row: FloodReport) -> tuple[str, str, str]:
        return ("fr", row.source, row.external_id)  # pkey is unique per report

    def parse(self, content: bytes, *, fetched_at: datetime, raw_ref: str | None) -> ParseResult:
        return parse_petabencana(content, raw_ref=raw_ref)
