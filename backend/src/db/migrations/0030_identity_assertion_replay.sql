-- A signed customer-identity assertion may reconnect within the same widget
-- session, but possession alone cannot move it to another browser/session.
CREATE TABLE IF NOT EXISTS identity_assertion_uses (
  site_id      varchar(24) NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  nonce        varchar(32) NOT NULL,
  session_id   varchar(64) NOT NULL,
  expires_at   timestamptz NOT NULL,
  used_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (site_id, nonce)
);

CREATE INDEX IF NOT EXISTS idx_identity_assertion_uses_expiry
  ON identity_assertion_uses (expires_at);
