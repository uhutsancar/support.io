-- 0018 — a public help center per site (plan v10 PRD-10).
--
-- The site's active FAQ entries, published at /help/<help_slug> when the
-- owner turns it on. The address is chosen once and is unique on the
-- platform, upper or lower case alike. help_center holds the switches:
--   { enabled: boolean, noindex: boolean, title: string | null }
ALTER TABLE sites ADD COLUMN IF NOT EXISTS help_slug text;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS help_center jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE sites DROP CONSTRAINT IF EXISTS sites_help_slug_check;
ALTER TABLE sites ADD CONSTRAINT sites_help_slug_check
  CHECK (help_slug IS NULL OR help_slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$');
CREATE UNIQUE INDEX IF NOT EXISTS uq_sites_help_slug ON sites (lower(help_slug))
  WHERE help_slug IS NOT NULL;
