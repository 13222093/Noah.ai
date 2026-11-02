-- =============================================================================
-- B-011  Lock down citizen PII in the live Supabase project
-- =============================================================================
-- HUMAN STEP (Ari). Agents never run this file. It changes the live database.
-- Run it in the Supabase dashboard SQL editor (role: postgres), as one script.
--
-- What it does (all idempotent; safe to re-run):
--   1. sms_subscribers, sms_logs: drop every policy that is not service_role,
--      revoke all table privileges from anon and authenticated.
--   2. laporan_banjir, evacuation_locations: enable RLS with no policies
--      (deny-all for anon/authenticated), revoke their table privileges.
--   3. predictions, detections: drop the public SELECT and the role-less
--      INSERT policies, revoke anon/authenticated privileges.
--   4. Storage bucket laporan-banjir: set private, drop storage.objects
--      policies that mention the bucket.
--   5. Print a verification report (section V below; also runnable alone).
--
-- It deliberately does NOT delete rows or drop tables. That is B-013, which
-- needs Legal guidance and Ari's approval first.
--
-- service_role bypasses RLS, so server code using it is unaffected. After the
-- B-007/B-012/B-020 code removals nothing in the app should need these tables.
--
-- The live DB has drifted from supabase/migrations/ (see
-- docs/audit/backend-api-engineer.md), so policies are dropped by querying
-- pg_policies, not by the names in the old migrations.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1-3. Table policies and grants
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t   text;
  pol record;
  pii_tables text[] := ARRAY[
    'sms_subscribers', 'sms_logs',
    'laporan_banjir', 'evacuation_locations',
    'predictions', 'detections'
  ];
BEGIN
  FOREACH t IN ARRAY pii_tables LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      RAISE NOTICE 'skip: public.% does not exist', t;
      CONTINUE;
    END IF;

    -- Drop every policy on the table except ones scoped only to service_role.
    FOR pol IN
      SELECT policyname, roles
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      IF pol.roles = ARRAY['service_role']::name[] THEN
        RAISE NOTICE 'keep: %.% (service_role only)', t, pol.policyname;
      ELSE
        EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t);
        RAISE NOTICE 'dropped policy: %.% (roles %)', t, pol.policyname, pol.roles;
      END IF;
    END LOOP;

    -- Deny-all for clients: RLS on, no client policies, no client grants.
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', t);
    RAISE NOTICE 'locked: public.%', t;
  END LOOP;
END
$$;

-- ---------------------------------------------------------------------------
-- 4. Storage bucket laporan-banjir (citizen photos)
-- ---------------------------------------------------------------------------
UPDATE storage.buckets SET public = false WHERE id = 'laporan-banjir';

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname, roles
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND (coalesce(qual, '') ILIKE '%laporan-banjir%'
           OR coalesce(with_check, '') ILIKE '%laporan-banjir%')
  LOOP
    IF pol.roles = ARRAY['service_role']::name[] THEN
      RAISE NOTICE 'keep storage policy: % (service_role only)', pol.policyname;
    ELSE
      EXECUTE format('DROP POLICY %I ON storage.objects', pol.policyname);
      RAISE NOTICE 'dropped storage policy: % (roles %)', pol.policyname, pol.roles;
    END IF;
  END LOOP;
END
$$;

COMMIT;

-- =============================================================================
-- V. Verification (read-only; run after the block above, or on its own)
-- =============================================================================
-- Expect: rls_enabled = true, client_policies = 0, client_grants = 0 for every
-- row that exists.
SELECT c.relname                                         AS table_name,
       c.relrowsecurity                                  AS rls_enabled,
       (SELECT count(*) FROM pg_policies p
         WHERE p.schemaname = 'public' AND p.tablename = c.relname
           AND p.roles <> ARRAY['service_role']::name[]) AS client_policies,
       (SELECT count(*) FROM information_schema.role_table_grants g
         WHERE g.table_schema = 'public' AND g.table_name = c.relname
           AND g.grantee IN ('anon', 'authenticated', 'PUBLIC'))  AS client_grants
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('sms_subscribers', 'sms_logs', 'laporan_banjir',
                    'evacuation_locations', 'predictions', 'detections')
ORDER BY 1;

-- Expect: public = false.
SELECT id, public FROM storage.buckets WHERE id = 'laporan-banjir';

-- Expect: no rows (no client policy on storage.objects mentions the bucket).
SELECT policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND (coalesce(qual, '') ILIKE '%laporan-banjir%'
       OR coalesce(with_check, '') ILIKE '%laporan-banjir%')
  AND roles <> ARRAY['service_role']::name[];

-- Expect: one NOTICE per table saying "denied" (permission denied or 0 rows).
-- Runs as role anon inside a transaction that is rolled back.
BEGIN;
SET LOCAL ROLE anon;
DO $$
DECLARE
  t text;
  n bigint;
BEGIN
  FOREACH t IN ARRAY ARRAY['sms_subscribers', 'sms_logs', 'laporan_banjir',
                           'evacuation_locations', 'predictions', 'detections'] LOOP
    BEGIN
      EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
      IF n = 0 THEN
        RAISE NOTICE 'anon % : denied (0 rows visible)', t;
      ELSE
        RAISE WARNING 'anon % : NOT LOCKED, % rows visible', t, n;
      END IF;
    EXCEPTION
      WHEN insufficient_privilege THEN RAISE NOTICE 'anon % : denied (permission denied)', t;
      WHEN undefined_table        THEN RAISE NOTICE 'anon % : table absent', t;
    END;
  END LOOP;
END
$$;
ROLLBACK;

-- -----------------------------------------------------------------------------
-- External check with the real anon key (run from a terminal; do not paste
-- key values into chat or files). Each table should return 401/403, or [].
--   for t in sms_subscribers sms_logs laporan_banjir evacuation_locations predictions detections; do
--     curl -s -o /dev/null -w "$t %{http_code}\n" \
--       "$SUPABASE_URL/rest/v1/$t?select=id&limit=1" \
--       -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $SUPABASE_ANON_KEY"
--   done
-- Bucket: listing and public object URLs should fail:
--   curl -s -o /dev/null -w "%{http_code}\n" -X POST \
--     "$SUPABASE_URL/storage/v1/object/list/laporan-banjir" \
--     -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
--     -H "Content-Type: application/json" -d '{"prefix":""}'
--   (expect [] or 4xx; also open one previously public photo URL: expect 400/404)
-- -----------------------------------------------------------------------------
