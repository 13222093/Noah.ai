"""S5: BMKG nowcast (B-038).

status: needs_endpoint_confirmation (images); live (CAP warning feed)

What was reachable on 2026-11-02 (two polite requests):
1. https://nowcasting.bmkg.go.id/ (the nowcast image portal) answered 403
   with a Cloudflare "Just a moment..." JavaScript challenge. We do not
   bypass bot protection, so no public image URL could be confirmed (BMKG Q5).
2. https://www.bmkg.go.id/alerts/nowcast/id answered 200 ``application/xml``:
   an RSS 2.0 feed of BMKG nowcast warnings (CAP), "public domain", with one
   ``<item>`` per active warning: ``title``, ``link`` to the CAP XML
   (``C<region><yyyymmdd><nnn>_alert.xml``, ``CJK`` = DKI Jakarta),
   ``description`` (Indonesian text with onset and end times), ``guid`` (CAP
   identifier) and ``pubDate`` (RFC 822 with the local offset, +0700 WIB,
   +0800 WITA, +0900 WIT). Fixture ``s5_bmkg_nowcast_rss_*.xml``.

Two connectors:
- ``BmkgNowcastFeedConnector`` (``s5_bmkg_nowcast``, every 10 min) stores the
  feed verbatim and writes one ``RainProduct(kind="nowcast")`` per warning for
  the configured regions (default DKI only; add ``JB``/``BT`` for Bogor,
  Depok, Bekasi and Tangerang). ``uri`` is the raw feed's object key;
  ``issued_at`` = ``pubDate``; ``valid_at`` = the onset in the description
  ("akan terjadi pada 02 November 2026, 20:00 WIB"), or ``issued_at`` when
  the text does not parse (``meta["valid_at_from"]`` says which). The CAP
  XML itself is not fetched yet (one request per run).
  These are BMKG's own warnings: Noah stores them for operators and never
  republishes them (guardrail 1).
- ``BmkgNowcastImageConnector`` (``s5_bmkg_nowcast_image``) is disabled until
  ``NOAH_S5_IMAGE_URL`` names a confirmed public image. It stores the image
  as the raw payload and a ``RainProduct`` pointing at it. No image parsing
  (interim, B-038); ``issued_at`` comes from ``Last-Modified`` when present,
  otherwise the fetch time, recorded in ``meta["issued_at_from"]``.
"""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from typing import Any

from ..records import RainProduct
from ..timeunits import ensure_utc
from .base import Connector, ParseError, ParseResult, newest

__all__ = [
    "BmkgNowcastFeedConnector",
    "BmkgNowcastImageConnector",
    "parse_nowcast_rss",
    "parse_onset_end",
]

SOURCE = "s5_bmkg_nowcast"
IMAGE_SOURCE = "s5_bmkg_nowcast_image"
FEED_URL = "https://www.bmkg.go.id/alerts/nowcast/id"
ENV_IMAGE_URL = "NOAH_S5_IMAGE_URL"
DEFAULT_REGIONS = frozenset({"JK"})

_MONTHS = {
    "januari": 1, "februari": 2, "maret": 3, "april": 4, "mei": 5, "juni": 6,
    "juli": 7, "agustus": 8, "september": 9, "oktober": 10, "november": 11, "desember": 12,
}
_ZONES = {"WIB": 7, "WITA": 8, "WIT": 9}
_WHEN = r"(\d{1,2})\s+([A-Za-z]+)\s+(\d{4}),\s*(\d{1,2})[:.](\d{2})\s*(WIB|WITA|WIT)\b"
_ONSET = re.compile(r"terjadi\s+pada\s+" + _WHEN, re.I)
_END = re.compile(r"hingga\s+" + _WHEN, re.I)
_CODE = re.compile(r"/C([A-Z]{2})(\d{8})(\d{3})_alert\.xml$")


def _when(m: re.Match[str] | None) -> datetime | None:
    if not m:
        return None
    day, month, year, hh, mm, zone = m.groups()
    mon = _MONTHS.get(month.lower())
    if not mon:
        return None
    tz = timezone(timedelta(hours=_ZONES[zone.upper()]))
    try:
        return ensure_utc(datetime(int(year), mon, int(day), int(hh), int(mm), tzinfo=tz))
    except ValueError:
        return None


def parse_onset_end(text: str) -> tuple[datetime | None, datetime | None]:
    return _when(_ONSET.search(text or "")), _when(_END.search(text or ""))


def parse_nowcast_rss(
    content: bytes | str,
    *,
    raw_ref: str | None,
    regions: frozenset[str] = DEFAULT_REGIONS,
) -> ParseResult:
    try:
        root = ET.fromstring(content.encode() if isinstance(content, str) else content)
    except ET.ParseError as exc:
        raise ParseError(f"not XML: {exc}") from None
    channel = root.find("channel")
    if root.tag != "rss" or channel is None:
        raise ParseError("not an RSS feed")
    out = ParseResult()
    uri = raw_ref or "unstored"
    for item in channel.findall("item"):
        link = (item.findtext("link") or "").strip()
        m = _CODE.search(link)
        if not m:
            out.row_errors += 1
            continue
        if m.group(1) not in regions:
            out.skipped += 1
            continue
        try:
            issued = ensure_utc(parsedate_to_datetime((item.findtext("pubDate") or "").strip()))
        except (TypeError, ValueError):
            out.row_errors += 1
            continue
        onset, end = parse_onset_end(item.findtext("description") or "")
        out.rain_products.append(
            RainProduct(
                source=SOURCE,
                issued_at=issued,
                valid_at=onset or issued,
                kind="nowcast",
                uri=uri,
                meta={
                    "product": "cap_warning",
                    "identifier": (item.findtext("guid") or "").strip() or link,
                    "cap_url": link,
                    "region_code": m.group(1),
                    "title": (item.findtext("title") or "").strip(),
                    "valid_at_from": "description_onset" if onset else "issued_at",
                    "expires_at": end.isoformat() if end else None,
                },
            )
        )
    out.newest_ts = newest([p.issued_at for p in out.rain_products])
    return out


class BmkgNowcastFeedConnector(Connector):
    id = SOURCE
    url = FEED_URL
    min_interval_s = 600  # BMKG nowcast cadence: 10 min
    accept = "application/rss+xml, application/xml"
    freshness = "run"  # no active warning for Jakarta is normal

    def __init__(self, *, regions: frozenset[str] = DEFAULT_REGIONS, **kw: Any) -> None:
        super().__init__(**kw)
        self.regions = frozenset(regions)

    def parse(self, content: bytes, *, fetched_at: datetime, raw_ref: str | None) -> ParseResult:
        return parse_nowcast_rss(content, raw_ref=raw_ref, regions=self.regions)


class BmkgNowcastImageConnector(Connector):
    id = IMAGE_SOURCE
    min_interval_s = 600
    accept = "image/png, image/*"
    freshness = "data"

    def __init__(self, **kw: Any) -> None:
        super().__init__(**kw)
        url = self._env.get(ENV_IMAGE_URL, "").strip()
        self.url = url if url.startswith("https://") else ""
        self._last_modified_hdr: str | None = None

    def fetch(self):  # type: ignore[override]
        resp = super().fetch()
        self._last_modified_hdr = resp.header("Last-Modified") if resp is not None else None
        if resp is not None and not resp.content_type.lower().startswith("image/"):
            raise ParseError(f"expected an image, got {resp.content_type.split(';')[0]}")
        return resp

    def parse(self, content: bytes, *, fetched_at: datetime, raw_ref: str | None) -> ParseResult:
        issued, src = ensure_utc(fetched_at), "fetched_at"
        if self._last_modified_hdr:
            try:
                issued, src = ensure_utc(parsedate_to_datetime(self._last_modified_hdr)), "last_modified"
            except (TypeError, ValueError):
                pass
        product = RainProduct(
            source=IMAGE_SOURCE,
            issued_at=issued,
            valid_at=issued,
            kind="nowcast",
            uri=raw_ref or "unstored",
            meta={"product": "image", "issued_at_from": src, "parsed": False, "bytes": len(content)},
        )
        return ParseResult(rain_products=[product], newest_ts=issued)
