-- =============================================================================
-- B-013  UU PDP purge of citizen personal data
-- =============================================================================
-- HUMAN STEP (Ari). NEEDS APPROVAL. Agents never run this file.
-- It PERMANENTLY deletes citizen data and drops tables in the live database.
--
-- Preconditions (all must hold before step 3):
--   a. Legal has given written guidance (retention of the export, whether any
--      notification to data subjects or the regulator is owed).
--   b. B-011 (supabase/manual/B-011_lockdown_pii.sql) has been applied and its
--      verification passed. Step 3 re-checks this and aborts otherwise.
--   c. The B-007 and B-012 code removals are deployed (nothing writes to these
--      tables any more).
--
-- Scope: public.sms_subscribers, public.sms_logs, public.laporan_banjir and
-- every object in the storage bucket laporan-banjir.
-- Out of scope (dropped later by B-032): evacuation_locations (contains named
-- contact phones), predictions, detections, alerts, historical_incidents, the
-- region tables, user_preferences.
-- =============================================================================


-- =============================================================================
-- STEP 1. EXPORT (before anything is deleted)  -- run from a terminal, not here
-- =============================================================================
-- Only if Legal says an export must be kept. Otherwise skip to step 2 and
-- record "no export kept, per Legal guidance <ref>" in the deletion log.
--
-- The export contains personal data. Keep it encrypted, offline, on a device
-- Ari controls, never in git, chat, a shared drive or a ticket. Delete it on
-- the date Legal sets and record that date in the deletion log.
--
-- Use the direct (non-pooler) connection string from Dashboard > Project
-- Settings > Database, held in an env var; do not type it into a file.
--
--   pg_dump "$SUPABASE_DB_URL" --data-only --no-owner --no-privileges \
--     --table=public.sms_subscribers --table=public.sms_logs \
--     --table=public.laporan_banjir \
--     | gpg --symmetric --cipher-algo AES256 -o noah_pdp_export_$(date -u +%Y%m%d).sql.gpg
--
-- Bucket objects (citizen photos): download them with the Supabase CLI or the
-- dashboard into an encrypted container under the same rules, or skip if Legal
-- says the photos need not be kept.
--
-- Verify the export opens (decrypt to stdout, count lines), then continue.


-- =============================================================================
-- STEP 2. DELETION LOG: row counts only, never contents
-- =============================================================================
-- Run this SELECT in the SQL editor and copy the result (counts and the
-- timestamp only) into the signed deletion log kept by Ari, e.g.
-- docs/compliance/B-013_deletion_log.md (counts, date, who ran it, Legal ref,
-- export kept yes/no and its destruction date).
SELECT now() AT TIME ZONE 'UTC' AS counted_at_utc,
       (SELECT count(*) FROM public.sms_subscribers)                           AS sms_subscribers_rows,
       (SELECT count(*) FROM public.sms_logs)                                  AS sms_logs_rows,
       (SELECT count(*) FROM public.laporan_banjir)                            AS laporan_banjir_rows,
       (SELECT count(*) FROM storage.objects WHERE bucket_id = 'laporan-banjir') AS bucket_objects;


-- =============================================================================
-- STEP 3. PURGE BUCKET OBJECTS  -- dashboard, not SQL
-- =============================================================================
-- Supabase does not allow deleting files by SQL on storage.objects (it would
-- leave the files in object storage). Use Dashboard > Storage > laporan-banjir
-- > select all > Delete (or "Empty bucket"), then delete the bucket itself.
-- Then confirm with:
SELECT count(*) AS remaining_bucket_objects
FROM storage.objects WHERE bucket_id = 'laporan-banjir';   -- expect 0
SELECT count(*) AS bucket_still_exists
FROM storage.buckets WHERE id = 'laporan-banjir';           -- expect 0


-- =============================================================================
-- STEP 4. PURGE AND DROP TABLES  (irreversible)
-- =============================================================================
-- Deliberate two-key safety: the block below aborts unless you first run,
-- in the same session, exactly:
--     SET noah.b013_confirm = 'PURGE-APPROVED-BY-ARI';
-- It also aborts if B-011 has not been applied (any anon/authenticated policy
-- or grant still present) or if bucket objects remain.

BEGIN;

DO $$
DECLARE
  t text;
  leftover bigint;
BEGIN
  IF coalesce(current_setting('noah.b013_confirm', true), '') <> 'PURGE-APPROVED-BY-ARI' THEN
    RAISE EXCEPTION 'B-013 aborted: confirmation setting noah.b013_confirm not set';
  END IF;

  FOREACH t IN ARRAY ARRAY['sms_subscribers', 'sms_logs', 'laporan_banjir'] LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      CONTINUE;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies
               WHERE schemaname = 'public' AND tablename = t
                 AND roles <> ARRAY['service_role']::name[])
       OR EXISTS (SELECT 1 FROM information_schema.role_table_grants
                  WHERE table_schema = 'public' AND table_name = t
                    AND grantee IN ('anon', 'authenticated', 'PUBLIC')) THEN
      RAISE EXCEPTION 'B-013 aborted: public.% is not locked down; apply B-011 first', t;
    END IF;
  END LOOP;

  IF to_regclass('storage.objects') IS NOT NULL THEN
    SELECT count(*) INTO leftover FROM storage.objects WHERE bucket_id = 'laporan-banjir';
    IF leftover > 0 THEN
      RAISE EXCEPTION 'B-013 aborted: % objects remain in bucket laporan-banjir; do step 3 first', leftover;
    END IF;
  END IF;
END
$$;

-- sms_logs references sms_subscribers, so it goes first. No CASCADE: if a view,
-- function or FK we do not know about depends on these tables, the DROP fails
-- and the whole transaction rolls back. Investigate instead of forcing it.
DELETE FROM public.sms_logs;
DELETE FROM public.sms_subscribers;
DELETE FROM public.laporan_banjir;

DROP TABLE public.sms_logs;
DROP TABLE public.sms_subscribers;
DROP TABLE public.laporan_banjir;

COMMIT;


-- =============================================================================
-- STEP 5. VERIFY AND SIGN OFF
-- =============================================================================
-- Expect all three NULL (tables gone):
SELECT to_regclass('public.sms_subscribers') AS sms_subscribers,
       to_regclass('public.sms_logs')        AS sms_logs,
       to_regclass('public.laporan_banjir')  AS laporan_banjir;
-- Expect 0:
SELECT count(*) AS bucket_objects FROM storage.objects WHERE bucket_id = 'laporan-banjir';
--
-- Then in the deletion log: purge time (UTC), result of the two checks above,
-- signature (Ari), Legal reference, and any notification duty handed to Ari.
-- Note: Supabase point-in-time recovery / daily backups still hold the data
-- until they age out. Record the backup retention window in the log, and ask
-- Legal whether that is acceptable or whether support must purge backups.
