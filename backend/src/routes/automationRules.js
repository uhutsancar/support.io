const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');
const { findOwnedSite } = require('../middleware/siteAuth');
const AutomationRule = require('../models/AutomationRule');
const { isValidObjectId } = require('../db/objectId');
const events = require('../events');

const TRIGGER_TYPES = ['message_received', 'conversation_created', 'visitor_event', 'schedule'];
const ACTION_TYPES = ['send_message', 'assign_team', 'assign_agent', 'add_tag', 'change_status', 'internal_note'];
const CONDITION_OPERATORS = ['AND', 'OR'];
const CONVERSATION_STATUSES = ['open', 'assigned', 'pending', 'resolved', 'closed', 'unassigned'];
const COMPARATORS = [
  'equals', 'not_equals', 'contains', 'not_contains',
  'greater_than', 'less_than', 'exists', 'not_exists'
];

// Loads a rule only if the caller's organization owns the site it belongs to.
// Every mutating handler goes through this, so a rule id guessed from another
// tenant resolves to null rather than to somebody else's rule.
async function findOwnedRule(req, ruleId) {
  if (!isValidObjectId(ruleId)) return null;
  const rule = await AutomationRule.findById(ruleId);
  if (!rule) return null;
  const site = await findOwnedSite(req, rule.siteId);
  return site ? rule : null;
}

// Rejects malformed rule bodies before they reach the engine. The engine reads
// conditions and actions as opaque JSON, so anything not validated here would
// only fail later at execution time, inside a background trigger where the
// author never sees the error.
function validateRuleBody(body, { partial = false } = {}) {
  const errors = [];

  if (!partial || body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      errors.push('name is required');
    }
  }

  if (!partial || body.triggerType !== undefined) {
    if (!TRIGGER_TYPES.includes(body.triggerType)) {
      errors.push(`triggerType must be one of: ${TRIGGER_TYPES.join(', ')}`);
    }
  }

  if (body.conditionOperator !== undefined && !CONDITION_OPERATORS.includes(body.conditionOperator)) {
    errors.push('conditionOperator must be AND or OR');
  }

  if (body.conditions !== undefined) {
    if (!Array.isArray(body.conditions)) {
      errors.push('conditions must be an array');
    } else {
      body.conditions.forEach((condition, i) => {
        if (!condition || typeof condition !== 'object') {
          errors.push(`conditions[${i}] must be an object`);
          return;
        }
        if (typeof condition.field !== 'string' || !condition.field.trim()) {
          errors.push(`conditions[${i}].field is required`);
        }
        if (!COMPARATORS.includes(condition.operator)) {
          errors.push(`conditions[${i}].operator must be one of: ${COMPARATORS.join(', ')}`);
        }
      });
    }
  }

  if (body.actions !== undefined) {
    if (!Array.isArray(body.actions)) {
      errors.push('actions must be an array');
    } else if (!partial && body.actions.length === 0) {
      errors.push('at least one action is required');
    } else {
      body.actions.forEach((action, i) => {
        if (!action || typeof action !== 'object') {
          errors.push(`actions[${i}] must be an object`);
          return;
        }
        if (!ACTION_TYPES.includes(action.type)) {
          errors.push(`actions[${i}].type must be one of: ${ACTION_TYPES.join(', ')}`);
          return;
        }
        const payload = action.payload || {};
        if (action.type === 'send_message' && !String(payload.text || '').trim()) {
          errors.push(`actions[${i}].payload.text is required for send_message`);
        }
        if (action.type === 'internal_note' && !String(payload.note || '').trim()) {
          errors.push(`actions[${i}].payload.note is required for internal_note`);
        }
        if (action.type === 'add_tag' && !String(payload.tag || '').trim()) {
          errors.push(`actions[${i}].payload.tag is required for add_tag`);
        }
        if (action.type === 'assign_agent' && !isValidObjectId(payload.agentId)) {
          errors.push(`actions[${i}].payload.agentId must be a valid id`);
        }
        if (action.type === 'assign_team' && !isValidObjectId(payload.departmentId)) {
          errors.push(`actions[${i}].payload.departmentId must be a valid id`);
        }
        if (action.type === 'change_status' && !CONVERSATION_STATUSES.includes(payload.status)) {
          errors.push(`actions[${i}].payload.status must be one of: ${CONVERSATION_STATUSES.join(', ')}`);
        }
      });
    }
  }

  if (body.priority !== undefined && !Number.isFinite(Number(body.priority))) {
    errors.push('priority must be a number');
  }

  return errors;
}

// List the rules of one owned site, highest priority first.
router.get('/:siteId', auth, async (req, res) => {
  try {
    const site = await findOwnedSite(req, req.params.siteId);
    if (!site) return res.status(404).json({ error: 'Site not found' });

    const rules = await AutomationRule.find({ siteId: site._id })
      .sort({ priority: -1, createdAt: -1 })
      .limit(200);
    res.json(rules);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', auth, checkPermission('manage_sites'), async (req, res) => {
  try {
    const { siteId, name, triggerType, conditions, conditionOperator, actions, priority, isActive } = req.body;

    const site = await findOwnedSite(req, siteId);
    if (!site) return res.status(404).json({ error: 'Site not found' });

    const errors = validateRuleBody(req.body);
    if (errors.length) return res.status(400).json({ error: 'Validation failed', details: errors });

    const rule = new AutomationRule({
      siteId: site._id,
      name: name.trim(),
      triggerType,
      conditions: conditions || [],
      conditionOperator: conditionOperator || 'AND',
      actions,
      priority: priority === undefined ? 0 : Number(priority),
      isActive: isActive === undefined ? true : Boolean(isActive)
    });
    await rule.save();

    events.emit('automation.rule.created', {
      organizationId: site.organizationId,
      userId: req.userId,
      entityId: rule._id,
      metadata: { name: rule.name, triggerType: rule.triggerType, siteId: site._id }
    });

    res.status(201).json(rule);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:id', auth, checkPermission('manage_sites'), async (req, res) => {
  try {
    const rule = await findOwnedRule(req, req.params.id);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });

    const errors = validateRuleBody(req.body, { partial: true });
    if (errors.length) return res.status(400).json({ error: 'Validation failed', details: errors });

    // siteId, metrics and timestamps are deliberately not assignable: letting a
    // client set siteId would move a rule into another organization's site.
    const assignable = ['name', 'triggerType', 'conditions', 'conditionOperator', 'actions', 'priority', 'isActive'];
    for (const key of assignable) {
      if (req.body[key] === undefined) continue;
      if (key === 'name') rule.name = String(req.body.name).trim();
      else if (key === 'priority') rule.priority = Number(req.body.priority);
      else if (key === 'isActive') rule.isActive = Boolean(req.body.isActive);
      else rule[key] = req.body[key];
    }
    await rule.save();

    events.emit('automation.rule.updated', {
      organizationId: req.organization?._id || req.user.organizationId,
      userId: req.userId,
      entityId: rule._id,
      metadata: { name: rule.name, isActive: rule.isActive }
    });

    res.json(rule);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id', auth, checkPermission('manage_sites'), async (req, res) => {
  try {
    const rule = await findOwnedRule(req, req.params.id);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });

    await AutomationRule.findByIdAndDelete(rule._id);

    events.emit('automation.rule.deleted', {
      organizationId: req.organization?._id || req.user.organizationId,
      userId: req.userId,
      entityId: rule._id,
      metadata: { name: rule.name }
    });

    res.json({ message: 'Rule deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
