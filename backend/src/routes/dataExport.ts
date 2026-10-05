// GET /api/account/export — everything an organization has stored, as one
// JSON file (plan §16, KVKK/GDPR data portability). The owner only.
//
// Written as a stream, table by table, a few hundred rows at a time, so an
// organization with years of conversations does not have to fit in memory.
// Secrets are left out: password hashes, the session version, the sealed
// site integration keys. Everything else is the organization's own data.

import express from 'express';
import { auth } from '../middleware/auth';
import { query } from '../db/pool';
import { asyncHandler, forbidden, orgId, requireOrganization } from '../http';
import type { Request, Response } from 'express';

const router = express.Router();
const PAGE = 500;

/** The organization's sites, for tables that hang off a site. */
const SITES = 'SELECT id FROM sites WHERE organization_id = $1';
const CONVERSATIONS = 'SELECT id FROM conversations WHERE organization_id = $1';

/**
 * Each table: the expression that turns a row into JSON (minus secrets) and
 * the condition that keeps it to this organization. `t` is the table alias.
 */
const TABLES: Array<{ key: string; table: string; row: string; where: string }> = [
  {
    key: 'users',
    table: 'users',
    row: "to_jsonb(t) - 'password' - 'session_version'",
    where: 't.organization_id = $1'
  },
  {
    key: 'teamMembers',
    table: 'teams',
    row: "to_jsonb(t) - 'password' - 'session_version'",
    where: 't.organization_id = $1'
  },
  {
    key: 'sites',
    table: 'sites',
    row: "to_jsonb(t) - 'integrations'",
    where: 't.organization_id = $1'
  },
  {
    key: 'widgetConfigs',
    table: 'widget_configs',
    row: 'to_jsonb(t)',
    where: 't.organization_id = $1'
  },
  {
    key: 'departments',
    table: 'departments',
    row: 'to_jsonb(t)',
    where: `t.site_id IN (${SITES})`
  },
  {
    key: 'faqs',
    table: 'faqs',
    row: "to_jsonb(t) - 'search_vector'",
    where: `t.site_id IN (${SITES})`
  },
  {
    key: 'automationRules',
    table: 'automation_rules',
    row: 'to_jsonb(t)',
    where: `t.site_id IN (${SITES})`
  },
  {
    key: 'proactiveRules',
    table: 'proactive_rules',
    row: 'to_jsonb(t)',
    where: `t.site_id IN (${SITES})`
  },
  { key: 'visitors', table: 'visitors', row: 'to_jsonb(t)', where: 't.organization_id = $1' },
  {
    key: 'conversations',
    table: 'conversations',
    row: 'to_jsonb(t)',
    where: 't.organization_id = $1'
  },
  {
    key: 'messages',
    table: 'messages',
    row: 'to_jsonb(t)',
    where: `t.conversation_id IN (${CONVERSATIONS})`
  },
  {
    key: 'internalNotes',
    table: 'conversation_internal_notes',
    row: 'to_jsonb(t)',
    where: `t.conversation_id IN (${CONVERSATIONS})`
  },
  { key: 'deals', table: 'deals', row: 'to_jsonb(t)', where: 't.organization_id = $1' },
  { key: 'auditLogs', table: 'audit_logs', row: 'to_jsonb(t)', where: 't.organization_id = $1' }
];

router.get(
  '/',
  auth,
  requireOrganization,
  asyncHandler(async (req: Request, res: Response) => {
    if (req.user.role !== 'owner') throw forbidden('Only the account owner can export the data');
    const organizationId = orgId(req);
    const { rows: org } = await query(
      'SELECT id, name, plan_type, created_at FROM organizations WHERE id = $1',
      [organizationId]
    );

    const day = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="supportio-export-${day}.json"`);
    res.setHeader('Cache-Control', 'no-store');
    res.write(
      `{"exportedAt":${JSON.stringify(new Date().toISOString())},"organization":${JSON.stringify(org[0] ?? null)}`
    );

    for (const { key, table, row, where } of TABLES) {
      res.write(`,${JSON.stringify(key)}:[`);
      let after = '';
      let first = true;
      for (;;) {
        // Keyset pagination on the primary key: stable and cheap however deep.
        // eslint-disable-next-line no-await-in-loop
        const { rows } = await query<{ id: string; row: unknown }>(
          `SELECT t.id, ${row} AS row FROM ${table} t
            WHERE ${where} AND t.id > $2
            ORDER BY t.id
            LIMIT ${PAGE}`,
          [organizationId, after]
        );
        for (const r of rows) {
          res.write((first ? '' : ',') + JSON.stringify(r.row));
          first = false;
        }
        if (rows.length < PAGE) break;
        after = rows[rows.length - 1].id;
      }
      res.write(']');
    }
    res.end('}');
  })
);

export default router;
