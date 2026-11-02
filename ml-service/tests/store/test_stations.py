"""B-034: station configuration and Siaga thresholds (D12)."""

from __future__ import annotations

import copy
from pathlib import Path

import pytest
import yaml

from noah.importers import s2_tma_2020 as s2
from noah.store.stations import (
    SIAGA_LEVELS,
    SiagaThresholds,
    StationConfigError,
    default_config_path,
    load_station_config,
    parse_station_config,
)


@pytest.fixture(scope="module")
def raw_config():
    with open(default_config_path(), encoding="utf-8") as fh:
        return yaml.safe_load(fh)


@pytest.fixture(scope="module")
def config(raw_config):
    return parse_station_config(raw_config)


S1_FIXTURE = (
    Path(__file__).resolve().parents[1] / "connectors" / "fixtures" / "s1_posko_banjir_20261102T1342Z.html"
)


def _s2_label(st):
    return next((i.external_id for i in st.identities if i.source == "s2_opendata"), None)


def test_config_covers_37_s1_posts_and_21_s2_posts(config):
    assert len({s.code for s in config.stations}) == len(config.stations) == 38
    assert all(s.unit == "cm" and s.kind == "tma" for s in config.stations)
    s1 = [s for s in config.stations if s.source == "s1_posko_banjir"]
    assert len(s1) == 37 and all(s.external_id.isdigit() and s.external_id_confirmed for s in s1)
    assert len([s for s in config.stations if _s2_label(s)]) == 21
    assert [s.code for s in config.stations if not s.active] == ["cipinang_hulu"]


@pytest.mark.skipif(not S1_FIXTURE.exists(), reason="S1 fixture not in this checkout")
def test_thresholds_match_the_s1_page(config):
    """Every non-null threshold is what DSDA publishes on the Posko Banjir
    page (mm / 10); placeholder posts (5000 mm everywhere) stay null."""
    from noah.connectors.s1_posko_banjir import station_catalog

    catalog = {c["external_id"]: c for c in station_catalog(S1_FIXTURE.read_bytes())}
    assert set(catalog) == {s.external_id for s in config.stations if s.source == "s1_posko_banjir"}
    for st in config.stations:
        if st.source != "s1_posko_banjir":
            continue
        page = catalog[st.external_id]["siaga_thresholds_cm"]
        page_vals = (page["siaga3"], page["siaga2"], page["siaga1"])
        mine = tuple(st.siaga.value(lv) for lv in SIAGA_LEVELS)
        if len(set(page_vals)) == 1:  # placeholder
            assert mine == (None, None, None), st.code
            assert st.siaga.source is None and st.siaga.needs_dsda_confirmation
        else:
            assert mine == page_vals, st.code


def test_manggarai_official_thresholds(config):
    th = config.by_code("manggarai").siaga
    assert (th.siaga_3_cm, th.siaga_2_cm, th.siaga_1_cm) == (750, 850, 950)
    assert th.source == "dsda_official"
    assert th.needs_dsda_confirmation is False


def test_only_official_thresholds_skip_confirmation(config):
    for st in config.stations:
        if st.siaga.source != "dsda_official":
            assert st.siaga.needs_dsda_confirmation, st.code
        if st.siaga.source is None:
            assert not st.siaga.any_known, st.code


def test_thresholds_increase_with_severity(config):
    for st in config.stations:
        known = [st.siaga.value(lv) for lv in SIAGA_LEVELS if st.siaga.value(lv) is not None]
        assert known == sorted(known) and len(set(known)) == len(known), st.code


def test_identity_lookup(config):
    assert config.by_identity("s2_opendata", "PA. Manggarai").code == "manggarai"
    assert config.by_identity("s1_posko_banjir", "122").code == "manggarai"
    assert config.by_identity("s2_opendata", "nope") is None


@pytest.mark.parametrize(
    "level, status, certain",
    [(749, "normal", True), (750, "siaga_3", True), (849.9, "siaga_3", True), (850, "siaga_2", True),
     (951, "siaga_1", True), (1200, "siaga_1", True)],
)
def test_classify_manggarai(config, level, status, certain):
    c = config.by_code("manggarai").siaga.classify(level)
    assert (c.status, c.certain) == (status, certain)


def test_classify_with_unknown_levels(config):
    only_s3 = SiagaThresholds("dsda_posko_banjir_page", True, siaga_3_cm=200)
    assert only_s3.classify(300).status == "siaga_3" and not only_s3.classify(300).certain
    assert only_s3.classify(150).status == "normal" and only_s3.classify(150).certain
    only_s2 = SiagaThresholds("dsda_posko_banjir_page", True, siaga_2_cm=550)
    assert only_s2.classify(500).status == "normal" and not only_s2.classify(500).certain
    strict = SiagaThresholds("dsda_official", False, 750, 850, 950, comparison=">")
    assert strict.classify(750).status == "normal"
    assert config.by_code("tipala").siaga.classify(500).status is None  # placeholder post


def test_pluit_negative_thresholds(config):
    pluit = config.by_code("pluit")
    assert pluit.allows_negative
    assert pluit.siaga.classify(-172).status == "normal"
    assert pluit.siaga.classify(-50).status == "siaga_3"


@pytest.mark.skipif(not s2.DEFAULT_PATH.exists(), reason="tma_2020.xlsx.csv not in this checkout")
def test_s2_evidence_matches_the_derivation(config):
    """evidence.s2_2020 is reproducible from the archive (nothing invented),
    the rule reproduces Manggarai's official values, and where both exist the
    2020 values agree with today's page except at the two known posts."""
    rows, _ = s2.parse_rows(s2.DEFAULT_PATH.read_text(encoding="utf-8"))
    derived = s2.derive_siaga_thresholds(rows)
    assert {lv: derived["PA. Manggarai"]["levels"][lv]["value_cm"] for lv in SIAGA_LEVELS} == {
        "siaga_3": 750.0, "siaga_2": 850.0, "siaga_1": 950.0,
    }
    changed = set()
    for st in config.stations:
        label = _s2_label(st)
        if label is None:
            continue
        ev = st.siaga.evidence["s2_2020"]
        for lv in SIAGA_LEVELS:
            d = derived[label]["levels"][lv]
            assert ev[lv]["value_cm"] == d["value_cm"], (st.code, lv)
            assert ev[lv]["max_below_cm"] == d["max_below_cm"] and ev[lv]["min_at_cm"] == d["min_at_cm"]
            if d["value_cm"] is not None and d["value_cm"] != st.siaga.value(lv):
                changed.add(st.code)
    assert changed == {"cibalok_gadog", "jembatan_merah"}


# ---------------------------------------------------------------- validation


def _one_station(raw_config, code="manggarai"):
    doc = copy.deepcopy(raw_config)
    doc["stations"] = [s for s in doc["stations"] if s["code"] == code]
    return doc


def _errors(doc):
    with pytest.raises(StationConfigError) as exc:
        parse_station_config(doc)
    return "\n".join(exc.value.errors)


def test_rejects_decreasing_thresholds(raw_config):
    doc = _one_station(raw_config)
    doc["stations"][0]["siaga_thresholds"]["siaga_2_cm"] = 700
    assert "must increase" in _errors(doc)


def test_rejects_derived_without_confirmation_flag(raw_config):
    doc = _one_station(raw_config, "depok")
    doc["stations"][0]["siaga_thresholds"]["needs_DSDA_confirmation"] = False
    doc["stations"][0]["siaga_thresholds"]["source"] = "derived_from_S2_2020"
    assert "needs_DSDA_confirmation: true" in _errors(doc)


def test_rejects_values_without_source(raw_config):
    doc = _one_station(raw_config, "depok")
    doc["stations"][0]["siaga_thresholds"]["source"] = None
    assert "without a source" in _errors(doc)


def test_rejects_unknown_source_and_bad_comparison(raw_config):
    doc = _one_station(raw_config)
    doc["stations"][0]["siaga_thresholds"]["source"] = "guess"
    doc["stations"][0]["siaga_thresholds"]["comparison"] = "~"
    errs = _errors(doc)
    assert "unknown threshold source" in errs and "comparison" in errs


def test_rejects_duplicate_identity(raw_config):
    doc = copy.deepcopy(raw_config)
    doc["stations"][1]["aliases"].append({"source": "s1_posko_banjir", "external_id": "122"})
    assert "already used by" in _errors(doc)


def test_rejects_non_cm_water_level_and_missing_datum(raw_config):
    doc = _one_station(raw_config)
    doc["stations"][0]["unit"] = "mm"
    doc["stations"][0]["datum_note"] = ""
    errs = _errors(doc)
    assert "store cm" in errs and "datum_note" in errs


def test_rejects_coordinates_outside_jakarta(raw_config):
    doc = _one_station(raw_config)
    doc["stations"][0]["location"]["lat"] = 6.2  # sign error
    assert "latitude" in _errors(doc)


def test_rejects_untrimmed_external_id(raw_config):
    doc = _one_station(raw_config)
    doc["stations"][0]["external_id"] = "122 "
    assert "spaces" in _errors(doc)


def test_load_from_explicit_path(tmp_path, raw_config):
    p = tmp_path / "stations.yaml"
    p.write_text(yaml.safe_dump(_one_station(raw_config)), encoding="utf-8")
    assert [s.code for s in load_station_config(p).stations] == ["manggarai"]
