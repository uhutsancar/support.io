-- Knowledge-source contents may leave our system only after an explicit owner
-- decision. Existing sources default to private and must be reviewed.
ALTER TABLE knowledge_sources
  ADD COLUMN IF NOT EXISTS approved_for_external_model boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_knowledge_sources_external_ready
  ON knowledge_sources (site_id, approved_for_external_model, status);
