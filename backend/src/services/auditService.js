const events = require('../events');
const AuditLog = require('../models/AuditLog');

/**
 * Centralized audit service. Listens to domain events and writes immutable audit records.
 * Use: events.emit('agent.created', { organizationId, userId, entityId, metadata, ip, ua })
 */
const ACTIONS = {
  AUTH_SUCCESS: 'LOGIN_SUCCESS',
  AUTH_FAILED: 'LOGIN_FAILED',
  CREATE_AGENT: 'CREATE_AGENT',
  DELETE_AGENT: 'DELETE_AGENT',
  UPDATE_AGENT_ROLE: 'UPDATE_AGENT_ROLE',
  PLAN_CHANGED: 'PLAN_CHANGED',
  UPDATE_SLA: 'UPDATE_SLA',
  TICKET_CLOSED: 'TICKET_CLOSED',
  TICKET_REOPENED: 'TICKET_REOPENED',
  SLA_BREACH: 'SLA_BREACH'
};

async function logAction({ organizationId, userId = null, action, entityType = null, entityId = null, metadata = {}, ipAddress = null, userAgent = null }) {
  if (!action) throw new Error('action is required for audit log');

  // organizationId is strongly recommended; allow null for unknown-org login attempts
  const doc = new AuditLog({
    organizationId: organizationId || null,
    userId: userId || null,
    action,
    entityType,
    entityId: entityId || null,
    metadata: metadata || {},
    ipAddress: ipAddress || null,
    userAgent: userAgent || null
  });

  // write-only: do not return sensitive data
  await doc.save();
  return true;
}

// Event bindings
events.on('auth.login.success', async (payload) => {
  try {
    await logAction({
      organizationId: payload.organizationId,
      userId: payload.userId,
      action: ACTIONS.AUTH_SUCCESS,
      entityType: 'user',
      entityId: payload.userId,
      metadata: payload.metadata || {},
      ipAddress: payload.ip,
      userAgent: payload.ua
    });
  } catch (e) {
    console.warn('Audit log failed for auth.login.success:', e.message);
  }
});

events.on('auth.login.failure', async (payload) => {
  try {
    await logAction({
      organizationId: payload.organizationId || null,
      userId: payload.userId || null,
      action: ACTIONS.AUTH_FAILED,
      entityType: 'user',
      entityId: payload.userId || null,
      metadata: payload.metadata || {},
      ipAddress: payload.ip,
      userAgent: payload.ua
    });
  } catch (e) {
    console.warn('Audit log failed for auth.login.failure:', e.message);
  }
});

events.on('agent.created', async (payload) => {
  try {
    await logAction({
      organizationId: payload.organizationId,
      userId: payload.userId || null,
      action: ACTIONS.CREATE_AGENT,
      entityType: 'agent',
      entityId: payload.entityId,
      metadata: payload.metadata || {},
      ipAddress: payload.ip,
      userAgent: payload.ua
    });
  } catch (e) {
    console.warn('Audit log failed for agent.created:', e.message);
  }
});

events.on('agent.deleted', async (payload) => {
  try {
    await logAction({
      organizationId: payload.organizationId,
      userId: payload.userId || null,
      action: ACTIONS.DELETE_AGENT,
      entityType: 'agent',
      entityId: payload.entityId,
      metadata: payload.metadata || {},
      ipAddress: payload.ip,
      userAgent: payload.ua
    });
  } catch (e) {
    console.warn('Audit log failed for agent.deleted:', e.message);
  }
});

events.on('agent.role.updated', async (payload) => {
  try {
    await logAction({
      organizationId: payload.organizationId,
      userId: payload.userId || null,
      action: ACTIONS.UPDATE_AGENT_ROLE,
      entityType: 'agent',
      entityId: payload.entityId,
      metadata: payload.metadata || {},
      ipAddress: payload.ip,
      userAgent: payload.ua
    });
  } catch (e) {
    console.warn('Audit log failed for agent.role.updated:', e.message);
  }
});

events.on('plan.changed', async (payload) => {
  try {
    await logAction({
      organizationId: payload.organizationId,
      userId: payload.userId || null,
      action: ACTIONS.PLAN_CHANGED,
      entityType: 'organization',
      entityId: payload.organizationId,
      metadata: payload.metadata || {},
      ipAddress: payload.ip,
      userAgent: payload.ua
    });
  } catch (e) {
    console.warn('Audit log failed for plan.changed:', e.message);
  }
});

events.on('sla.updated', async (payload) => {
  try {
    await logAction({
      organizationId: payload.organizationId,
      userId: payload.userId || null,
      action: ACTIONS.UPDATE_SLA,
      entityType: 'department',
      entityId: payload.entityId || null,
      metadata: payload.metadata || {},
      ipAddress: payload.ip,
      userAgent: payload.ua
    });
  } catch (e) {
    console.warn('Audit log failed for sla.updated:', e.message);
  }
});

events.on('ticket.closed', async (payload) => {
  try {
    await logAction({
      organizationId: payload.organizationId,
      userId: payload.userId || null,
      action: ACTIONS.TICKET_CLOSED,
      entityType: 'ticket',
      entityId: payload.entityId,
      metadata: payload.metadata || {},
      ipAddress: payload.ip,
      userAgent: payload.ua
    });
  } catch (e) {
    console.warn('Audit log failed for ticket.closed:', e.message);
  }
});

events.on('ticket.reopened', async (payload) => {
  try {
    await logAction({
      organizationId: payload.organizationId,
      userId: payload.userId || null,
      action: ACTIONS.TICKET_REOPENED,
      entityType: 'ticket',
      entityId: payload.entityId,
      metadata: payload.metadata || {},
      ipAddress: payload.ip,
      userAgent: payload.ua
    });
  } catch (e) {
    console.warn('Audit log failed for ticket.reopened:', e.message);
  }
});

events.on('sla.breach', async (payload) => {
  try {
    await logAction({
      organizationId: payload.organizationId,
      userId: payload.userId || null,
      action: ACTIONS.SLA_BREACH,
      entityType: 'ticket',
      entityId: payload.entityId,
      metadata: payload.metadata || {},
      ipAddress: payload.ip,
      userAgent: payload.ua
    });
  } catch (e) {
    console.warn('Audit log failed for sla.breach:', e.message);
  }
});

module.exports = {
  logAction
};
