-- 0002  Reference (configuration) tables: spatial units, stations, pumps,
-- polder parameters, event definitions (B-031, plan 03 "Data model").
--
-- These rows describe the world and are configuration (D12), loaded from
-- config/ files. stations, spatial_units and pumps may be updated in place
-- (their history lives in git). polder_params and event_definitions are
-- versioned and immutable: a change is a new row (valid_from / version).

-- Polders, kelurahan, RW and RT with parent links. Geometry in WGS 84.
CREATE TABLE spatial_units (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind        text NOT NULL CHECK (kind IN ('polder', 'kelurahan', 'rw', 'rt')),
  code        text NOT NULL,
  name        text NOT NULL,
  geom        geometry(MultiPolygon, 4326),
  parent_id   bigint REFERENCES spatial_units (id),
  source      text,                    -- provenance of the geometry (S8, S14, manual)
  meta        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT spatial_units_kind_code_key UNIQUE (kind, code)
);
CREATE INDEX spatial_units_geom_idx ON spatial_units USING gist (geom);
CREATE INDEX spatial_units_parent_idx ON spatial_units (parent_id);
CREATE INDEX spatial_units_code_idx ON spatial_units (code);
CREATE TRIGGER spatial_units_touch BEFORE UPDATE ON spatial_units
  FOR EACH ROW EXECUTE FUNCTION noah_touch_updated_at();

-- Measurement posts (TMA, ARR), pump houses, gates and cameras.
-- (source, external_id) is the station's home identity; station_identifiers
-- holds every identity the store resolves, including aliases from other
-- sources for the same physical post (e.g. S1 live and the S2 archive).
CREATE TABLE stations (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code              text NOT NULL,     -- stable slug from config/stations.yaml
  source            text NOT NULL,
  external_id       text NOT NULL,
  name              text NOT NULL,
  kind              text NOT NULL CHECK (kind IN ('tma', 'arr', 'pump', 'gate', 'cctv')),
  geom              geometry(Point, 4326),
  datum_note        text,
  unit              text NOT NULL CHECK (unit IN ('cm', 'mm', 'm3/s')),
  siaga_thresholds  jsonb,             -- see docs/data/schema.md; null values = unknown
  polder_id         bigint REFERENCES spatial_units (id),
  active            boolean NOT NULL DEFAULT true,
  meta              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stations_code_key UNIQUE (code),
  CONSTRAINT stations_source_external_id_key UNIQUE (source, external_id)
);
CREATE INDEX stations_geom_idx ON stations USING gist (geom);
CREATE TRIGGER stations_touch BEFORE UPDATE ON stations
  FOR EACH ROW EXECUTE FUNCTION noah_touch_updated_at();

CREATE TABLE station_identifiers (
  source       text NOT NULL,
  external_id  text NOT NULL,
  station_id   bigint NOT NULL REFERENCES stations (id),
  confirmed    boolean NOT NULL DEFAULT false,  -- seen in the source and checked by a person
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source, external_id)
);
CREATE INDEX station_identifiers_station_idx ON station_identifiers (station_id);

-- Which spatial units a station informs (plan issue P7): e.g. a DSDA Siaga
-- status change at a post is logged as a forecast for the polders it drains
-- to (plan 05, "DSDA Siaga status"). Versioned by valid_from.
CREATE TABLE station_unit_map (
  station_id  bigint NOT NULL REFERENCES stations (id),
  unit_id     bigint NOT NULL REFERENCES spatial_units (id),
  relation    text NOT NULL CHECK (relation IN ('siaga_proxy', 'upstream', 'in_unit', 'downstream')),
  lag_min     integer,                 -- typical travel time, if known
  valid_from  timestamptz NOT NULL,
  source      text NOT NULL,           -- who asserted the mapping (DSDA, analysis, ...)
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (station_id, unit_id, relation, valid_from)
);

CREATE TABLE pumps (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code          text NOT NULL,
  name          text,
  polder_id     bigint REFERENCES spatial_units (id),
  station_id    bigint REFERENCES stations (id),   -- the pump house's sump gauge, if any
  capacity_m3s  double precision CHECK (capacity_m3s IS NULL OR capacity_m3s >= 0),
  kind          text NOT NULL CHECK (kind IN ('stationary', 'mobile')),
  scada_tag     text,                  -- read-only reference; Noah never writes to SCADA
  source        text NOT NULL,         -- s7_inventory | manual | simulator
  active        boolean NOT NULL DEFAULT true,
  meta          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pumps_code_key UNIQUE (code)
);
CREATE TRIGGER pumps_touch BEFORE UPDATE ON pumps
  FOR EACH ROW EXECUTE FUNCTION noah_touch_updated_at();

-- Versioned per polder: a change is a new row with a later valid_from.
CREATE TABLE polder_params (
  polder_id          bigint NOT NULL REFERENCES spatial_units (id),
  valid_from         timestamptz NOT NULL,
  sump_capacity_m3   double precision,
  catchment_area_m2  double precision,
  runoff_coeff       double precision CHECK (runoff_coeff IS NULL OR runoff_coeff BETWEEN 0 AND 1),
  level_to_volume    jsonb,            -- [[level_cm, volume_m3], ...]
  source             text NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (polder_id, valid_from)
);

-- Versioned event definitions (plan 05). Every metric states its version.
-- Immutable except that agreed_with may be filled in once (sign-off by DSDA
-- or BPBD, G-080); see the guard trigger below.
CREATE TABLE event_definitions (
  version      text PRIMARY KEY,
  description  text NOT NULL,
  rule         jsonb NOT NULL,
  agreed_with  text,
  valid_from   timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION noah_event_definitions_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'noah: DELETE on event_definitions is forbidden; add a new version';
  END IF;
  IF NEW.version IS DISTINCT FROM OLD.version
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.rule IS DISTINCT FROM OLD.rule
     OR NEW.valid_from IS DISTINCT FROM OLD.valid_from
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR OLD.agreed_with IS NOT NULL THEN
    RAISE EXCEPTION 'noah: event definition % is immutable; only a NULL agreed_with may be filled in once', OLD.version
      USING HINT = 'Add a new version instead.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER event_definitions_guard BEFORE UPDATE OR DELETE ON event_definitions
  FOR EACH ROW EXECUTE FUNCTION noah_event_definitions_guard();
CREATE TRIGGER event_definitions_no_truncate BEFORE TRUNCATE ON event_definitions
  FOR EACH STATEMENT EXECUTE FUNCTION noah_forbid_mutation();

SELECT noah_make_append_only('polder_params');
