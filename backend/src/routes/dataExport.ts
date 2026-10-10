// GET /api/account/export — everything an organization has stored, as one
// JSON file (plan §16, KVKK/GDPR data portability). The owner only.
//
// Written as a stream, table by table, a few hundred rows at a time, so an
// organization with years of conversations does not have to fit in memory.
// Secrets are left out by positive column lists. Subtracting a few known
// fields from `to_jsonb(t)` is unsafe because a future authentication column
// would silently become exportable.

import express from 'express';
import { auth } from '../middleware/auth';
import { query } from '../db/pool';
import { asyncHandler, forbidden, HttpError, orgId, requireOrganization } from '../http';
import type { Request, Response } from 'express';

const router = express.Router();
const PAGE = 500;
const MAX_EXPORT_BYTES = Number(process.env.DATA_EXPORT_MAX_BYTES) || 512 * 1024 * 1024;
const MAX_EXPORT_ROWS = Number(process.env.DATA_EXPORT_MAX_ROWS) || 5_000_000;
const activeExports = new Set<string>();

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
    row: `jsonb_build_object(
      'id', t.id, 'email', t.email, 'name', t.name, 'role', t.role,
      'avatar', t.avatar, 'is_active', t.is_active, 'is_onboarded', t.is_onboarded,
      'organization_id', t.organization_id, 'status', t.status,
      'permissions', t.permissions, 'preferences', t.preferences, 'stats', t.stats,
      'email_verified_at', t.email_verified_at, 'seat_suspended_at', t.seat_suspended_at,
      'google_email', t.google_email, 'created_at', t.created_at, 'updated_at', t.updated_at
    )`,
    where: 't.organization_id = $1'
  },
  {
    key: 'teamMembers',
    table: 'teams',
    row: `jsonb_build_object(
      'id', t.id, 'email', t.email, 'name', t.name, 'role', t.role,
      'avatar', t.avatar, 'organization_id', t.organization_id,
      'is_active', t.is_active, 'status', t.status, 'skills', t.skills,
      'preferences', t.preferences, 'max_capacity', t.max_capacity,
      'current_load', t.current_load, 'permissions', t.permissions, 'stats', t.stats,
      'last_active', t.last_active, 'phone', t.phone, 'bio', t.bio,
      'email_verified_at', t.email_verified_at, 'seat_suspended_at', t.seat_suspended_at,
      'google_email', t.google_email, 'created_at', t.created_at, 'updated_at', t.updated_at
    )`,
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
    if (activeExports.has(organizationId)) {
      throw new HttpError(429, 'An export is already running for this organization', 'EXPORT_BUSY');
    }
    activeExports.add(organizationId);
    let bytes = 0;
    let rowCount = 0;
    let aborted = false;
    req.once('aborted', () => {
      aborted = true;
    });
    const write = async (chunk: string): Promise<void> => {
      if (aborted || res.destroyed) throw new Error('Export client disconnected');
      bytes += Buffer.byteLength(chunk);
      if (bytes > MAX_EXPORT_BYTES) throw new Error('Export byte limit exceeded');
      if (res.write(chunk)) return;
      await new Promise<void>((resolve, reject) => {
        const drain = () => {
          cleanup();
          resolve();
        };
        const closed = () => {
          cleanup();
          reject(new Error('Export client disconnected'));
        };
        const cleanup = () => {
          res.off('drain', drain);
          res.off('close', closed);
          res.off('error', closed);
        };
        res.once('drain', drain);
        res.once('close', closed);
        res.once('error', closed);
      });
    };

    try {
      const { rows: org } = await query(
        'SELECT id, name, plan_type, created_at FROM organizations WHERE id = $1',
        [organizationId]
      );

      const day = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="supportio-export-${day}.json"`);
      res.setHeader('Cache-Control', 'no-store');
      await write(
        `{"exportedAt":${JSON.stringify(new Date().toISOString())},"organization":${JSON.stringify(org[0] ?? null)}`
      );

      for (const { key, table, row, where } of TABLES) {
        // eslint-disable-next-line no-await-in-loop
        await write(`,${JSON.stringify(key)}:[`);
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
            rowCount += 1;
            if (rowCount > MAX_EXPORT_ROWS) throw new Error('Export row limit exceeded');
            // eslint-disable-next-line no-await-in-loop
            await write((first ? '' : ',') + JSON.stringify(r.row));
            first = false;
          }
          if (rows.length < PAGE) break;
          after = rows[rows.length - 1].id;
        }
        // eslint-disable-next-line no-await-in-loop
        await write(']');
      }
      res.end('}');
    } finally {
      activeExports.delete(organizationId);
    }
  })
);

export default router;
