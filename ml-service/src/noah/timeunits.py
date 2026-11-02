"""Shared time and unit helpers (B-029, Python half).

Conventions (CLAUDE.md, guardrail 8):
- Storage and computation use timezone-aware UTC datetimes only.
- WIB (Asia/Jakarta) is used only at the edges: parsing source-local
  timestamps and formatting for display.
- Water level in cm relative to the station datum, rainfall in mm,
  discharge in m3/s. Convert only at connector edges.

WIB is a fixed UTC+07:00 offset. Indonesia has not observed daylight saving
time since 1964, so a fixed offset is exact for every record this project
handles and avoids depending on the OS tz database (absent on Windows and
on some slim container images).

Converters do no range checking: negative values (for example levels below a
station datum) pass through unchanged. Flagging is the connector's job;
values are never dropped here.
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from numbers import Real

__all__ = [
    "UTC",
    "WIB",
    "utc_now",
    "ensure_utc",
    "parse_wib_local",
    "to_wib",
    "format_wib",
    "to_iso_utc",
    "LENGTH_UNITS",
    "length_to_cm",
    "mm_to_cm",
    "dm_to_cm",
    "m_to_cm",
    "cm_to_mm",
    "lps_to_m3s",
]

UTC = timezone.utc
WIB = timezone(timedelta(hours=7), "WIB")


# --------------------------------------------------------------------------
# Time
# --------------------------------------------------------------------------


def utc_now() -> datetime:
    """Current time as an aware UTC datetime."""
    return datetime.now(UTC)


def ensure_utc(dt: datetime) -> datetime:
    """Return ``dt`` converted to UTC. Naive datetimes are rejected.

    A naive datetime has no defined instant, so guessing would silently
    shift data by up to seven hours.
    """
    if not isinstance(dt, datetime):
        raise TypeError(f"expected datetime, got {type(dt).__name__}")
    if dt.tzinfo is None or dt.utcoffset() is None:
        raise ValueError("naive datetime; attach a timezone or use parse_wib_local()")
    return dt.astimezone(UTC)


def parse_wib_local(value: str | datetime) -> datetime:
    """Parse a source timestamp that is in Jakarta local time; return aware UTC.

    - Naive input (no offset) is interpreted as WIB.
    - Input that already carries an offset is respected and converted.

    Accepts a ``datetime`` or an ISO 8601 string (``YYYY-MM-DD HH:MM[:SS]``
    with ``T`` or a space as the separator).
    """
    if isinstance(value, str):
        text = value.strip()
        if not text:
            raise ValueError("empty timestamp")
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        dt = datetime.fromisoformat(text)
    elif isinstance(value, datetime):
        dt = value
    else:
        raise TypeError(f"expected str or datetime, got {type(value).__name__}")

    if dt.tzinfo is None or dt.utcoffset() is None:
        dt = dt.replace(tzinfo=WIB)
    return dt.astimezone(UTC)


def to_wib(dt: datetime) -> datetime:
    """Convert an aware datetime to WIB for display. Naive input is rejected."""
    return ensure_utc(dt).astimezone(WIB)


def format_wib(dt: datetime, fmt: str = "%Y-%m-%d %H:%M WIB") -> str:
    """Format an aware datetime in WIB. The default suffix makes the zone explicit."""
    return to_wib(dt).strftime(fmt)


def to_iso_utc(dt: datetime) -> str:
    """ISO 8601 UTC string with a ``Z`` suffix, for JSON payloads."""
    return ensure_utc(dt).isoformat().replace("+00:00", "Z")


# --------------------------------------------------------------------------
# Units
# --------------------------------------------------------------------------

# Conversion to centimetres expressed as (multiply, divide) so that the common
# cases stay exact in binary floating point (4870 mm -> 487.0 cm, not
# 487.00000000000006).
_CM_FACTORS: dict[str, tuple[int, int]] = {
    "mm": (1, 10),
    "cm": (1, 1),
    "dm": (10, 1),
    "m": (100, 1),
}

LENGTH_UNITS: frozenset[str] = frozenset(_CM_FACTORS)


def _as_number(value: object) -> float:
    # bool is a subclass of int; a True water level is always a bug.
    if isinstance(value, bool) or not isinstance(value, Real):
        raise TypeError(f"expected a real number, got {type(value).__name__}")
    number = float(value)
    if math.isinf(number):
        raise ValueError("infinite value")
    return number


def length_to_cm(value: float, unit: str) -> float:
    """Convert a length (water level, depth) in ``unit`` to centimetres.

    ``unit`` is one of ``mm``, ``cm``, ``dm``, ``m`` (case-insensitive).
    NaN passes through as NaN so a missing reading stays missing.
    """
    if not isinstance(unit, str):
        raise TypeError("unit must be a string")
    key = unit.strip().lower()
    if key not in _CM_FACTORS:
        raise ValueError(f"unknown length unit {unit!r}; expected one of {sorted(LENGTH_UNITS)}")
    number = _as_number(value)
    mul, div = _CM_FACTORS[key]
    return number * mul / div


def mm_to_cm(value: float) -> float:
    return length_to_cm(value, "mm")


def dm_to_cm(value: float) -> float:
    return length_to_cm(value, "dm")


def m_to_cm(value: float) -> float:
    return length_to_cm(value, "m")


def cm_to_mm(value: float) -> float:
    return _as_number(value) * 10


def lps_to_m3s(value: float) -> float:
    """Litres per second to cubic metres per second (pump capacity, discharge)."""
    return _as_number(value) / 1000
