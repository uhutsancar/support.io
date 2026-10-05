-- 0001 — the origins a site's widget may run on.
--
-- The widget endpoints and the /widget socket used to answer any origin: a
-- site key, which is public by nature (it sits in the page source), was the
-- only credential. Each site now lists the exact origins (scheme://host[:port])
-- its widget may be embedded on, and a widget session is issued and used only
-- from one of them.
ALTER TABLE sites ADD COLUMN IF NOT EXISTS allowed_origins text[] NOT NULL DEFAULT '{}';

-- Existing sites are seeded from their single `domain` value: the domain
-- itself and its www. twin, over https unless the domain was written with an
-- explicit http:// scheme. Bare IPs and localhost get only themselves.
WITH parsed AS (
  SELECT
    id,
    lower(regexp_replace(regexp_replace(btrim(domain), '^[a-z][a-z0-9+.-]*://', '', 'i'), '[/?#].*$', '')) AS host,
    CASE WHEN btrim(domain) ~* '^http://' THEN 'http' ELSE 'https' END AS scheme
  FROM sites
  WHERE allowed_origins = '{}'
)
UPDATE sites AS s
SET allowed_origins = CASE
  WHEN p.host = '' OR p.host ~ '[^a-z0-9.:\-\[\]]' THEN '{}'::text[]
  WHEN p.host ~ '^www\.' THEN ARRAY[p.scheme || '://' || p.host, p.scheme || '://' || substr(p.host, 5)]
  WHEN p.host ~ '^(localhost|\d{1,3}(\.\d{1,3}){3}|\[[0-9a-f:]+\])(:\d+)?$' THEN ARRAY[p.scheme || '://' || p.host]
  ELSE ARRAY[p.scheme || '://' || p.host, p.scheme || '://www.' || p.host]
END
FROM parsed AS p
WHERE s.id = p.id;
