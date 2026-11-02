-- 0004  Operator-side tables: users, encrypted operator contacts,
-- recommendations and their lifecycle, audit log (B-031; plan 03, 08).
--
-- Ownership note (GAP_REPORT G-060): backend-api-engineer owns users and
-- audit; this migration creates the minimum so the chain is complete.
--
-- Deviation from plan 03, kept append-only on purpose: the plan puts
-- sent_at/channel/ack_by/ack_at/operator_action/note on `recommendations`,
-- which would need UPDATEs. Here a recommendation is immutable and its
-- lifecycle (sent, acknowledged, action recorded) is a stream of
-- recommendation_events. The latest event of each kind is the current state.

CREATE TABLE users (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subject      text NOT NULL,          -- OIDC `sub` (Keycloak / Supabase Auth adapter)
  name         text NOT NULL,
  org          text NOT NULL,          -- DSDA, BPBD, ITB, ...
  role         text NOT NULL CHECK (role IN
                 ('posko_operator', 'pump_operator', 'bpbd_pusdalops',
                  'dsda_supervisor', 'researcher', 'admin')),
  polder_id    bigint REFERENCES spatial_units (id),  -- scope for pump_operator
  phone_hash   text,                   -- keyed hash (HMAC) of the E.164 number, never the number
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_subject_key UNIQUE (subject),
  CONSTRAINT users_pump_operator_scope_chk CHECK (role <> 'pump_operator' OR polder_id IS NOT NULL)
);
CREATE TRIGGER users_touch BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION noah_touch_updated_at();

-- Encrypted WhatsApp contact details (plan 08, guardrail 3, plan issue P7).
-- Encrypted by the application (envelope encryption, key from the
-- environment or a KMS); the database never sees the key or the plaintext.
-- Admin-only: no grants to any API role here. Updatable (a number changes,
-- a person leaves); every change is written to audit_log by the API.
CREATE TABLE operator_contacts (
  user_id            bigint PRIMARY KEY REFERENCES users (id),
  phone_ciphertext   bytea NOT NULL,
  key_id             text NOT NULL,    -- which key encrypted it, for rotation
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER operator_contacts_touch BEFORE UPDATE ON operator_contacts
  FOR EACH ROW EXECUTE FUNCTION noah_touch_updated_at();
REVOKE ALL ON operator_contacts FROM PUBLIC;
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'noah_app', 'noah_ingest', 'noah_reader'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON operator_contacts FROM %I', r);
    END IF;
  END LOOP;
END;
$$;

CREATE TABLE recommendations (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  forecast_id    bigint REFERENCES forecasts (id),
  unit_id        bigint REFERENCES spatial_units (id),
  action_type    text NOT NULL CHECK (action_type IN
                   ('mobile_pump', 'crew', 'drawdown', 'gate_watch', 'inspect_pump')),
  text_id        text NOT NULL,        -- message template id (Bahasa Indonesia first)
  payload        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  supersedes_id  bigint REFERENCES recommendations (id)
);
CREATE INDEX recommendations_unit_created_idx ON recommendations (unit_id, created_at DESC);
CREATE INDEX recommendations_forecast_idx ON recommendations (forecast_id);

CREATE TABLE recommendation_events (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recommendation_id  bigint NOT NULL REFERENCES recommendations (id),
  kind               text NOT NULL CHECK (kind IN ('sent', 'ack', 'action')),
  channel            text,             -- dashboard | whatsapp (for kind = sent)
  user_id            bigint REFERENCES users (id),
  operator_action    text CHECK (operator_action IS NULL OR operator_action IN ('followed', 'deferred', 'ignored')),
  note               text,
  ts                 timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX recommendation_events_rec_idx ON recommendation_events (recommendation_id, ts DESC);

CREATE TABLE audit_log (
  id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id  bigint REFERENCES users (id),
  action   text NOT NULL,
  object   text NOT NULL,
  meta     jsonb NOT NULL DEFAULT '{}'::jsonb,   -- no personal data, no secrets
  ts       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_ts_idx ON audit_log (ts DESC);
CREATE INDEX audit_log_user_idx ON audit_log (user_id, ts DESC);

SELECT noah_make_append_only('recommendations');
SELECT noah_make_append_only('recommendation_events');
SELECT noah_make_append_only('audit_log');
