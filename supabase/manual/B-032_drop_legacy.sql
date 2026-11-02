-- =============================================================================
-- B-032  Drop the legacy hackathon tables
-- =============================================================================
-- HUMAN STEP (Ari). NEEDS APPROVAL. Agents never run this file.
-- It drops tables in the live database. Dropped data cannot be recovered
-- except from the export made in step 1.
--
-- Preconditions (all must hold before step 3):
--   a. B-013 (supabase/manual/B-013_pdp_purge.sql) is done: sms_subscribers,
--      sms_logs and laporan_banjir no longer exist. Step 3 re-checks this.
--   b. The target schema (db/migrations, B-031) has been applied to this
--      database with `python -m noah.store.migrate`, so schema_migrations
--      lists 0001 to 0004. Step 3 re-checks this.
--   c. No deployed code reads or writes these tables any more (the Next.js
--      routes for regions, alerts, preferences, evacuation and predict were
--      removed in wave 1; confirm the deployed build matches).
--
-- Scope (BACKLOG B-032, GAP_REPORT G-017, G-057, G-058, G-059):
--   from migrations:   evacuation_locations, predictions, detections,
--                      historical_incidents, alerts
--   created out of band (no migration in the repo, schema not reproducible):
--                      provinces, regencies, districts, villages,
--                      user_preferences
--   types:             public.incident_status, public.alert_level
-- Not touched: auth.*, storage.*, and every target table from db/migrations.
--
-- After this file has run, remove from git (a normal reviewed commit):
--   supabase/seed.sql (TRUNCATE, fabricated BMKG-style alerts) and the old
--   supabase/migrations/*.sql files. Target seeds hold configuration only
--   (config/stations.yaml, event definitions).
-- =============================================================================


-- =============================================================================
-- STEP 1. EXPORT (before anything is dropped)  -- run from a terminal, not here
-- =============================================================================
-- Required: five of these tables were created outside migrations, so the
-- export is the only record of their schema (Ari Q12).
--
-- Use the direct (non-pooler) connection string held in an env var; never
-- type it into a file or a ticket.
--
-- 1a. Schema of all ten tables and both types (no data, safe to keep):
--
--   pg_dump "$SUPABASE_DB_URL" --schema-only --no-owner --no-privileges \
--     --table=public.evacuation_locations --table=public.predictions \
--     --table=public.detections --table=public.historical_incidents \
--     --table=public.alerts --table=public.provinces --table=public.regencies \
--     --table=public.districts --table=public.villages \
--     --table=public.user_preferences \
--     > noah_legacy_schema_$(date -u +%Y%m%d).sql
--
--   pg_dump --table does not include enum types; capture them with:
--   psql "$SUPABASE_DB_URL" -At -c "SELECT format('CREATE TYPE public.%I AS ENUM (%s);', t.typname,
--     string_agg(quote_literal(e.enumlabel), ', ' ORDER BY e.enumsortorder))
--     FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
--     JOIN pg_namespace n ON n.oid = t.typnamespace
--     WHERE n.nspname = 'public' AND t.typname IN ('incident_status', 'alert_level')
--     GROUP BY t.typname" >> noah_legacy_schema_$(date -u +%Y%m%d).sql
--
-- 1b. Data. evacuation_locations holds named contact phone numbers and
--     user_preferences is keyed by auth user ids: both are personal data
--     (UU PDP). Encrypt the dump, keep it offline on a device Ari controls,
--     never in git, chat or a shared drive, and destroy it on the date Legal
--     sets (record that date in the deletion log).
--
--   pg_dump "$SUPABASE_DB_URL" --data-only --no-owner --no-privileges \
--     --table=public.evacuation_locations --table=public.predictions \
--     --table=public.detections --table=public.historical_incidents \
--     --table=public.alerts --table=public.provinces --table=public.regencies \
--     --table=public.districts --table=public.villages \
--     --table=public.user_preferences \
--     | gpg --symmetric --cipher-algo AES256 -o noah_legacy_data_$(date -u +%Y%m%d).sql.gpg
--
--   The region tables (provinces .. villages) hold Kemendagri codes that may
--   later seed spatial_units.code for kelurahan, after verification against an
--   authoritative source (G-017). The schema export is enough for that; keep
--   the data export only if Legal agrees.
--
-- Verify both files open (decrypt the data file to stdout and count lines),
-- then continue.


-- =============================================================================
-- STEP 2. DROP LOG: row counts only, never contents
-- =============================================================================
-- Run in the SQL editor and copy the result (counts and the timestamp only)
-- into the signed log, e.g. docs/compliance/B-032_drop_log.md (date, who ran
-- it, export files kept and their destruction date).
-- Tables that do not exist show NULL.

CREATE OR REPLACE FUNCTION pg_temp.noah_count(t text) RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE
  n bigint;
BEGIN
  IF to_regclass(format('public.%I', t)) IS NULL THEN
    RETURN NULL;
  END IF;
  EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
  RETURN n;
END;
$$;

SELECT now() AT TIME ZONE 'UTC'                      AS counted_at_utc,
       pg_temp.noah_count('evacuation_locations')     AS evacuation_locations_rows,
       pg_temp.noah_count('predictions')              AS predictions_rows,
       pg_temp.noah_count('detections')               AS detections_rows,
       pg_temp.noah_count('historical_incidents')     AS historical_incidents_rows,
       pg_temp.noah_count('alerts')                   AS alerts_rows,
       pg_temp.noah_count('provinces')                AS provinces_rows,
       pg_temp.noah_count('regencies')                AS regencies_rows,
       pg_temp.noah_count('districts')                AS districts_rows,
       pg_temp.noah_count('villages')                 AS villages_rows,
       pg_temp.noah_count('user_preferences')         AS user_preferences_rows;


-- =============================================================================
-- STEP 3. DROP  (irreversible)
-- =============================================================================
-- Deliberate two-key safety: the block below aborts unless you first run,
-- in the same session, exactly:
--     SET noah.b032_confirm = 'DROP-LEGACY-APPROVED-BY-ARI';
-- It also aborts if B-013 has not run or the target schema is missing.

BEGIN;

DO $$
DECLARE
  t text;
BEGIN
  IF coalesce(current_setting('noah.b032_confirm', true), '') <> 'DROP-LEGACY-APPROVED-BY-ARI' THEN
    RAISE EXCEPTION 'B-032 aborted: confirmation setting noah.b032_confirm not set';
  END IF;

  FOREACH t IN ARRAY ARRAY['sms_subscribers', 'sms_logs', 'laporan_banjir'] LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      RAISE EXCEPTION 'B-032 aborted: public.% still exists; run B-013 first', t;
    END IF;
  END LOOP;

  IF to_regclass('public.schema_migrations') IS NULL
     OR (SELECT count(*) FROM public.schema_migrations
         WHERE version IN ('0001', '0002', '0003', '0004')) < 4 THEN
    RAISE EXCEPTION 'B-032 aborted: target schema (db/migrations 0001-0004) is not applied';
  END IF;
END
$$;

-- Order: tables that may hold foreign keys to others first, region tables
-- from the leaves up. No CASCADE: if a view, function or FK we do not know
-- about depends on one of these tables, the DROP fails and the whole
-- transaction rolls back. Investigate instead of forcing it.
DROP TABLE IF EXISTS public.detections;
DROP TABLE IF EXISTS public.predictions;
DROP TABLE IF EXISTS public.alerts;
DROP TABLE IF EXISTS public.historical_incidents;
DROP TABLE IF EXISTS public.evacuation_locations;
DROP TABLE IF EXISTS public.user_preferences;
DROP TABLE IF EXISTS public.villages;
DROP TABLE IF EXISTS public.districts;
DROP TABLE IF EXISTS public.regencies;
DROP TABLE IF EXISTS public.provinces;

DROP TYPE IF EXISTS public.alert_level;
DROP TYPE IF EXISTS public.incident_status;

-- Check before committing: expect zero rows.
SELECT c.relname AS legacy_table_still_present
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('evacuation_locations', 'predictions', 'detections',
                    'historical_incidents', 'alerts', 'provinces', 'regencies',
                    'districts', 'villages', 'user_preferences');

-- If the check returned zero rows:  COMMIT;
-- Otherwise:                        ROLLBACK;
-- (Left for the operator on purpose; this file never commits by itself.)


-- =============================================================================
-- STEP 4. AFTER COMMIT
-- =============================================================================
-- - Confirm only target tables remain in public (plus schema_migrations and
--   PostGIS's spatial_ref_sys):
--     SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1;
-- - Record the drop in the log from step 2.
-- - Remove supabase/seed.sql and supabase/migrations/*.sql from git.
