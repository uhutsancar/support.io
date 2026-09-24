// The audit trail: a durable record of who did what, for the organizations
// whose plan includes it.
//
// This file was twelve copies of the same eleven-line listener, differing only
// in the action name, the entity type and which field of the payload holds the
// entity id. Every one of them ended in `catch (e) { }` — so when audit writes
// started failing, nothing anywhere said so, and the trail simply had holes in
// it that looked exactly like "nothing happened".
//
// The listeners are now generated from one table. Adding an audited event means
// adding a row, and a failure is reported once, in one place.

import events from '../events';
import AuditLog from '../models/AuditLog';
import type { AuditAction } from '../models/AuditLog';

/** The payload every emitter sends; all members are optional by convention. */
interface AuditEventPayload {
  organizationId?: string | null;
  userId?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  ua?: string | null;
}

/** One row for the organization's audit trail. */
export interface AuditEntry {
  organizationId?: string | null;
  userId?: string | null;
  action: AuditAction;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function logAction({
  organizationId = null,
  userId = null,
  action,
  entityType = null,
  entityId = null,
  metadata = {},
  ipAddress = null,
  userAgent = null
}: AuditEntry): Promise<boolean> {
  if (!action) throw new Error('action is required for audit log');
  await AuditLog.create({
    organizationId,
    userId,
    action,
    entityType,
    entityId,
    metadata,
    ipAddress,
    userAgent
  });
  return true;
}

/** How one emitted event becomes an audit row. */
interface AuditRule {
  action: AuditAction;
  /** What kind of thing the row is about. */
  entityType: string;
  /**
   * Which part of the payload identifies that thing. Defaults to `entityId`,
   * which is what most emitters send.
   */
  entityId?: (payload: AuditEventPayload) => string | null | undefined;
  /**
   * True when the actor is the system rather than a person — a rule firing on
   * its own. The row then carries no user and no request metadata, because
   * there was no request.
   */
  systemActor?: boolean;
}

const AUDITED_EVENTS: Record<string, AuditRule> = {
  'auth.login.success': {
    action: 'LOGIN_SUCCESS',
    entityType: 'user',
    entityId: (p) => p.userId
  },
  'auth.login.failure': {
    action: 'LOGIN_FAILED',
    entityType: 'user',
    entityId: (p) => p.userId
  },
  'agent.created': { action: 'CREATE_AGENT', entityType: 'agent' },
  'agent.deleted': { action: 'DELETE_AGENT', entityType: 'agent' },
  'agent.role.updated': { action: 'UPDATE_AGENT_ROLE', entityType: 'agent' },
  'plan.changed': {
    action: 'PLAN_CHANGED',
    entityType: 'organization',
    entityId: (p) => p.organizationId
  },
  'sla.updated': { action: 'UPDATE_SLA', entityType: 'department' },
  'ticket.closed': { action: 'TICKET_CLOSED', entityType: 'ticket' },
  'ticket.reopened': { action: 'TICKET_REOPENED', entityType: 'ticket' },
  'sla.breach': { action: 'SLA_BREACH', entityType: 'ticket' },
  'automation.rule.created': { action: 'AUTOMATION_RULE_CREATED', entityType: 'automation_rule' },
  'automation.rule.updated': { action: 'AUTOMATION_RULE_UPDATED', entityType: 'automation_rule' },
  'automation.rule.deleted': { action: 'AUTOMATION_RULE_DELETED', entityType: 'automation_rule' },
  // Who may answer on a site's behalf, and what the site's integrations may
  // reach. The metadata names what changed, never a secret.
  'site.ai.updated': { action: 'SITE_AI_SETTINGS_UPDATED', entityType: 'site' },
  'site.integration.updated': { action: 'SITE_INTEGRATION_UPDATED', entityType: 'site' },
  // A rule firing against a conversation: the actor is the rule, identified in
  // the metadata, so there is no user and no originating request.
  'automation.executed': {
    action: 'AUTOMATION_EXECUTED',
    entityType: 'ticket',
    systemActor: true
  }
};

for (const [eventName, rule] of Object.entries(AUDITED_EVENTS)) {
  events.on(eventName, async (payload: AuditEventPayload = {}) => {
    try {
      await logAction({
        organizationId: payload.organizationId ?? null,
        userId: rule.systemActor ? null : (payload.userId ?? null),
        action: rule.action,
        entityType: rule.entityType,
        entityId: (rule.entityId ? rule.entityId(payload) : payload.entityId) ?? null,
        metadata: payload.metadata ?? {},
        ipAddress: rule.systemActor ? null : (payload.ip ?? null),
        userAgent: rule.systemActor ? null : (payload.ua ?? null)
      });
    } catch (error) {
      // An audit write must never break the action it is recording — the user
      // already signed in, the ticket is already closed. But a silent failure
      // leaves gaps that read as "nothing happened", so it is reported.
      console.error(`[audit] could not record ${eventName}`, error);
    }
  });
}

export { AUDITED_EVENTS };
