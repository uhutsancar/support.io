-- A short-lived upload is owned before it becomes part of a message. The
-- first socket send binds it to exactly one conversation; possession of the
-- signed proof alone is therefore not enough to move a file between users.
CREATE TABLE IF NOT EXISTS upload_records (
  id               varchar(24) PRIMARY KEY,
  organization_id  varchar(24) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id           varchar(24) NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  principal_type   text NOT NULL CHECK (principal_type IN ('widget', 'user', 'team')),
  principal_id     varchar(128) NOT NULL,
  session_id       varchar(64),
  object_key       text NOT NULL UNIQUE,
  mime_type        varchar(150) NOT NULL,
  byte_size        integer NOT NULL CHECK (byte_size >= 0 AND byte_size <= 10485760),
  status           text NOT NULL CHECK (status IN ('pending', 'bound', 'revoked', 'deleted')),
  purpose          text NOT NULL CHECK (purpose = 'chat-attachment'),
  conversation_id  varchar(24) REFERENCES conversations(id) ON DELETE SET NULL,
  message_id       varchar(24) REFERENCES messages(id) ON DELETE SET NULL,
  expires_at       timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_upload_records_owner
  ON upload_records (site_id, principal_type, principal_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_upload_records_expiry
  ON upload_records (status, expires_at);
