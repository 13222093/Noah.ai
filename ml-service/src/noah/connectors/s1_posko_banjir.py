"""S1: Posko Banjir DSDA water levels (B-036).

status: live (HTML table). The XML endpoint named in plan 04 is still
``needs_endpoint_confirmation``: it is not linked from the page, and the
commonly cited ``/datatmalaststatus.xml`` returned 404 on 2026-11-02.

Source: https://poskobanjir.dsdadki.web.id/ (ASP.NET + DevExpress grid,
server-rendered; no JavaScript needed). One GET per run, never more often
than every 5 minutes (``min_interval_s``), identified User-Agent.

Payload (fixture ``tests/connectors/fixtures/s1_posko_banjir_20261102T1342Z.html``):
each post is one ``<tr id="..._DXDataRow<n>" onclick="ShowPopup(...)">`` with
cells ``No | Lokasi Pengamatan | Sungai/Kali | Tinggi Air (cm) | Perubahan
(icon) | Tanggal dd/mm/yyyy | Jam HH:MM | Status Siaga (icon)``. The onclick
arguments are ``name, level_raw, siaga1_raw, siaga2_raw, siaga3_raw,
"lat,lon,name,level_raw,Status : <s>,<ID_PINTU_AIR>", affected_areas``.

Units (resolves audit Q2): the table header says "Tinggi Air (cm)" and shows
integer cm; the onclick ``level_raw`` and Siaga values are **mm**. Evidence
from the live page on 2026-11-02 20:42 WIB: Manggarai shows 534 in the table
and ``5340`` in onclick, with Siaga raw values 9500/8500/7500, which are
exactly the official 950/850/750 cm. Every one of the 37 rows satisfies
``raw / 10 == table value``. The S2 archive (also mm) matches the raw field.
We use ``raw`` (1 mm resolution) converted to cm, and fall back to the
table cm value when raw is missing. A mismatch between the two flags the row
``SUSPECT`` (it would mean the scale changed).

Times are WIB wall-clock (``Tanggal`` + ``Jam``), converted to UTC.
A row whose time is more than ``STALE_AFTER`` older than the fetch is flagged
``STALE`` (on 2026-11-02, Karet showed 01/11 15:30 and Kaliduri 30/10 11:00).
External id: ``ID_PINTU_AIR`` from onclick (e.g. Manggarai ``122``).
"""

from __future__ import annotations

import html
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from html.parser import HTMLParser
from typing import Any, Mapping

from ..records import Observation, QualityFlag
from ..timeunits import WIB, ensure_utc, mm_to_cm
from .base import Connector, ParseError, ParseResult, Range, combine_flags, is_stale, newest, range_flag

__all__ = ["PoskoBanjirConnector", "parse_posko_banjir", "station_catalog", "S1Row"]

SOURCE = "s1_posko_banjir"
URL = "https://poskobanjir.dsdadki.web.id/"
#: Plausible water level range in cm relative to station datum when no
#: per-station range is configured. Pluit sits below datum (-172 cm seen).
DEFAULT_RANGE = Range(-400.0, 1500.0)
STALE_AFTER = timedelta(minutes=60)
FUTURE_TOLERANCE = timedelta(minutes=10)
_ROW_ID = re.compile(r"_DXDataRow\d+$")
_ARG = re.compile(r"'((?:[^'\\]|\\.)*)'")
_HEADER_UNIT = re.compile(r"Tinggi\s+Air\s*\(\s*([a-zA-Z]+)\s*\)")


@dataclass
class S1Row:
    cells: list[str] = field(default_factory=list)
    imgs: list[str] = field(default_factory=list)
    onclick: str = ""


class _GridParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.rows: list[S1Row] = []
        self._row: S1Row | None = None
        self._cell: list[str] | None = None
        self._depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        a = {k: v or "" for k, v in attrs}
        if tag == "tr":
            if self._row is not None:
                self._depth += 1
            elif _ROW_ID.search(a.get("id", "")):
                self._row = S1Row(onclick=a.get("onclick", ""))
                self._depth = 0
        elif self._row is not None:
            if tag == "td" and self._depth == 0:
                self._cell = []
            elif tag == "img":
                self._row.imgs.append(a.get("src", ""))

    def handle_endtag(self, tag: str) -> None:
        if self._row is None:
            return
        if tag == "td" and self._cell is not None:
            self._row.cells.append(" ".join("".join(self._cell).split()))
            self._cell = None
        elif tag == "tr":
            if self._depth:
                self._depth -= 1
            else:
                self.rows.append(self._row)
                self._row = None

    def handle_data(self, data: str) -> None:
        if self._cell is not None:
            self._cell.append(data)


def _num(text: str) -> float | None:
    t = text.strip().replace(",", ".")
    if not t:
        return None
    try:
        return float(t)
    except ValueError:
        return None


def _popup_args(onclick: str) -> list[str]:
    inner = html.unescape(onclick)
    m = re.search(r"ShowPopup\((.*)\)\s*;?\s*$", inner, re.S)
    return [s.replace("\\'", "'") for s in _ARG.findall(m.group(1))] if m else []


def _row_fields(row: S1Row) -> dict[str, Any]:
    if len(row.cells) < 8:
        raise ValueError(f"expected 8 cells, got {len(row.cells)}")
    _, name, river, level_cm_text, _, date_text, time_text, _ = row.cells[:8]
    args = _popup_args(row.onclick)
    raw_mm = _num(args[1]) if len(args) > 1 else None
    siaga_mm = [_num(a) for a in args[2:5]] if len(args) >= 5 else [None, None, None]
    ext_id = lat = lon = status = None
    if len(args) > 5:
        parts = args[5].split(",")
        if len(parts) >= 3 and parts[-1].strip().isdigit():
            ext_id = parts[-1].strip()
            status = parts[-2].replace("Status :", "").strip() or None
        lat, lon = (_num(parts[0]), _num(parts[1])) if len(parts) >= 2 else (None, None)
    if not ext_id:
        ext_id = "name:" + re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    d = datetime.strptime(f"{date_text} {time_text}", "%d/%m/%Y %H:%M").replace(tzinfo=WIB)
    return {
        "external_id": ext_id,
        "name": name,
        "river": river,
        "level_cm_shown": _num(level_cm_text),
        "level_mm_raw": raw_mm,
        "siaga_mm": siaga_mm,  # Siaga 1, 2, 3
        "status": status,
        "lat": lat,
        "lon": lon,
        "ts": ensure_utc(d),
    }


def _rows(content: bytes | str) -> tuple[list[S1Row], str | None]:
    text = content.decode("utf-8", errors="replace") if isinstance(content, bytes) else content
    unit = _HEADER_UNIT.search(text)
    p = _GridParser()
    p.feed(text)
    p.close()
    if not p.rows:
        raise ParseError("no DXDataRow rows found; page layout changed or blocked")
    return p.rows, (unit.group(1).lower() if unit else None)


def parse_posko_banjir(
    content: bytes | str,
    *,
    fetched_at: datetime,
    raw_ref: str | None = None,
    ranges: Mapping[str, Range] | None = None,
    stale_after: timedelta = STALE_AFTER,
) -> ParseResult:
    rows, header_unit = _rows(content)
    if header_unit not in (None, "cm"):
        raise ParseError(f"table header unit is {header_unit!r}, parser expects cm")
    fetched_at = ensure_utc(fetched_at)
    out = ParseResult()
    for row in rows:
        try:
            f = _row_fields(row)
        except (ValueError, IndexError):
            out.row_errors += 1
            continue
        flags: list[QualityFlag] = []
        if f["level_mm_raw"] is not None:
            value = mm_to_cm(f["level_mm_raw"])
            shown = f["level_cm_shown"]
            if shown is not None and abs(value - shown) > 1.0:
                flags.append(QualityFlag.SUSPECT)  # mm/cm relation broke
        elif f["level_cm_shown"] is not None:
            value = float(f["level_cm_shown"])
            if header_unit is None:
                flags.append(QualityFlag.MISSING_UNIT)
        else:
            out.row_errors += 1
            continue
        rng = (ranges or {}).get(f["external_id"], DEFAULT_RANGE)
        flags.append(range_flag(value, rng))
        if f["ts"] - fetched_at > FUTURE_TOLERANCE:
            flags.append(QualityFlag.SUSPECT)
        if is_stale(f["ts"], fetched_at, stale_after):
            flags.append(QualityFlag.STALE)
        out.observations.append(
            Observation(
                station_source=SOURCE,
                station_external_id=f["external_id"],
                ts=f["ts"],
                value=value,
                unit="cm",
                quality_flag=combine_flags(*flags),
                raw_ref=raw_ref,
            )
        )
    out.newest_ts = newest([o.ts for o in out.observations])
    return out


def station_catalog(content: bytes | str) -> list[dict[str, Any]]:
    """Station metadata as published on the page (name, river, coordinates,
    Siaga thresholds converted to cm). Input for the ``stations`` seed owned by
    configuration (D12); thresholds of 5000 mm on newer posts look like
    placeholders and must be confirmed with DSDA before use."""
    rows, _ = _rows(content)
    out = []
    for row in rows:
        try:
            f = _row_fields(row)
        except (ValueError, IndexError):
            continue
        s1, s2, s3 = (mm_to_cm(v) if v is not None else None for v in f["siaga_mm"])
        out.append(
            {
                "source": SOURCE,
                "external_id": f["external_id"],
                "name": f["name"],
                "river": f["river"],
                "lat": f["lat"],
                "lon": f["lon"],
                "unit": "cm",
                "siaga_thresholds_cm": {"siaga3": s3, "siaga2": s2, "siaga1": s1},
            }
        )
    return out


class PoskoBanjirConnector(Connector):
    id = SOURCE
    url = URL
    min_interval_s = 300  # one request per 5 min (plan 04, S1)
    accept = "text/html"
    freshness = "data"

    def __init__(self, *, ranges: Mapping[str, Range] | None = None, **kw: Any) -> None:
        super().__init__(**kw)
        self.ranges = dict(ranges or {})

    def parse(self, content: bytes, *, fetched_at: datetime, raw_ref: str | None) -> ParseResult:
        return parse_posko_banjir(content, fetched_at=fetched_at, raw_ref=raw_ref, ranges=self.ranges)
