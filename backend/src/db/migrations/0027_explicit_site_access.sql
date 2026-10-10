-- Legacy restricted accounts used an empty join table as an implicit "all
-- current and future sites" grant. Materialize today's access before changing
-- the runtime meaning of empty to "none". Owner/admin access remains explicit
-- in the role policy and needs no join rows.
INSERT INTO user_assigned_sites (user_id, site_id)
SELECT u.id, s.id
  FROM users u
  JOIN sites s ON s.organization_id = u.organization_id
 WHERE u.role NOT IN ('owner', 'admin')
   AND NOT EXISTS (SELECT 1 FROM user_assigned_sites a WHERE a.user_id = u.id)
ON CONFLICT DO NOTHING;

INSERT INTO team_assigned_sites (team_id, site_id)
SELECT t.id, s.id
  FROM teams t
  JOIN sites s ON s.organization_id = t.organization_id
 WHERE t.role NOT IN ('owner', 'admin')
   AND NOT EXISTS (SELECT 1 FROM team_assigned_sites a WHERE a.team_id = t.id)
ON CONFLICT DO NOTHING;
