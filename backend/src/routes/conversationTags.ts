// The organization's conversation tags (plan v10 PRD-07): a short list of
// names with a colour. Conversations keep the names (conversations.tags);
// renaming or deleting a tag here changes every conversation that carries it.
//
//   GET    /api/conversation-tags        every member
//   POST   /api/conversation-tags        { name, color? }   anyone who answers
//   PUT    /api/conversation-tags/:id    { name?, color? }  manage_operations
//   DELETE /api/conversation-tags/:id                       manage_operations
//
// Creating is idempotent: a name that exists (in any case) returns that tag,
// so the inbox can add a new tag and use it in one step.

import express from 'express';
import { auth } from '../middleware/auth';
import { checkPermission } from '../middleware/rbac';
import { query, withTransaction } from '../db/pool';
import { generateId } from '../db/objectId';
import {
  asyncHandler,
  badRequest,
  conflict,
  notFound,
  orgId,
  requireObjectId,
  requireOrganization
} from '../http';
import type { Request, Response } from 'express';

const router = express.Router();
router.use(auth, requireOrganization);

/** Letters (any language), digits, spaces, - and _; up to 32 characters. */
const TAG_NAME = /^[\p{L}\p{N}][\p{L}\p{N} _-]{0,31}$/u;
const COLOR = /^#[0-9a-f]{6}$/i;
const DEFAULT_COLOR = '#6366F1';
/** A catalog this long is a list nobody reads; it also bounds the work. */
export const MAX_TAGS_PER_ORGANIZATION = 200;

interface TagRow {
  id: string;
  name: string;
  color: string;
}

const present = (row: TagRow) => ({ _id: row.id, name: row.name, color: row.color });

/** A tag name as stored: trimmed, inner spaces collapsed; null when invalid. */
export function tagName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim().replace(/\s+/g, ' ');
  return TAG_NAME.test(name) ? name : null;
}

function colorOf(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !COLOR.test(value)) {
    throw badRequest('The colour is a hex value such as #6366F1');
  }
  return value.toUpperCase();
}

/**
 * The catalog's spelling of each name, adding the ones it lacks. Used by the
 * inbox when an agent tags a conversation with a name the organization has
 * not listed yet.
 *
 * Upper and lower case are compared by PostgreSQL alone (the unique index on
 * lower(name)): JavaScript lowers "İ" to "i" plus a combining dot, the
 * database to "i", and mixing the two would let "İade" and "iade" in twice.
 */
export async function ensureTags(
  organizationId: string,
  names: string[]
): Promise<Map<string, string>> {
  if (!names.length) return new Map();
  const { rows } = await query<{ n: number }>(
    'SELECT count(*)::int AS n FROM conversation_tag_catalog WHERE organization_id = $1',
    [organizationId]
  );
  const absent = await query<{ name: string }>(
    `SELECT DISTINCT ON (lower(x)) x AS name FROM unnest($2::text[]) AS x
      WHERE NOT EXISTS (
        SELECT 1 FROM conversation_tag_catalog c
         WHERE c.organization_id = $1 AND lower(c.name) = lower(x))`,
    [organizationId, names]
  );
  const missing = absent.rows.map((r) => r.name);
  if (rows[0].n + missing.length > MAX_TAGS_PER_ORGANIZATION) {
    throw conflict(
      `An organization can have at most ${MAX_TAGS_PER_ORGANIZATION} tags`,
      'TAG_LIMIT'
    );
  }
  if (missing.length) {
    await query(
      `INSERT INTO conversation_tag_catalog (id, organization_id, name, color)
       SELECT id, $1, name, $2 FROM unnest($3::text[], $4::text[]) AS t (id, name)
       ON CONFLICT (organization_id, lower(name)) DO NOTHING`,
      [organizationId, DEFAULT_COLOR, missing.map(() => generateId()), missing]
    );
  }
  const spelled = await query<{ input: string; name: string }>(
    `SELECT x AS input, c.name FROM unnest($2::text[]) AS x
       JOIN conversation_tag_catalog c
         ON c.organization_id = $1 AND lower(c.name) = lower(x)`,
    [organizationId, names]
  );
  return new Map(spelled.rows.map((r) => [r.input, r.name]));
}

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { rows } = await query<TagRow>(
      `SELECT id, name, color FROM conversation_tag_catalog
        WHERE organization_id = $1 ORDER BY lower(name)`,
      [orgId(req)]
    );
    res.json({ tags: rows.map(present) });
  })
);

router.post(
  '/',
  checkPermission('respond'),
  asyncHandler(async (req: Request, res: Response) => {
    const name = tagName(req.body?.name);
    if (!name) throw badRequest('A tag is 1-32 letters, digits, spaces, - or _');
    const color = colorOf(req.body?.color) ?? DEFAULT_COLOR;
    const organizationId = orgId(req);

    const found = await query<TagRow>(
      `SELECT id, name, color FROM conversation_tag_catalog
        WHERE organization_id = $1 AND lower(name) = lower($2)`,
      [organizationId, name]
    );
    if (found.rows[0]) {
      res.json({ tag: present(found.rows[0]) });
      return;
    }
    await ensureTags(organizationId, [name]);
    const created = await query<TagRow>(
      `SELECT id, name, color FROM conversation_tag_catalog
        WHERE organization_id = $1 AND lower(name) = lower($2)`,
      [organizationId, name]
    );
    if (color !== DEFAULT_COLOR) {
      await query('UPDATE conversation_tag_catalog SET color = $2 WHERE id = $1', [
        created.rows[0].id,
        color
      ]);
      created.rows[0].color = color;
    }
    res.status(201).json({ tag: present(created.rows[0]) });
  })
);

router.put(
  '/:id',
  checkPermission('manage_operations'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = requireObjectId(req.params.id, 'tag id');
    const organizationId = orgId(req);
    const { rows } = await query<TagRow>(
      'SELECT id, name, color FROM conversation_tag_catalog WHERE id = $1 AND organization_id = $2',
      [id, organizationId]
    );
    const tag = rows[0];
    if (!tag) throw notFound('Tag');

    const name = req.body?.name === undefined ? tag.name : tagName(req.body.name);
    if (!name) throw badRequest('A tag is 1-32 letters, digits, spaces, - or _');
    const color = colorOf(req.body?.color) ?? tag.color;

    if (name.toLowerCase() !== tag.name.toLowerCase()) {
      const clash = await query(
        `SELECT 1 FROM conversation_tag_catalog
          WHERE organization_id = $1 AND lower(name) = lower($2) AND id <> $3`,
        [organizationId, name, id]
      );
      if (clash.rowCount) throw conflict('A tag with this name exists', 'TAG_EXISTS');
    }

    await withTransaction(async (client) => {
      await client.query(
        'UPDATE conversation_tag_catalog SET name = $2, color = $3 WHERE id = $1',
        [id, name, color]
      );
      // The conversations carry the name: a rename follows them.
      if (name !== tag.name) {
        await client.query(
          `UPDATE conversations SET tags = array_replace(tags, $2, $3)
            WHERE organization_id = $1 AND tags @> ARRAY[$2]::text[]`,
          [organizationId, tag.name, name]
        );
      }
    });
    res.json({ tag: { _id: id, name, color } });
  })
);

router.delete(
  '/:id',
  checkPermission('manage_operations'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = requireObjectId(req.params.id, 'tag id');
    const organizationId = orgId(req);
    await withTransaction(async (client) => {
      const { rows } = await client.query<{ name: string }>(
        'DELETE FROM conversation_tag_catalog WHERE id = $1 AND organization_id = $2 RETURNING name',
        [id, organizationId]
      );
      if (!rows[0]) throw notFound('Tag');
      await client.query(
        `UPDATE conversations SET tags = array_remove(tags, $2)
          WHERE organization_id = $1 AND tags @> ARRAY[$2]::text[]`,
        [organizationId, rows[0].name]
      );
    });
    res.status(204).end();
  })
);

export default router;
