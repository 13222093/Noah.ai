import math
from datetime import datetime, timedelta, timezone

import pytest

from noah.timeunits import (
    UTC,
    WIB,
    cm_to_mm,
    dm_to_cm,
    ensure_utc,
    format_wib,
    length_to_cm,
    lps_to_m3s,
    m_to_cm,
    mm_to_cm,
    parse_wib_local,
    to_iso_utc,
    to_wib,
    utc_now,
)

# --- time -----------------------------------------------------------------


@pytest.mark.parametrize(
    "local, expected_utc",
    [
        # plain
        ("2020-01-01 12:00", datetime(2020, 1, 1, 5, 0, tzinfo=UTC)),
        ("2020-01-01T12:00:30", datetime(2020, 1, 1, 5, 0, 30, tzinfo=UTC)),
        # day boundary: early-morning WIB is the previous UTC day
        ("2020-01-01 00:00", datetime(2019, 12, 31, 17, 0, tzinfo=UTC)),
        ("2020-01-01 06:59:59", datetime(2019, 12, 31, 23, 59, 59, tzinfo=UTC)),
        ("2020-01-01 07:00", datetime(2020, 1, 1, 0, 0, tzinfo=UTC)),
        # month and year boundary
        ("2020-03-01 03:10", datetime(2020, 2, 29, 20, 10, tzinfo=UTC)),
        # explicit offsets are respected, not reinterpreted as WIB
        ("2020-01-01T12:00:00+07:00", datetime(2020, 1, 1, 5, 0, tzinfo=UTC)),
        ("2020-01-01T12:00:00Z", datetime(2020, 1, 1, 12, 0, tzinfo=UTC)),
        ("2020-01-01T12:00:00+00:00", datetime(2020, 1, 1, 12, 0, tzinfo=UTC)),
        (datetime(2020, 1, 1, 0, 0), datetime(2019, 12, 31, 17, 0, tzinfo=UTC)),
    ],
)
def test_parse_wib_local(local, expected_utc):
    got = parse_wib_local(local)
    assert got == expected_utc
    assert got.utcoffset() == timedelta(0)


@pytest.mark.parametrize("bad", ["", "   ", "not a date", "2020-13-01 00:00"])
def test_parse_wib_local_rejects_garbage(bad):
    with pytest.raises(ValueError):
        parse_wib_local(bad)


def test_parse_wib_local_rejects_wrong_type():
    with pytest.raises(TypeError):
        parse_wib_local(1577836800)


@pytest.mark.parametrize(
    "utc_dt, wib_text",
    [
        (datetime(2020, 1, 1, 5, 0, tzinfo=UTC), "2020-01-01 12:00 WIB"),
        # day boundary: late UTC evening is the next WIB day
        (datetime(2019, 12, 31, 17, 0, tzinfo=UTC), "2020-01-01 00:00 WIB"),
        (datetime(2019, 12, 31, 16, 59, tzinfo=UTC), "2019-12-31 23:59 WIB"),
        # non-UTC aware input is converted, not relabelled
        (datetime(2020, 1, 1, 12, 0, tzinfo=timezone(timedelta(hours=9))), "2020-01-01 10:00 WIB"),
    ],
)
def test_format_wib(utc_dt, wib_text):
    assert format_wib(utc_dt) == wib_text


def test_wib_round_trip():
    instant = datetime(2026, 11, 2, 23, 30, tzinfo=UTC)
    wib = to_wib(instant)
    assert wib.utcoffset() == timedelta(hours=7)
    assert (wib.year, wib.month, wib.day, wib.hour) == (2026, 11, 3, 6)
    assert ensure_utc(wib) == instant
    assert parse_wib_local(wib.replace(tzinfo=None)) == instant


@pytest.mark.parametrize("fn", [ensure_utc, to_wib, format_wib, to_iso_utc])
def test_naive_datetimes_are_rejected(fn):
    with pytest.raises(ValueError):
        fn(datetime(2020, 1, 1, 12, 0))


def test_to_iso_utc():
    assert to_iso_utc(datetime(2020, 1, 1, 12, 0, tzinfo=WIB)) == "2020-01-01T05:00:00Z"


def test_utc_now_is_aware_utc():
    now = utc_now()
    assert now.utcoffset() == timedelta(0)


# --- units ----------------------------------------------------------------


@pytest.mark.parametrize(
    "value, unit, cm",
    [
        (4870, "mm", 487.0),  # Manggarai, S2 archive (mm)
        (9690, "mm", 969.0),
        (5, "mm", 0.5),
        (0, "mm", 0.0),
        (-120, "mm", -12.0),  # below datum passes through
        (55.15, "dm", 551.5),  # the old decimetre CSV
        (96.75, "dm", 967.5),
        (7.5, "m", 750.0),
        (0.01, "m", 1.0),
        (850, "cm", 850.0),
        (850, "CM", 850.0),
        (850, " cm ", 850.0),
    ],
)
def test_length_to_cm(value, unit, cm):
    assert length_to_cm(value, unit) == pytest.approx(cm, abs=1e-9)


@pytest.mark.parametrize(
    "fn, value, expected",
    [
        (mm_to_cm, 4870, 487.0),
        (dm_to_cm, 85, 850.0),
        (m_to_cm, 9.5, 950.0),
        (cm_to_mm, 487, 4870.0),
        (lps_to_m3s, 500, 0.5),
        (lps_to_m3s, 2500, 2.5),
        (lps_to_m3s, 0, 0.0),
    ],
)
def test_named_converters(fn, value, expected):
    assert fn(value) == pytest.approx(expected, abs=1e-12)


def test_mm_exact_for_integer_inputs():
    assert mm_to_cm(4870) == 487.0


@pytest.mark.parametrize("cm", [0.0, 0.5, 487.0, 969.0, -12.3])
def test_mm_cm_round_trip(cm):
    assert mm_to_cm(cm_to_mm(cm)) == pytest.approx(cm, abs=1e-9)


def test_nan_passes_through():
    assert math.isnan(mm_to_cm(float("nan")))


@pytest.mark.parametrize("unit", ["km", "inch", "", "mm/h"])
def test_unknown_length_unit(unit):
    with pytest.raises(ValueError):
        length_to_cm(1.0, unit)


@pytest.mark.parametrize("bad", [True, "487", None])
def test_non_numeric_rejected(bad):
    with pytest.raises(TypeError):
        mm_to_cm(bad)


def test_infinite_rejected():
    with pytest.raises(ValueError):
        lps_to_m3s(float("inf"))
