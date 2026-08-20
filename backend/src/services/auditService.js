const events = require('../events');
const AuditLog = require('../models/AuditLog');
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
  SLA_BREACH: 'SLA_BREACH',
  AUTOMATION_RULE_CREATED: 'AUTOMATION_RULE_CREATED',
  AUTOMATION_RULE_UPDATED: 'AUTOMATION_RULE_UPDATED',
  AUTOMATION_RULE_DELETED: 'AUTOMATION_RULE_DELETED',
  AUTOMATION_EXECUTED: 'AUTOMATION_EXECUTED'
};
async function logAction({ organizationId, userId = null, action, entityType = null, entityId = null, metadata = {}, ipAddress = null, userAgent = null }) {
  if (!action) throw new Error('action is required for audit log');
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
  await doc.save();
  return true;
}
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
  }
});
// Automation rule lifecycle. The three rule events share a shape, so they are
// registered from a table rather than repeating the same handler three times.
const RULE_EVENTS = {
  'automation.rule.created': ACTIONS.AUTOMATION_RULE_CREATED,
  'automation.rule.updated': ACTIONS.AUTOMATION_RULE_UPDATED,
  'automation.rule.deleted': ACTIONS.AUTOMATION_RULE_DELETED
};
for (const [eventName, action] of Object.entries(RULE_EVENTS)) {
  events.on(eventName, async (payload) => {
    try {
      await logAction({
        organizationId: payload.organizationId,
        userId: payload.userId || null,
        action,
        entityType: 'automation_rule',
        entityId: payload.entityId,
        metadata: payload.metadata || {},
        ipAddress: payload.ip,
        userAgent: payload.ua
      });
    } catch (e) {
    }
  });
}

// A rule firing against a conversation. The actor is the rule itself, so userId
// stays null and the rule is identified in the metadata.
events.on('automation.executed', async (payload) => {
  try {
    await logAction({
      organizationId: payload.organizationId,
      userId: null,
      action: ACTIONS.AUTOMATION_EXECUTED,
      entityType: 'ticket',
      entityId: payload.entityId,
      metadata: payload.metadata || {},
      ipAddress: null,
      userAgent: null
    });
  } catch (e) {
  }
});

module.exports = {
  logAction
};

