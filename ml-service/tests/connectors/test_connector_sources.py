"""Parser tests for S4, S5 and S15 against the saved fixtures."""

import json
from datetime import datetime, timezone

import pytest

from noah.connectors.base import ParseError
from noah.connectors.s4_bpbd_infobanjir import (
    BpbdInfoBanjirConnector,
    dashboard_id_from_page,
    parse_arcgis_features,
    parse_dashboard_definition,
)
from noah.connectors.s5_bmkg_nowcast import (
    BmkgNowcastImageConnector,
    parse_nowcast_rss,
    parse_onset_end,
)
from noah.connectors.s15_petabencana import PetaBencanaConnector, parse_petabencana, reports_url
from noah.connectors.memory import MemorySink
from noah.records import RunStatus

from connector_helpers import FakeFetcher, fixture_bytes, response

UTC = timezone.utc

# --- S4 ---------------------------------------------------------------------


def test_s4_page_embeds_dashboard():
    page = fixture_bytes("s4_infobanjir_page_20261102T1347Z.html")
    assert dashboard_id_from_page(page) == "c2b19d6243dd4a2f80fa1e55481fdb11"


def test_s4_dashboard_definition_fields():
    src = parse_dashboard_definition(fixture_bytes("s4_jakartasatu_dashboard_20261102T1347Z.json"))
    rt = src["3929103a8101453fb6f137605fda6d85/19491b588cd-layer-7"]
    for f in ("WADMKD", "WADMRW", "WADMRT", "TMA", "KATEGORI", "LAST_UPDATE", "LUASWH", "WADMKK"):
        assert f in rt
    gates = src["3929103a8101453fb6f137605fda6d85/19491cebabd-layer-13"]
    assert "KETINGGIAN_AIR_CM" in gates


def test_s4_connector_disabled_without_confirmed_url():
    assert not BpbdInfoBanjirConnector(env={}).enabled
    assert not BpbdInfoBanjirConnector(env={"NOAH_S4_FEATURE_URL": "http://insecure.example"}).enabled
    assert BpbdInfoBanjirConnector(env={"NOAH_S4_FEATURE_URL": "https://gis.example/FeatureServer/0/query?f=json"}).enabled


# CONSTRUCTED, not a real response: the standard ArcGIS REST query shape with
# the field names read from the real dashboard definition. Replace with a real
# fixture once BPBD confirms the layer (needs_endpoint_confirmation).
S4_CONSTRUCTED = {
    "features": [
        {"attributes": {"OBJECTID": 7, "WADMKK": "JAKARTA TIMUR", "WADMKD": "CIPINANG MELAYU", "WADMRW": "004",
                        "WADMRT": "002", "TMA": 40, "KATEGORI": 2, "LUASWH": 0.01, "LAST_UPDATE": 1793619600000}},
        {"attributes": {"OBJECTID": 8, "WADMKK": "JAKARTA TIMUR", "WADMKD": "BIDARA CINA", "WADMRW": "005",
                        "WADMRT": "011", "TMA": 60, "KATEGORI": 3, "LUASWH": 0.02, "LAST_UPDATE": "2026-11-02 21:00"}},
        {"attributes": {"OBJECTID": 9, "WADMKD": "X"}},  # no date: row error
    ]
}


def test_s4_feature_parser_on_constructed_fixture():
    r = parse_arcgis_features(json.dumps(S4_CONSTRUCTED), raw_ref="raw/s4")
    assert r.row_errors == 1 and len(r.flood_reports) == 2
    a, b = r.flood_reports
    assert a.source == "bpbd_rt" and a.ts_start == datetime(2026, 11, 2, 11, 40, tzinfo=UTC)  # epoch ms, UTC
    assert b.ts_start == datetime(2026, 11, 2, 14, 0, tzinfo=UTC)  # text date read as WIB
    assert a.depth_cm is None and a.meta["tma_raw"] == 40 and a.meta["tma_unit"] == "unconfirmed"
    assert a.unit_code is None and a.meta["rt"] == "002"


def test_s4_arcgis_error_is_parse_error():
    with pytest.raises(ParseError):
        parse_arcgis_features(json.dumps({"error": {"code": 499, "message": "Token Required"}}))


# --- S5 ---------------------------------------------------------------------


def test_s5_rss_keeps_only_jakarta():
    r = parse_nowcast_rss(fixture_bytes("s5_bmkg_nowcast_rss_20261102T1348Z.xml"), raw_ref="raw/s5")
    assert r.row_errors == 0 and r.skipped == 12 and len(r.rain_products) == 1
    p = r.rain_products[0]
    assert p.kind == "nowcast" and p.uri == "raw/s5" and p.source == "s5_bmkg_nowcast"
    assert p.meta["region_code"] == "JK" and p.meta["identifier"] == "2.49.0.1.360.0.2026.11.02.13.31.003"
    assert p.issued_at == datetime(2026, 11, 2, 11, 50, tzinfo=UTC)  # 18:50 +0700
    assert p.valid_at.tzinfo is not None and p.valid_at >= p.issued_at
    assert p.meta["valid_at_from"] == "description_onset"


def test_s5_regions_are_configurable_and_offsets_respected():
    r = parse_nowcast_rss(
        fixture_bytes("s5_bmkg_nowcast_rss_20261102T1348Z.xml"), raw_ref="k", regions=frozenset({"SL", "MU"})
    )
    by = {p.meta["region_code"]: p for p in r.rain_products}
    assert by["SL"].issued_at == datetime(2026, 11, 2, 12, 30, tzinfo=UTC)  # 20:30 +0800 WITA
    assert by["MU"].issued_at == datetime(2026, 11, 2, 12, 30, tzinfo=UTC)  # 21:30 +0900 WIT


@pytest.mark.parametrize(
    "text, onset, end",
    [
        (
            "Hujan lebat akan terjadi pada 02 November 2026, 20:00 WIB di sebagian wilayah. "
            "Kondisi diperkirakan dapat berlangsung hingga 02 November 2026, 23:00 WIB.",
            datetime(2026, 11, 2, 13, 0, tzinfo=UTC),
            datetime(2026, 11, 2, 16, 0, tzinfo=UTC),
        ),
        # crosses midnight WIB -> previous UTC day
        ("terjadi pada 3 Januari 2027, 01:30 WIB ... hingga 3 Januari 2027, 04:00 WIB",
         datetime(2027, 1, 2, 18, 30, tzinfo=UTC), datetime(2027, 1, 2, 21, 0, tzinfo=UTC)),
        ("terjadi pada 02 November 2026, 20:30 WITA", datetime(2026, 11, 2, 12, 30, tzinfo=UTC), None),
        ("tanpa waktu", None, None),
    ],
)
def test_s5_onset_end(text, onset, end):
    assert parse_onset_end(text) == (onset, end)


@pytest.mark.parametrize("body", [b"<html>Just a moment...</html>", b"not xml", b"<rss></rss>"])
def test_s5_challenge_page_is_parse_error(body):
    with pytest.raises(ParseError):
        parse_nowcast_rss(body, raw_ref=None)


def test_s5_image_connector_disabled_until_configured():
    assert not BmkgNowcastImageConnector(env={}).enabled


def test_s5_image_stored_as_raw_with_product():
    png = b"\x89PNG\r\n\x1a\n" + b"\0" * 32  # test bytes, not a BMKG image
    fetcher = FakeFetcher([response(png, content_type="image/png",
                                    headers={"Last-Modified": "Mon, 02 Nov 2026 13:40:00 GMT"})])
    c = BmkgNowcastImageConnector(env={"NOAH_S5_IMAGE_URL": "https://img.example/now.png"}, fetcher=fetcher)
    sink = MemorySink()
    run = c.run(sink)
    assert run.status is RunStatus.OK and run.rows_written == 1
    (key, raw), = sink.raw.items()
    assert raw.content == png and key.endswith(".png")
    p = sink.rain_products[0]
    assert p.uri == key and p.issued_at == datetime(2026, 11, 2, 13, 40, tzinfo=UTC)
    assert p.meta["issued_at_from"] == "last_modified" and p.meta["parsed"] is False


def test_s5_image_connector_rejects_html():
    fetcher = FakeFetcher([response(b"<html>challenge</html>", content_type="text/html")])
    c = BmkgNowcastImageConnector(env={"NOAH_S5_IMAGE_URL": "https://img.example/now.png"}, fetcher=fetcher)
    run = c.run(MemorySink())
    assert run.status is RunStatus.FAILED


# --- S15 --------------------------------------------------------------------


def test_s15_real_fixture_has_no_flood_reports():
    r = parse_petabencana(fixture_bytes("s15_petabencana_reports_20261102T1349Z.json"))
    assert r.flood_reports == [] and r.skipped == 2 and r.row_errors == 0


def _flood_variant(**props):
    """CONSTRUCTED from the real fixture: the first feature turned into a
    flood report with PetaBencana's documented ``flood_depth`` field."""
    d = json.loads(fixture_bytes("s15_petabencana_reports_20261102T1349Z.json"))
    f = d["result"]["features"][0]
    f["properties"]["disaster_type"] = "flood"
    f["properties"]["report_data"] = {"report_type": "flood", "flood_depth": 40}
    f["properties"].update(props)
    d["result"]["features"] = [f]
    return json.dumps(d)


def test_s15_flood_report_normalized():
    r = parse_petabencana(_flood_variant(), raw_ref="raw/s15")
    (fr,) = r.flood_reports
    assert fr.source == "petabencana" and fr.external_id == "399957"
    assert fr.ts_start == datetime(2026, 10, 29, 7, 23, 14, 89000, tzinfo=UTC)
    assert fr.depth_cm == 40.0 and fr.unit_code == "11017"
    assert (fr.lon, fr.lat) == (106.8277, -6.1752)
    assert fr.meta["quality_flag"] == "ok"
    # no free text or images ever reach a record
    assert not {"text", "title", "image_url", "url"} & set(fr.meta)


def test_s15_out_of_range_depth_flagged_not_dropped():
    body = _flood_variant(report_data={"report_type": "flood", "flood_depth": 900})
    (fr,) = parse_petabencana(body).flood_reports
    assert fr.depth_cm == 900.0 and fr.meta["quality_flag"] == "suspect"


def test_s15_outside_dki_skipped():
    body = _flood_variant(tags={"instance_region_code": "ID-JB", "region_code": "3271"})
    r = parse_petabencana(body)
    assert r.flood_reports == [] and r.skipped == 1


def test_s15_naive_timestamp_is_row_error():
    r = parse_petabencana(_flood_variant(created_at="2026-10-29 07:23:14"))
    assert r.row_errors == 1 and r.flood_reports == []


@pytest.mark.parametrize("window, seconds", [("1h", 3600), ("24h", 86400), ("7d", 604800)])
def test_s15_timeperiod_is_what_we_ask_for(window, seconds):
    assert f"timeperiod={seconds}&" in reports_url(window)
    assert "admin=ID-JK" in reports_url(window)


@pytest.mark.parametrize("bad", ["2h", "", "1H", "30m"])
def test_s15_unknown_window_rejected(bad):
    with pytest.raises(ValueError):
        reports_url(bad)


def test_s15_default_poll_window_is_one_hour():
    assert "timeperiod=3600&" in PetaBencanaConnector(env={}).url


def test_s15_repoll_is_idempotent():
    body = _flood_variant().encode()
    other = body.replace(b'"pkey": "399957"', b'"pkey": "399958"')
    fetcher = FakeFetcher([response(body, content_type="application/json"),
                           response(other, content_type="application/json")])
    c, sink = PetaBencanaConnector(env={}, fetcher=fetcher), MemorySink()
    assert c.run(sink).rows_written == 1
    # second poll: overlapping window returns the old report again plus nothing new
    assert c.run(sink).rows_written == 1  # the new pkey only
    assert [r.external_id for r in sink.flood_reports] == ["399957", "399958"]


@pytest.mark.parametrize("body", [b'{"statusCode": 500}', b"<html>", b'{"statusCode": 200, "result": {}}'])
def test_s15_bad_envelope(body):
    with pytest.raises(ParseError):
        parse_petabencana(body)
