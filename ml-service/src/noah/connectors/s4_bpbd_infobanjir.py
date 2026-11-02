"""S4: BPBD DKI "Monitoring Banjir" flooded RTs (B-037).

status: needs_endpoint_confirmation

What was reachable on 2026-11-02 (two polite requests, fixtures saved):
1. https://bpbd.jakarta.go.id/infobanjir is a shell page with no data. It
   embeds an ArcGIS Dashboard from Jakarta Satu:
   ``https://jakartasatu.jakarta.go.id/portal/apps/dashboards/c2b19d6243dd4a2f80fa1e55481fdb11``
   (fixture ``s4_infobanjir_page_*.html``). The dashboard needs JavaScript.
2. The public dashboard definition (ArcGIS sharing REST,
   ``/portal/sharing/rest/content/items/<id>/data?f=json``; fixture
   ``s4_jakartasatu_dashboard_*.json``). Its widgets read web map item
   ``3929103a8101453fb6f137605fda6d85``; the RT layer exposes the fields
   ``WADMKK`` (kota), ``WADMKD`` (kelurahan), ``WADMRW``, ``WADMRT``,
   ``TMA``, ``KATEGORI``, ``LUASWH``, ``LAST_UPDATE``, ``OBJECTID``. A second
   layer lists gates (``PINTU_AIR``, ``KETINGGIAN_AIR_CM``, ``STATUS_N``,
   ``TANGGAL``, ``WAKTU``). Its title says "Banjir BPBD - DEV".

Not done (request budget, and the layer is not documented as public): resolve
the web map to the FeatureServer layer URL and fetch features. So the
connector is **disabled** until ``NOAH_S4_FEATURE_URL`` is set to the RT
layer's ``.../FeatureServer/<n>/query`` URL confirmed with BPBD (BPBD Q1).
The feature parser targets the standard ArcGIS REST ``query?f=json``
response with the field names above; it has been tested only on a
constructed fixture and must be re-checked against a real response.

Normalization:
- ``ts_start`` = ``LAST_UPDATE`` (ArcGIS date fields are epoch ms, UTC). The
  layer is a snapshot of currently flooded RTs, so ``ts_end`` is unknown
  (None); the end is inferred later from disappearance (matching, plan 05).
- ``depth_cm``: left ``None``. ``TMA`` has no documented unit (the page
  footnote says only areas "diatas 30 cm" are shown); it is kept in
  ``meta["tma_raw"]`` until BPBD confirms the unit.
- ``unit_code``: ``None``; no RT code field is visible. Names of kota,
  kelurahan, RW and RT go to ``meta`` for the store to resolve. RT level
  only; the layer carries no individual data (guardrail 3).
"""

from __future__ import annotations

import json
import re
from datetime import datetime
from typing import Any

from ..records import FloodReport
from ..timeunits import UTC, ensure_utc, parse_wib_local
from .base import Connector, ParseError, ParseResult, newest

__all__ = ["BpbdInfoBanjirConnector", "parse_arcgis_features", "parse_dashboard_definition", "dashboard_id_from_page"]

SOURCE = "s4_bpbd_infobanjir"
PAGE_URL = "https://bpbd.jakarta.go.id/infobanjir"
ENV_FEATURE_URL = "NOAH_S4_FEATURE_URL"
RT_FIELDS = ("WADMKK", "WADMKD", "WADMRW", "WADMRT", "TMA", "KATEGORI", "LUASWH", "LAST_UPDATE", "OBJECTID")


def dashboard_id_from_page(content: bytes | str) -> str | None:
    """The ArcGIS dashboard id embedded in the BPBD page, or None."""
    text = content.decode("utf-8", errors="replace") if isinstance(content, bytes) else content
    m = re.search(r'<iframe[^>]+src="https://jakartasatu\.jakarta\.go\.id/portal/apps/dashboards/([0-9a-f]{32})"', text)
    return m.group(1) if m else None


def parse_dashboard_definition(content: bytes | str) -> dict[str, Any]:
    """Data sources and fields referenced by the dashboard widgets."""
    d = json.loads(content)
    sources: dict[str, set[str]] = {}
    for view in ("desktopView", "mobileView"):
        for w in d.get(view, {}).get("widgets", []):
            text = json.dumps(w)
            fields = set(re.findall(r"\{field/([A-Za-z_0-9]+)\}", text))
            for ds in w.get("datasets") or []:
                src = ds.get("dataSource") or {}
                if src.get("itemId"):
                    key = f'{src["itemId"]}/{src.get("layerId")}'
                    f = sources.setdefault(key, set())
                    f |= fields
                    for k in ("groupByFields", "orderByFields"):
                        f |= {x.split()[0] for x in ds.get(k) or []}
                    f |= {s["onStatisticField"] for s in ds.get("statisticDefinitions") or [] if "onStatisticField" in s}
    if not sources:
        raise ParseError("dashboard definition has no data sources")
    return {k: sorted(v) for k, v in sorted(sources.items())}


def _ts(value: Any) -> datetime:
    if isinstance(value, bool):
        raise ValueError("bad date")
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value / 1000, tz=UTC)  # ArcGIS: epoch ms, UTC
    if isinstance(value, str) and value.strip():
        return parse_wib_local(value)  # a text date on a DKI layer is WIB wall-clock
    raise ValueError("missing date")


def parse_arcgis_features(content: bytes | str, *, raw_ref: str | None = None) -> ParseResult:
    d = json.loads(content)
    if "error" in d:
        raise ParseError("ArcGIS error response")
    feats = d.get("features")
    if not isinstance(feats, list):
        raise ParseError("no features array")
    out = ParseResult()
    for f in feats:
        a = (f or {}).get("attributes") or {}
        try:
            ts = ensure_utc(_ts(a.get("LAST_UPDATE")))
            oid = a["OBJECTID"]
        except (KeyError, ValueError, TypeError, OverflowError):
            out.row_errors += 1
            continue
        names = {k: a.get(k) for k in ("WADMKK", "WADMKD", "WADMRW", "WADMRT")}
        if not names["WADMKD"] or names["WADMRT"] in (None, ""):
            out.row_errors += 1
            continue
        out.flood_reports.append(
            FloodReport(
                source="bpbd_rt",
                external_id=f"{oid}@{int(ts.timestamp())}",
                unit_code=None,
                ts_start=ts,
                ts_end=None,
                depth_cm=None,
                raw_ref=raw_ref,
                meta={
                    "connector": SOURCE,
                    "kota": names["WADMKK"],
                    "kelurahan": names["WADMKD"],
                    "rw": names["WADMRW"],
                    "rt": names["WADMRT"],
                    "tma_raw": a.get("TMA"),
                    "tma_unit": "unconfirmed",
                    "kategori": a.get("KATEGORI"),
                    "ts_semantics": "snapshot_last_update",
                },
            )
        )
    out.newest_ts = newest([r.ts_start for r in out.flood_reports])
    return out


class BpbdInfoBanjirConnector(Connector):
    id = SOURCE
    min_interval_s = 3600  # BPBD publishes hourly (backlog B-037)
    accept = "application/json"
    freshness = "run"  # no flooded RT is a normal state
    stale_after_min = 75.0  # hourly cadence; 15 min would always read stale

    def __init__(self, **kw: Any) -> None:
        super().__init__(**kw)
        url = self._env.get(ENV_FEATURE_URL, "").strip()
        self.url = url if url.startswith("https://") else ""

    def parse(self, content: bytes, *, fetched_at: datetime, raw_ref: str | None) -> ParseResult:
        return parse_arcgis_features(content, raw_ref=raw_ref)
