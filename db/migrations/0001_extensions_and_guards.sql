-- 0001  Extensions and append-only guard helpers (B-031)
--
-- Plain PostgreSQL 15+ with PostGIS. Portable to Supabase or any managed
-- Postgres: no Supabase-only features. Applied by `python -m noah.store.migrate`,
-- which records each file in schema_migrations. Never edit an applied file;
-- add a new one.

CREATE EXTENSION IF NOT EXISTS postgis;

-- Raised by every BEFORE UPDATE/DELETE/TRUNCATE trigger on a fact table.
-- Guardrail 6: facts are never updated or deleted; a correction is a new row
-- with supersedes_id set.
CREATE OR REPLACE FUNCTION noah_forbid_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'noah: % on %.% is forbidden; the table is append-only (guardrail 6)',
      TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME
    USING HINT = 'Insert a correction row with supersedes_id instead.';
END;
$$;

-- Make a table append-only:
--   1. BEFORE UPDATE OR DELETE (per row) and BEFORE TRUNCATE (per statement)
--      triggers that raise. These bind the table owner and superusers too
--      (only session_replication_role = replica or DISABLE TRIGGER, both
--      owner/superuser actions, can bypass them).
--   2. REVOKE UPDATE, DELETE, TRUNCATE from PUBLIC and from the Supabase API
--      roles when they exist, so the application roles fail on privileges
--      before the trigger is even reached.
CREATE OR REPLACE FUNCTION noah_make_append_only(target regclass) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  r text;
BEGIN
  EXECUTE format(
    'CREATE TRIGGER noah_append_only_row BEFORE UPDATE OR DELETE ON %s '
    'FOR EACH ROW EXECUTE FUNCTION noah_forbid_mutation()', target);
  EXECUTE format(
    'CREATE TRIGGER noah_append_only_truncate BEFORE TRUNCATE ON %s '
    'FOR EACH STATEMENT EXECUTE FUNCTION noah_forbid_mutation()', target);
  EXECUTE format('REVOKE UPDATE, DELETE, TRUNCATE ON %s FROM PUBLIC', target);
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role',
                           'noah_app', 'noah_ingest', 'noah_reader'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE UPDATE, DELETE, TRUNCATE ON %s FROM %I', target, r);
    END IF;
  END LOOP;
END;
$$;

-- Keeps updated_at current on the mutable reference tables (stations, units,
-- pumps, users). Fact tables have no updated_at because they never change.
CREATE OR REPLACE FUNCTION noah_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
