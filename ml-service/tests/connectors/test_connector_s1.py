from datetime import datetime, timedelta, timezone

import pytest

from noah.connectors.base import ParseError, Range
from noah.connectors.s1_posko_banjir import parse_posko_banjir, station_catalog
from noah.records import QualityFlag

from connector_helpers import S1_FETCHED_AT

UTC = timezone.utc


def _by_id(result):
    return {o.station_external_id: o for o in result.observations}


def test_all_posts_parsed(s1_html):
    r = parse_posko_banjir(s1_html, fetched_at=S1_FETCHED_AT, raw_ref="raw/x")
    assert len(r.observations) == 37
    assert r.row_errors == 0
    assert all(o.unit == "cm" and o.station_source == "s1_posko_banjir" for o in r.observations)
    assert all(o.raw_ref == "raw/x" for o in r.observations)
    assert r.newest_ts == datetime(2026, 11, 2, 13, 44, tzinfo=UTC)


@pytest.mark.parametrize(
    "ext_id, name_hint, cm, ts_utc, flag",
    [
        # Manggarai: table 534 cm, onclick 5340 mm; 20:40 WIB = 13:40 UTC
        ("122", "Manggarai", 534.0, datetime(2026, 11, 2, 13, 40, tzinfo=UTC), QualityFlag.OK),
        ("116", "Katulampa", 6.0, datetime(2026, 11, 2, 13, 40, tzinfo=UTC), QualityFlag.OK),
        ("118", "Depok", 82.0, datetime(2026, 11, 2, 13, 40, tzinfo=UTC), QualityFlag.OK),
        # below datum: kept as a negative number, not flagged
        ("167", "Pluit", -172.0, datetime(2026, 11, 2, 13, 40, tzinfo=UTC), QualityFlag.OK),
        # source repeats an old reading: 01/11/2026 15:30 WIB
        ("163", "Karet", 287.0, datetime(2026, 11, 1, 8, 30, tzinfo=UTC), QualityFlag.STALE),
        # 30/10/2026 11:00 WIB
        ("169", "Kaliduri", 170.0, datetime(2026, 10, 30, 4, 0, tzinfo=UTC), QualityFlag.STALE),
        # 20:39 WIB
        ("184", "Lagoa", 67.0, datetime(2026, 11, 2, 13, 39, tzinfo=UTC), QualityFlag.OK),
    ],
)
def test_known_posts(s1_html, ext_id, name_hint, cm, ts_utc, flag):
    o = _by_id(parse_posko_banjir(s1_html, fetched_at=S1_FETCHED_AT))[ext_id]
    assert o.value == pytest.approx(cm)
    assert o.ts == ts_utc and o.ts.utcoffset() == timedelta(0)
    assert o.quality_flag is flag


def test_unit_evidence_raw_mm_equals_table_cm(s1_html):
    """Every row: onclick raw (mm) / 10 == table value (cm). Basis of the unit conclusion."""
    from noah.connectors.s1_posko_banjir import _row_fields, _rows

    rows, header_unit = _rows(s1_html)
    assert header_unit == "cm"
    for row in rows:
        f = _row_fields(row)
        assert f["level_mm_raw"] / 10 == pytest.approx(f["level_cm_shown"], abs=0.5), f["name"]


def test_manggarai_thresholds_match_official_values(s1_html):
    m = {s["external_id"]: s for s in station_catalog(s1_html)}["122"]
    assert m["siaga_thresholds_cm"] == {"siaga3": 750.0, "siaga2": 850.0, "siaga1": 950.0}
    assert m["lat"] == pytest.approx(-6.207825) and m["lon"] == pytest.approx(106.848458)


def test_out_of_range_is_flagged_not_dropped(s1_html):
    r = parse_posko_banjir(s1_html, fetched_at=S1_FETCHED_AT, ranges={"122": Range(0, 500)})
    o = _by_id(r)["122"]
    assert o.value == 534.0 and o.quality_flag is QualityFlag.SUSPECT
    assert len(r.observations) == 37


def test_mm_cm_mismatch_flags_suspect(s1_html):
    tampered = s1_html.replace(b"&#39;P.A. Manggarai 2&#39;,&#39;5340&#39;", b"&#39;P.A. Manggarai 2&#39;,&#39;534&#39;")
    o = _by_id(parse_posko_banjir(tampered, fetched_at=S1_FETCHED_AT))["122"]
    assert o.value == pytest.approx(53.4)
    assert o.quality_flag is QualityFlag.SUSPECT


def test_future_timestamp_is_suspect(s1_html):
    early = S1_FETCHED_AT - timedelta(hours=1)
    o = _by_id(parse_posko_banjir(s1_html, fetched_at=early))["122"]
    assert o.quality_flag is QualityFlag.SUSPECT


def test_staleness_is_relative_to_fetch_time(s1_html):
    later = S1_FETCHED_AT + timedelta(hours=2)
    r = parse_posko_banjir(s1_html, fetched_at=later)
    assert all(o.quality_flag is QualityFlag.STALE for o in r.observations)


def test_header_unit_change_fails_loudly(s1_html):
    with pytest.raises(ParseError):
        parse_posko_banjir(s1_html.replace(b"Tinggi Air (cm)", b"Tinggi Air (m)"), fetched_at=S1_FETCHED_AT)


@pytest.mark.parametrize("body", [b"", b"<html><body>Service Unavailable</body></html>"])
def test_page_without_grid_is_parse_error(body):
    with pytest.raises(ParseError):
        parse_posko_banjir(body, fetched_at=S1_FETCHED_AT)


def test_naive_fetched_at_rejected(s1_html):
    with pytest.raises(ValueError):
        parse_posko_banjir(s1_html, fetched_at=datetime(2026, 11, 2, 13, 42))
