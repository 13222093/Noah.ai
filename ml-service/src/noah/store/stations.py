"""Station configuration: metadata, datum notes and Siaga thresholds (B-034, D12).

Stations and their thresholds are configuration, not code
(``docs/plan/04_DATA_SOURCES.md``). The single source of truth is
``config/stations.yaml`` (override with ``NOAH_STATIONS_CONFIG``). Code that
needs a threshold reads it from here; no threshold literal belongs anywhere
else.

Threshold provenance is explicit on every station:
- ``dsda_official``: from DSDA's published table (plan 04).
- ``derived_from_S2_2020``: inferred from the ``status_siaga`` labels in the
  S2 archive by ``noah.importers.s2_tma_2020.derive_siaga_thresholds``;
  always ``needs_DSDA_confirmation: true``.
- ``null``: unknown. Never guessed.

CLI::

    python -m noah.store.stations            # validate and summarize
    python -m noah.store.stations --apply    # upsert into the DB (NOAH_DATABASE_URL)
"""

from __future__ import annotations

import argparse
import math
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable, Mapping

__all__ = [
    "SIAGA_LEVELS",
    "THRESHOLD_SOURCES",
    "StationConfigError",
    "StationIdentity",
    "SiagaThresholds",
    "SiagaClass",
    "Station",
    "QcConfig",
    "StationConfig",
    "default_config_path",
    "load_station_config",
    "parse_station_config",
    "apply_station_config",
]

# Increasing severity. In DSDA usage Siaga 3 is the lowest alert and Siaga 1
# the highest (the hackathon UI had this inverted, G-046).
SIAGA_LEVELS: tuple[str, ...] = ("siaga_3", "siaga_2", "siaga_1")
THRESHOLD_SOURCES = frozenset({"dsda_official", "dsda_posko_banjir_page", "derived_from_S2_2020"})
STATION_KINDS = frozenset({"tma", "arr", "pump", "gate", "cctv"})
UNITS = frozenset({"cm", "mm", "m3/s"})
COMPARISONS = frozenset({">=", ">"})

# Loose box around Jabodetabek and the upper Ciliwung (Gadog, Katulampa).
_LAT_RANGE = (-6.9, -5.9)
_LON_RANGE = (106.4, 107.2)


class StationConfigError(ValueError):
    def __init__(self, errors: list[str]):
        self.errors = errors
        super().__init__("invalid station config:\n  - " + "\n  - ".join(errors))


@dataclass(frozen=True, slots=True)
class StationIdentity:
    source: str
    external_id: str
    confirmed: bool = False


@dataclass(frozen=True, slots=True)
class SiagaClass:
    """Result of classifying a level. ``status`` is ``normal`` or a Siaga
    level, or None when no threshold is known. ``certain`` is False when an
    unknown threshold means the true status could be higher."""

    status: str | None
    certain: bool


@dataclass(frozen=True, slots=True)
class SiagaThresholds:
    source: str | None
    needs_dsda_confirmation: bool
    siaga_3_cm: float | None = None
    siaga_2_cm: float | None = None
    siaga_1_cm: float | None = None
    comparison: str = ">="
    reference: str | None = None
    note: str | None = None
    evidence: Mapping[str, Any] = field(default_factory=dict)

    def value(self, level: str) -> float | None:
        return {
            "siaga_3": self.siaga_3_cm,
            "siaga_2": self.siaga_2_cm,
            "siaga_1": self.siaga_1_cm,
        }[level]

    @property
    def any_known(self) -> bool:
        return any(self.value(lv) is not None for lv in SIAGA_LEVELS)

    def _meets(self, level_cm: float, threshold: float) -> bool:
        return level_cm >= threshold if self.comparison == ">=" else level_cm > threshold

    def classify(self, level_cm: float) -> SiagaClass:
        """Siaga status of a water level in cm, using only configured values."""
        if level_cm is None or (isinstance(level_cm, float) and math.isnan(level_cm)):
            return SiagaClass(None, False)
        if not self.any_known:
            return SiagaClass(None, False)
        met: int | None = None  # index into SIAGA_LEVELS of the highest known level met
        for i, lv in enumerate(SIAGA_LEVELS):
            t = self.value(lv)
            if t is not None and self._meets(level_cm, t):
                met = i
        if met is None:
            # Below every known threshold; "normal" is certain only if Siaga 3 is known.
            return SiagaClass("normal", self.siaga_3_cm is not None)
        higher = SIAGA_LEVELS[met + 1 :]
        certain = all(self.value(lv) is not None for lv in higher[:1])
        return SiagaClass(SIAGA_LEVELS[met], certain)

    def as_json(self) -> dict[str, Any]:
        return {
            "source": self.source,
            "needs_DSDA_confirmation": self.needs_dsda_confirmation,
            "comparison": self.comparison,
            "siaga_3_cm": self.siaga_3_cm,
            "siaga_2_cm": self.siaga_2_cm,
            "siaga_1_cm": self.siaga_1_cm,
            "reference": self.reference,
            "note": self.note,
            "evidence": dict(self.evidence),
        }


@dataclass(frozen=True, slots=True)
class Station:
    code: str
    name: str
    kind: str
    source: str
    external_id: str
    external_id_confirmed: bool
    unit: str
    datum_note: str
    siaga: SiagaThresholds
    aliases: tuple[StationIdentity, ...] = ()
    river: str | None = None
    lat: float | None = None
    lon: float | None = None
    location_source: str | None = None
    location_needs_verification: bool = True
    allows_negative: bool = False
    active: bool = True
    note: str | None = None

    @property
    def identities(self) -> tuple[StationIdentity, ...]:
        home = StationIdentity(self.source, self.external_id, self.external_id_confirmed)
        return (home, *self.aliases)


@dataclass(frozen=True, slots=True)
class QcConfig:
    """Generic range-check parameters used by importers and connectors to set
    ``quality_flag`` (flag, never drop). Not hydrological thresholds."""

    spike_cm: float = 100.0
    spike_max_gap_minutes: float = 180.0


@dataclass(frozen=True, slots=True)
class StationConfig:
    version: int
    stations: tuple[Station, ...]
    qc: QcConfig = QcConfig()

    def by_code(self, code: str) -> Station:
        for st in self.stations:
            if st.code == code:
                return st
        raise KeyError(code)

    def by_identity(self, source: str, external_id: str) -> Station | None:
        for st in self.stations:
            for ident in st.identities:
                if ident.source == source and ident.external_id == external_id:
                    return st
        return None


def default_config_path() -> Path:
    """``NOAH_STATIONS_CONFIG``, else ``<base>/config/stations.yaml``
    (``noah.paths``): the repository root in a checkout, ``/app`` in the image."""
    from noah.paths import stations_config_path

    return stations_config_path()


def load_station_config(path: str | os.PathLike[str] | None = None) -> StationConfig:
    import yaml  # pinned in requirements.txt

    p = Path(path) if path is not None else default_config_path()
    with open(p, encoding="utf-8") as fh:
        raw = yaml.safe_load(fh)
    return parse_station_config(raw)


# --------------------------------------------------------------------------
# Validation
# --------------------------------------------------------------------------


def _num(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise TypeError(f"expected a number or null, got {value!r}")
    if math.isnan(value) or math.isinf(value):
        raise ValueError("NaN or infinite threshold")
    return float(value)


def _parse_thresholds(where: str, raw: Any, errors: list[str]) -> SiagaThresholds:
    if not isinstance(raw, Mapping):
        errors.append(f"{where}: siaga_thresholds must be a mapping")
        return SiagaThresholds(None, True)
    src = raw.get("source")
    needs = raw.get("needs_DSDA_confirmation")
    if src is not None and src not in THRESHOLD_SOURCES:
        errors.append(f"{where}: unknown threshold source {src!r}")
    if not isinstance(needs, bool):
        errors.append(f"{where}: needs_DSDA_confirmation must be true or false")
        needs = True
    values: dict[str, float | None] = {}
    for lv in SIAGA_LEVELS:
        try:
            values[lv] = _num(raw.get(f"{lv}_cm"))
        except (TypeError, ValueError) as exc:
            errors.append(f"{where}: {lv}_cm {exc}")
            values[lv] = None
    known = [(lv, v) for lv, v in values.items() if v is not None]
    for (lv_a, a), (lv_b, b) in zip(known, known[1:]):
        if not a < b:
            errors.append(f"{where}: thresholds must increase {lv_a} < {lv_b} (got {a} >= {b})")
    if src is None and known:
        errors.append(f"{where}: threshold values given without a source")
    if src is not None and not known:
        errors.append(f"{where}: source {src!r} given but every threshold is null")
    if src != "dsda_official" and needs is not True:
        errors.append(f"{where}: thresholds that are not dsda_official need needs_DSDA_confirmation: true")
    comparison = raw.get("comparison", ">=")
    if comparison not in COMPARISONS:
        errors.append(f"{where}: comparison must be one of {sorted(COMPARISONS)}")
        comparison = ">="
    evidence = raw.get("evidence") or {}
    if not isinstance(evidence, Mapping):
        errors.append(f"{where}: evidence must be a mapping")
        evidence = {}
    return SiagaThresholds(
        source=src,
        needs_dsda_confirmation=bool(needs),
        siaga_3_cm=values["siaga_3"],
        siaga_2_cm=values["siaga_2"],
        siaga_1_cm=values["siaga_1"],
        comparison=comparison,
        reference=raw.get("reference"),
        note=raw.get("note"),
        evidence=dict(evidence),
    )


def _req_str(where: str, raw: Mapping[str, Any], key: str, errors: list[str]) -> str:
    value = raw.get(key)
    if not isinstance(value, str) or not value.strip():
        errors.append(f"{where}: {key} is required")
        return ""
    if value != value.strip() or "  " in value:
        errors.append(f"{where}: {key} has leading, trailing or double spaces")
    return value


def parse_station_config(raw: Any) -> StationConfig:
    """Validate a parsed YAML document and build the config. All problems are
    reported together in one ``StationConfigError``."""
    errors: list[str] = []
    if not isinstance(raw, Mapping):
        raise StationConfigError(["top level must be a mapping"])
    version = raw.get("version")
    if version != 1:
        errors.append("version must be 1")
    qc_raw = raw.get("qc") or {}
    qc_default = QcConfig()
    try:
        qc = QcConfig(
            spike_cm=float(qc_raw.get("spike_cm", qc_default.spike_cm)),
            spike_max_gap_minutes=float(qc_raw.get("spike_max_gap_minutes", qc_default.spike_max_gap_minutes)),
        )
    except (TypeError, ValueError):
        errors.append("qc values must be numbers")
        qc = QcConfig()

    items = raw.get("stations")
    if not isinstance(items, list) or not items:
        raise StationConfigError(errors + ["stations must be a non-empty list"])

    stations: list[Station] = []
    seen_codes: set[str] = set()
    seen_ids: dict[tuple[str, str], str] = {}
    for idx, item in enumerate(items):
        where = f"stations[{idx}]"
        if not isinstance(item, Mapping):
            errors.append(f"{where}: must be a mapping")
            continue
        code = _req_str(where, item, "code", errors)
        where = f"station {code or idx}"
        if code in seen_codes:
            errors.append(f"{where}: duplicate code")
        seen_codes.add(code)
        name = _req_str(where, item, "name", errors)
        kind = item.get("kind")
        if kind not in STATION_KINDS:
            errors.append(f"{where}: kind must be one of {sorted(STATION_KINDS)}")
        unit = item.get("unit")
        if unit not in UNITS:
            errors.append(f"{where}: unit must be one of {sorted(UNITS)}")
        if kind == "tma" and unit != "cm":
            errors.append(f"{where}: water level stations store cm (CLAUDE.md)")
        source = _req_str(where, item, "source", errors)
        external_id = _req_str(where, item, "external_id", errors)
        datum_note = item.get("datum_note")
        if not isinstance(datum_note, str) or not datum_note.strip():
            errors.append(f"{where}: datum_note is required (say 'unknown' and why if unknown)")
            datum_note = ""

        aliases: list[StationIdentity] = []
        for a_idx, alias in enumerate(item.get("aliases") or []):
            aw = f"{where} aliases[{a_idx}]"
            if not isinstance(alias, Mapping):
                errors.append(f"{aw}: must be a mapping")
                continue
            a_src = _req_str(aw, alias, "source", errors)
            a_ext = _req_str(aw, alias, "external_id", errors)
            aliases.append(StationIdentity(a_src, a_ext, bool(alias.get("confirmed", False))))
        for ident in [StationIdentity(source, external_id), *aliases]:
            key = (ident.source, ident.external_id)
            if key in seen_ids and seen_ids[key] != code:
                errors.append(f"{where}: identity {key} already used by {seen_ids[key]}")
            elif key in seen_ids:
                errors.append(f"{where}: identity {key} listed twice")
            seen_ids[key] = code

        loc = item.get("location") or {}
        lat = lon = None
        if loc:
            try:
                lat, lon = _num(loc.get("lat")), _num(loc.get("lon"))
            except (TypeError, ValueError) as exc:
                errors.append(f"{where}: location {exc}")
            if lat is not None and not (_LAT_RANGE[0] <= lat <= _LAT_RANGE[1]):
                errors.append(f"{where}: latitude {lat} outside the Jakarta region")
            if lon is not None and not (_LON_RANGE[0] <= lon <= _LON_RANGE[1]):
                errors.append(f"{where}: longitude {lon} outside the Jakarta region")
            if (lat is None) != (lon is None):
                errors.append(f"{where}: give both lat and lon or neither")

        siaga = _parse_thresholds(where, item.get("siaga_thresholds"), errors)
        stations.append(
            Station(
                code=code,
                name=name,
                kind=str(kind),
                source=source,
                external_id=external_id,
                external_id_confirmed=bool(item.get("external_id_confirmed", False)),
                unit=str(unit),
                datum_note=datum_note,
                siaga=siaga,
                aliases=tuple(aliases),
                river=item.get("river"),
                lat=lat,
                lon=lon,
                location_source=loc.get("source") if loc else None,
                location_needs_verification=bool(loc.get("needs_verification", True)) if loc else True,
                allows_negative=bool(item.get("allows_negative", False)),
                active=bool(item.get("active", True)),
                note=item.get("note"),
            )
        )
    if errors:
        raise StationConfigError(errors)
    return StationConfig(version=1, stations=tuple(stations), qc=qc)


# --------------------------------------------------------------------------
# Database
# --------------------------------------------------------------------------

_UPSERT_STATION = """
INSERT INTO stations (code, source, external_id, name, kind, geom, datum_note, unit,
                      siaga_thresholds, active, meta)
VALUES (%(code)s, %(source)s, %(external_id)s, %(name)s, %(kind)s,
        CASE WHEN %(lon)s::float8 IS NULL THEN NULL
             ELSE ST_SetSRID(ST_MakePoint(%(lon)s::float8, %(lat)s::float8), 4326) END,
        %(datum_note)s, %(unit)s, %(siaga)s, %(active)s, %(meta)s)
ON CONFLICT (code) DO UPDATE SET
  source = EXCLUDED.source, external_id = EXCLUDED.external_id, name = EXCLUDED.name,
  kind = EXCLUDED.kind, geom = EXCLUDED.geom, datum_note = EXCLUDED.datum_note,
  unit = EXCLUDED.unit, siaga_thresholds = EXCLUDED.siaga_thresholds,
  active = EXCLUDED.active, meta = EXCLUDED.meta
RETURNING id
"""

_UPSERT_IDENTITY = """
INSERT INTO station_identifiers (source, external_id, station_id, confirmed)
VALUES (%s, %s, %s, %s)
ON CONFLICT (source, external_id) DO UPDATE SET
  station_id = EXCLUDED.station_id, confirmed = EXCLUDED.confirmed
"""


def apply_station_config(conn: Any, config: StationConfig) -> int:
    """Upsert stations and their identifiers. Stations are configuration, so
    an in-place update is correct here (unlike fact tables). Returns the
    number of stations written. Runs in one transaction."""
    from psycopg.types.json import Jsonb

    with conn.transaction():
        with conn.cursor() as cur:
            for st in config.stations:
                cur.execute(
                    _UPSERT_STATION,
                    {
                        "code": st.code,
                        "source": st.source,
                        "external_id": st.external_id,
                        "name": st.name,
                        "kind": st.kind,
                        "lat": st.lat,
                        "lon": st.lon,
                        "datum_note": st.datum_note,
                        "unit": st.unit,
                        "siaga": Jsonb(st.siaga.as_json()),
                        "active": st.active,
                        "meta": Jsonb(
                            {
                                "river": st.river,
                                "external_id_confirmed": st.external_id_confirmed,
                                "location_source": st.location_source,
                                "location_needs_verification": st.location_needs_verification,
                                "allows_negative": st.allows_negative,
                                "note": st.note,
                            }
                        ),
                    },
                )
                station_id = cur.fetchone()[0]
                for ident in st.identities:
                    cur.execute(_UPSERT_IDENTITY, (ident.source, ident.external_id, station_id, ident.confirmed))
    return len(config.stations)


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------


def _summary(config: StationConfig) -> Iterable[str]:
    counts: dict[str, int] = {}
    for st in config.stations:
        key = st.siaga.source or "unknown"
        counts[key] = counts.get(key, 0) + 1
    yield f"{len(config.stations)} stations; thresholds by source: {counts}"
    for st in config.stations:
        vals = "/".join("-" if st.siaga.value(lv) is None else f"{st.siaga.value(lv):g}" for lv in SIAGA_LEVELS)
        yield f"  {st.code:<16} {st.siaga.source or 'unknown':<22} S3/S2/S1 cm = {vals}"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m noah.store.stations", description=__doc__.split("\n\n")[0])
    parser.add_argument("--config", help="path to stations.yaml (default: config/stations.yaml)")
    parser.add_argument("--apply", action="store_true", help="upsert into the database at NOAH_DATABASE_URL")
    args = parser.parse_args(argv)
    try:
        config = load_station_config(args.config)
    except StationConfigError as exc:
        print(exc, file=sys.stderr)
        return 1
    for line in _summary(config):
        print(line)
    if args.apply:
        url = os.environ.get("NOAH_DATABASE_URL")
        if not url:
            print("NOAH_DATABASE_URL is not set", file=sys.stderr)
            return 2
        import psycopg

        with psycopg.connect(url) as conn:
            n = apply_station_config(conn, config)
        print(f"applied {n} stations")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
