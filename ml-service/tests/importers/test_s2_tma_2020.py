"""B-041: S2 archive importer.

fixtures/tma_2020_sample.csv holds 22 rows copied verbatim from
ml-service/data/tma_2020.xlsx.csv (file lines 1 header, 2, 7, 11, 19, 28, 32,
40, 91, 112, 9161-9287 every 21st, 15107-15212 every 21st): a stray 2019 row,
negative levels at Cideng and Pluit, a label with trailing spaces, the
Manggarai Normal -> Siaga 3 -> Normal transition, and the Karet 0 cm spike
with repeated snapshots. It stays valid after the full file leaves git."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

import pytest

from noah.importers import s2_tma_2020 as s2
from noah.records import ConnectorRun, Observation, QualityFlag, RawPayload, RunStatus
from noah.store.objects import raw_key
from noah.store.stations import load_station_config

FIXTURE = Path(__file__).parent / "fixtures" / "tma_2020_sample.csv"
UTC = timezone.utc


@dataclass
class MemorySink:
    """In-memory ``Sink`` for tests. Append-only like the real store: one
    original row per (station, ts), as the database's unique index enforces;
    later copies are ignored, never replaced."""

    raw: dict[str, RawPayload] = field(default_factory=dict)
    observations: list[Observation] = field(default_factory=list)
    runs: list[ConnectorRun] = field(default_factory=list)
    _keys: set = field(default_factory=set)

    def write_raw(self, payload: RawPayload) -> str:
        key = raw_key(payload)
        self.raw.setdefault(key, payload)
        return key

    def write_observations(self, rows):
        new = 0
        for r in rows:
            k = (r.station_source, r.station_external_id, r.ts) if r.supersedes_id is None else ("corr", r.supersedes_id)
            if k not in self._keys:
                self._keys.add(k)
                self.observations.append(r)
                new += 1
        return new

    def write_flood_reports(self, rows):
        return 0

    def write_rain_products(self, rows):
        return 0

    def record_run(self, run: ConnectorRun) -> None:
        self.runs.append(run)


@pytest.fixture(scope="module")
def config():
    return load_station_config()


@pytest.fixture
def imported(config):
    sink = MemorySink()
    report = s2.run_import(FIXTURE, sink, station_config=config)
    return sink, report


def _obs(sink, label, flag=None):
    return [o for o in sink.observations if o.station_external_id == label and (flag is None or o.quality_flag == flag)]


def test_parse_counts_and_labels():
    rows, errors = s2.parse_rows(FIXTURE.read_text(encoding="utf-8"))
    assert errors == []
    assert len(rows) == 22
    labels = {r.label for r in rows}
    assert "P.A. Istiqlal" in labels  # "P.A. Istiqlal  " trimmed
    assert all(r.label == r.label.strip() for r in rows)


def test_status_parsing():
    assert s2.parse_status("Status : Normal") == "normal"
    assert s2.parse_status("Status : Siaga 3") == "siaga_3"
    assert s2.parse_status("Status :  Siaga 1 ") == "siaga_1"
    assert s2.parse_status("Status : Awas") is None


def test_wib_to_utc():
    rows, _ = s2.parse_rows(FIXTURE.read_text(encoding="utf-8"))
    first = rows[0]  # "2019-12-23 03:50:00" WIB
    assert first.ts == datetime(2019, 12, 22, 20, 50, tzinfo=UTC)
    midnight = [r for r in rows if r.label == "Pompa Cideng"][0]  # "2019-12-31 23:40:00" WIB
    assert midnight.ts == datetime(2019, 12, 31, 16, 40, tzinfo=UTC)
    assert all(r.ts.utcoffset().total_seconds() == 0 for r in rows)


def test_mm_to_cm(imported):
    sink, _ = imported
    mg = {o.ts: o.value for o in _obs(sink, "PA. Manggarai", QualityFlag.OK)}
    assert mg[datetime(2020, 1, 9, 20, 40, tzinfo=UTC)] == 750.0  # 7500 mm, 03:40 WIB
    assert mg[datetime(2020, 1, 9, 22, 40, tzinfo=UTC)] == 748.0  # 7480 mm
    assert all(o.unit == "cm" for o in sink.observations)


def test_siaga_transition_in_fixture_matches_config(config):
    """The labels in the fixture agree with the configured Manggarai threshold."""
    rows, _ = s2.parse_rows(FIXTURE.read_text(encoding="utf-8"))
    th = config.by_code("manggarai").siaga
    for r in rows:
        if r.label == "PA. Manggarai":
            status = th.classify(r.value_mm / 10).status
            assert status == r.status, (r.ts, r.value_mm, r.status)


def test_exact_duplicates_become_one_observation(imported):
    sink, report = imported
    karet = _obs(sink, "P.A. Karet")
    # six rows in the file, three timestamps, each repeated once
    assert sorted(o.value for o in karet) == [0.0, 280.0, 280.0]
    assert len({o.ts for o in karet}) == 3
    assert QualityFlag.STALE not in {o.quality_flag for o in sink.observations}
    assert report.repeated_rows == 3
    assert report.observations == len(sink.observations) == 19


def test_negative_values_flagged_unless_allowed(imported):
    sink, report = imported
    cideng = {o.value: o.quality_flag for o in _obs(sink, "Pompa Cideng")}
    assert cideng[-5.0] == QualityFlag.SUSPECT
    assert cideng[-19.0] == QualityFlag.SUSPECT
    assert cideng[16.0] == QualityFlag.OK
    # Pluit: reservoir below gauge zero, allows_negative in config -> kept as ok
    assert {o.quality_flag for o in _obs(sink, "P.A. Pluit")} == {QualityFlag.OK}
    assert report.suspect_reasons["negative_level"] == 2


def test_negative_flagged_without_config():
    rows, _ = s2.parse_rows(FIXTURE.read_text(encoding="utf-8"))
    obs, _ = s2.build_observations(rows)
    pluit = [o for o in obs if o.station_external_id == "P.A. Pluit"]
    assert pluit and all(o.quality_flag == QualityFlag.SUSPECT for o in pluit)


def test_isolated_spike_flagged(imported):
    sink, report = imported
    zero = [o for o in _obs(sink, "P.A. Karet") if o.value == 0.0]
    assert [o.quality_flag for o in zero] == [QualityFlag.SUSPECT]
    assert report.suspect_reasons["isolated_spike"] == 1
    # neighbours are fine
    assert all(o.quality_flag != QualityFlag.SUSPECT for o in _obs(sink, "P.A. Karet") if o.value == 280.0)


def test_conflicting_values_same_ts_both_suspect():
    text = FIXTURE.read_text(encoding="utf-8")
    # Synthetic test input: a second, different value for an existing row.
    text += '"PA. Manggarai",Ciliwung,-6.207825,106.848458,"2020-01-10 03:10:00",7320,"Status : Normal"\n'
    rows, _ = s2.parse_rows(text)
    obs, report = s2.build_observations(rows)
    at = [o for o in obs if o.station_external_id == "PA. Manggarai" and o.ts == datetime(2020, 1, 9, 20, 10, tzinfo=UTC)]
    assert [(o.value, o.quality_flag) for o in at] == [(731.0, QualityFlag.SUSPECT)]  # first in file order
    assert report.conflicting_keys == 1
    assert report.suspect_reasons["conflicting_values_same_ts"] == 1


def test_bad_rows_reported_not_raised():
    text = FIXTURE.read_text(encoding="utf-8")
    text += '"PA. Manggarai",Ciliwung,-6.207825,106.848458,"2020-01-10 07:10:00",,"Status : Normal"\n'
    text += '"PA. Manggarai",Ciliwung,-6.207825,106.848458,"not a date",7000,"Status : Normal"\n'
    rows, errors = s2.parse_rows(text)
    assert len(rows) == 22
    assert [e.line for e in errors] == [24, 25]


def test_unexpected_header_raises():
    with pytest.raises(ValueError):
        s2.parse_rows("a,b,c\n1,2,3\n")


def test_raw_payload_and_run_recorded(imported):
    sink, report = imported
    assert len(sink.raw) == 1
    key = next(iter(sink.raw))
    assert key.startswith("raw/s2_opendata/2026/03/01/20260301T103058Z_") and key.endswith(".csv")
    assert report.raw_ref == key
    assert all(o.raw_ref == key for o in sink.observations)
    assert sink.raw[key].content == FIXTURE.read_bytes()
    (run,) = sink.runs
    assert run.connector == s2.CONNECTOR and run.status == RunStatus.OK
    assert run.rows_written == len(sink.observations) == report.written


def test_reimport_is_noop(config):
    sink = MemorySink()
    first = s2.run_import(FIXTURE, sink, station_config=config)
    second = s2.run_import(FIXTURE, sink, station_config=config)
    assert first.written > 0
    assert second.written == 0
    assert len(sink.raw) == 1


def test_every_label_resolves_to_a_configured_station(config):
    rows, _ = s2.parse_rows(FIXTURE.read_text(encoding="utf-8"))
    for label in {r.label for r in rows}:
        assert config.by_identity(s2.SOURCE, label) is not None, label


def test_cli_dry_run_on_fixture(capsys):
    assert s2.main(["--dry-run", "--path", str(FIXTURE)]) == 0
    out = json.loads(capsys.readouterr().out)
    assert out["dry_run"] is True
    assert out["posts"] == 6
    assert out["rows_read"] == 22


# ---------------------------------------------------------------- full file


@pytest.mark.skipif(not s2.DEFAULT_PATH.exists(), reason="tma_2020.xlsx.csv not in this checkout")
def test_full_file_dry_run(config):
    sink = s2.DryRunSink()
    report = s2.run_import(s2.DEFAULT_PATH, sink, station_config=config)
    assert report.rows_read == 31059
    assert report.rows_unparsed == 0
    assert report.posts == 21
    assert report.conflicting_keys == 0
    assert sink.observations == report.observations == report.by_flag["ok"] + report.by_flag["suspect"]
    assert report.observations + report.repeated_rows == 31059
    rows, _ = s2.parse_rows(s2.DEFAULT_PATH.read_text(encoding="utf-8"))
    assert all(r.value_mm % 10 == 0 for r in rows)  # cm resolution stored as mm
