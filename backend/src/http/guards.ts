// Request-scoped authorization: which tenant is calling, and may they touch
// this row.
//
// Two patterns were repeated in almost every handler. The first was the tenant
// check, written out 38 times:
//
//     const orgId = requireOrgId(req, res);
//     if (!orgId) return;
//
// It is a guard, so it belongs in the middleware chain where the rest of the
// guards already are — `auth`, `checkPermission`, `requirePlan`. Written inside
// the handler it is easy to place after the first query, which is what happened
// in `deals.ts` and `visitors.ts`: they read `req.user.organizationId` directly
// and never checked it at all.
//
// The second was ownership resolution — load the row, load its site, compare
// the organization — which `departments.ts` alone repeated six times:
//
//     const department = await Department.findById(req.params.id);
//     if (!department) return res.status(404).json(...);
//     const site = await Site.findById(department.siteId);
//     if (!site || site.organizationId.toString() !== orgId.toString()) return ...
//
// Four lines where one of the four can be forgotten. `GET /team/:id/stats` did
// forget it and read across tenants. The loaders below do the whole check in
// one call and throw `notFound` when any part of it fails, so a missing row and
// another tenant's row are indistinguishable from outside.

import Conversation from '../models/Conversation';
import Department from '../models/Department';
import Site from '../models/Site';
import Team from '../models/Team';
import { isValidObjectId } from '../db/objectId';
import { badRequest, forbidden, notFound } from './errors';
import type { NextFunction, Request, Response } from 'express';
import type { Doc } from '../db/model';
import type { ConversationDoc } from '../models/Conversation';
import type { DepartmentDoc } from '../models/Department';
import type { SiteDoc } from '../models/Site';
import type { TeamDoc } from '../models/Team';

// ---------------------------------------------------------------- the tenant

/**
 * The organization the caller acts for, or null when they belong to none.
 *
 * Every tenant-scoped query filters on this. It used to be spread in
 * conditionally — `...(orgId ? { organizationId: orgId } : {})` — so a caller
 * without an organization searched *every* tenant's rows instead of none.
 * Authorization has to fail closed: callers treat null as "refuse", never as
 * "no filter".
 */
export function callerOrgId(req: Request): string | null {
  const orgId = req.organization?._id || req.user?.organizationId;
  return orgId ? String(orgId) : null;
}

/**
 * Rejects a request made without an organization.
 *
 * Nothing in this API is readable outside a tenant, so such a caller has
 * nothing they may legitimately see. Mount it after `auth` on any router whose
 * handlers call `orgId(req)`.
 */
export function requireOrganization(req: Request, _res: Response, next: NextFunction): void {
  if (!callerOrgId(req)) {
    throw forbidden('No organization for this account', 'NO_ORGANIZATION');
  }
  next();
}

/**
 * The caller's organization id, for a handler mounted behind
 * `requireOrganization`.
 *
 * It throws rather than returning null so that forgetting the middleware is a
 * loud 500 in development instead of a query that quietly runs unscoped.
 */
export function orgId(req: Request): string {
  const id = callerOrgId(req);
  if (!id) throw forbidden('No organization for this account', 'NO_ORGANIZATION');
  return id;
}

// ------------------------------------------------------------------ id checks

/** Validates a path or body id, answering 400 rather than letting it reach SQL. */
export function requireObjectId(value: unknown, label = 'id'): string {
  if (!isValidObjectId(value)) throw badRequest(`Invalid ${label}`);
  return String(value);
}

// ------------------------------------------------------------------- loaders
//
// Each loader answers the same question — "may this caller act on this row?" —
// and throws `notFound` for every way the answer can be no: a malformed id, a
// row that does not exist, and a row owned by somebody else. Callers that want
// the nullable form use the `find*` variants below.

/** The site, if the caller's organization owns it. */
export async function findOwnedSite(req: Request, siteId: unknown): Promise<Doc<SiteDoc> | null> {
  if (!isValidObjectId(siteId)) return null;
  const id = callerOrgId(req);
  if (!id) return null;
  return Site.findOne({ _id: siteId, organizationId: id });
}

export async function loadOwnedSite(req: Request, siteId: unknown): Promise<Doc<SiteDoc>> {
  const site = await findOwnedSite(req, siteId);
  if (!site) throw notFound('Site');
  return site;
}

/** The conversation, if it belongs to the caller's organization. */
export async function findOwnedConversation(
  req: Request,
  conversationId: unknown
): Promise<Doc<ConversationDoc> | null> {
  if (!isValidObjectId(conversationId)) return null;
  const id = callerOrgId(req);
  if (!id) return null;
  return Conversation.findOne({ _id: conversationId, organizationId: id });
}

export async function loadOwnedConversation(
  req: Request,
  conversationId: unknown
): Promise<Doc<ConversationDoc>> {
  const conversation = await findOwnedConversation(req, conversationId);
  if (!conversation) throw notFound('Conversation');
  return conversation;
}

/** Roles that reach every site in their organization regardless of assignment. */
const UNRESTRICTED_ROLES = new Set(['owner', 'admin']);

/**
 * Whether an account may work on a site of its own organization.
 *
 * The inbox rule: owners and admins reach every site; anyone else reaches the
 * sites they are assigned to, and an empty assignment list means all of them.
 * The socket layer and the HTTP routes both ask this one function, so the two
 * ways into a conversation cannot disagree about who may open it.
 */
export function mayAccessSite(
  role: string | undefined,
  assignedSites: Iterable<unknown> | undefined,
  siteId: unknown
): boolean {
  if (role && UNRESTRICTED_ROLES.has(role)) return true;
  const sites = Array.from(assignedSites ?? [], String);
  return sites.length === 0 || sites.includes(String(siteId));
}

/**
 * The conversation, if the caller may work on it: same organization *and* a
 * site their role and assignment reach.
 *
 * `loadOwnedConversation` stops at the organization, which let an agent
 * restricted to one site open another site's thread by id. Anything that reads
 * a transcript back to the caller — the AI copilot in particular — uses this.
 */
export async function loadAccessibleConversation(
  req: Request,
  conversationId: unknown
): Promise<Doc<ConversationDoc>> {
  const conversation = await loadOwnedConversation(req, conversationId);
  if (!mayAccessSite(req.user?.role, req.user?.assignedSites, conversation.siteId)) {
    throw notFound('Conversation');
  }
  return conversation;
}

/**
 * The department, if the caller's organization owns the site it hangs from.
 *
 * Departments carry no `organizationId` of their own — they belong to a site —
 * which is why the check needs two reads and why every handler that wrote it
 * out by hand was a chance to get it wrong.
 */
export async function findOwnedDepartment(
  req: Request,
  departmentId: unknown
): Promise<Doc<DepartmentDoc> | null> {
  if (!isValidObjectId(departmentId)) return null;
  const department = await Department.findById(departmentId);
  if (!department) return null;
  return (await findOwnedSite(req, department.siteId)) ? department : null;
}

export async function loadOwnedDepartment(
  req: Request,
  departmentId: unknown
): Promise<Doc<DepartmentDoc>> {
  const department = await findOwnedDepartment(req, departmentId);
  if (!department) throw notFound('Department');
  return department;
}

/**
 * Ownership for any row that hangs off a site rather than carrying its own
 * organization — FAQs, automation rules, proactive rules, widget configs.
 *
 * Each of those routes grew its own `findOwnedX`, all four the same three
 * steps with slightly different wording. Pass the loaded row; a missing row and
 * another tenant's row both answer 404, so the endpoint never confirms that an
 * id it will not serve exists.
 *
 *     const rule = await requireSiteOwnership(req, await Rule.findById(id), 'Rule');
 */
export async function requireSiteOwnership<T extends { siteId: unknown }>(
  req: Request,
  row: Doc<T> | null | undefined,
  label: string
): Promise<Doc<T>> {
  if (!row) throw notFound(label);
  if (!(await findOwnedSite(req, row.siteId))) throw notFound(label);
  return row;
}

/** The team member, if they are in the caller's organization. */
export async function loadOwnedTeamMember(req: Request, memberId: unknown): Promise<Doc<TeamDoc>> {
  if (!isValidObjectId(memberId)) throw notFound('Team member');
  const member = await Team.findOne({ _id: memberId, organizationId: orgId(req) });
  if (!member) throw notFound('Team member');
  return member;
}

// --------------------------------------------------------------- body helpers

/**
 * The subset of a request body a handler is willing to write.
 *
 * Several handlers built this by hand, each slightly differently: one rejected
 * the whole request when an unknown key appeared, another silently dropped it,
 * a third used `Object.assign` with no list at all. The shape a caller may set
 * is part of the endpoint's contract, so it is stated once per route as a list
 * and applied the same way everywhere.
 */
export function pick<T extends object>(
  body: unknown,
  allowed: readonly (keyof T & string)[]
): Partial<T> {
  if (!body || typeof body !== 'object') return {};
  const source = body as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out as Partial<T>;
}

/** `pick`, but a key outside the list is an error instead of being dropped. */
export function pickStrict<T extends object>(
  body: unknown,
  allowed: readonly (keyof T & string)[]
): Partial<T> {
  if (!body || typeof body !== 'object') return {};
  const unknownKeys = Object.keys(body as Record<string, unknown>).filter(
    (key) => !(allowed as readonly string[]).includes(key)
  );
  if (unknownKeys.length) {
    throw badRequest(`Unsupported field: ${unknownKeys.join(', ')}`);
  }
  return pick<T>(body, allowed);
}
