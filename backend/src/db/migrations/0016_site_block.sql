-- 0016 — a site switched off by the platform (plan v10 LEG-05).
--
-- `site:disable` used to set sites.is_active = false, which the owner can
-- turn back on from the panel: a phishing or fraud site was off only until
-- its owner noticed. blocked_at is the platform's own switch — set and
-- cleared only by the support command, never by the panel or by the plan
-- limits (BIL-04). The reason is for the support trail; the owner sees only
-- that the site was blocked and whom to write to.
ALTER TABLE sites ADD COLUMN IF NOT EXISTS blocked_at timestamptz;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS blocked_reason text;
