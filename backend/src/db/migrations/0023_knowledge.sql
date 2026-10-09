-- 0023 — what the assistant may answer from besides the FAQ (plan v10
-- PRD-21, AI-08): pages of the site itself and PDF documents the business
-- uploads. Only their text is kept, cut into passages the assistant searches
-- with PostgreSQL's full-text search — no vector database (plan §21). A PDF
-- is not stored; its text is.
CREATE TABLE IF NOT EXISTS knowledge_sources (
  id               varchar(24) PRIMARY KEY,
  organization_id  varchar(24) NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  site_id          varchar(24) NOT NULL REFERENCES sites (id) ON DELETE CASCADE,
  kind             text NOT NULL,
  -- The page's address; null for a PDF.
  url              text,
  title            text NOT NULL,
  status           text NOT NULL DEFAULT 'pending',
  -- Why the last fetch or read failed, in a word the panel translates.
  error            text,
  chars            integer NOT NULL DEFAULT 0,
  created_by       varchar(24),
  created_at       timestamptz NOT NULL DEFAULT now(),
  refreshed_at     timestamptz,
  CONSTRAINT knowledge_sources_kind_check CHECK (kind IN ('page', 'pdf')),
  CONSTRAINT knowledge_sources_status_check CHECK (status IN ('pending', 'ready', 'failed'))
);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_site ON knowledge_sources (site_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_org ON knowledge_sources (organization_id);
-- A page is added once per site.
CREATE UNIQUE INDEX IF NOT EXISTS uq_knowledge_sources_site_url ON knowledge_sources (site_id, url)
  WHERE url IS NOT NULL;

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id          varchar(24) PRIMARY KEY,
  source_id   varchar(24) NOT NULL REFERENCES knowledge_sources (id) ON DELETE CASCADE,
  site_id     varchar(24) NOT NULL REFERENCES sites (id) ON DELETE CASCADE,
  position    integer NOT NULL,
  content     text NOT NULL,
  -- 'simple': the text is mostly Turkish, and the search matches word
  -- prefixes instead of trusting a stemmer (services/helpCenter.ts#prefixQuery).
  search      tsvector GENERATED ALWAYS AS (to_tsvector('simple'::regconfig, content)) STORED
);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_search ON knowledge_chunks USING gin (search);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_source ON knowledge_chunks (source_id, position);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_site ON knowledge_chunks (site_id);
