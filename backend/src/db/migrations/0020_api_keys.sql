-- 0020 — the workspace's keys for the public API (plan v10 PRD-12).
--
-- A key is shown once, when it is made; only its SHA-256 is kept (the key is
-- 40 random characters, so a plain hash is as strong as a slow one would
-- be), with its first characters to recognise it in the panel. A revoked key
-- stays as a row, so the log keeps saying who used what.
CREATE TABLE IF NOT EXISTS api_keys (
  id               varchar(24) PRIMARY KEY,
  organization_id  varchar(24) NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  name             text NOT NULL,
  prefix           text NOT NULL,
  key_hash         text NOT NULL,
  scopes           text[] NOT NULL DEFAULT '{read}',
  created_by       varchar(24),
  created_at       timestamptz NOT NULL DEFAULT now(),
  last_used_at     timestamptz,
  revoked_at       timestamptz,
  CONSTRAINT api_keys_scopes_check CHECK (scopes <@ ARRAY['read', 'write']::text[] AND cardinality(scopes) > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_api_keys_hash ON api_keys (key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys (organization_id);
