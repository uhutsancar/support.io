import express from 'express';
import { auth } from '../middleware/auth';
import { checkPermission } from '../middleware/rbac';
import {
  asyncHandler,
  badRequest,
  loadOwnedSite,
  requireOrganization,
  requireSiteOwnership
} from '../http';
import ProactiveRule from '../models/ProactiveRule';
import type { Request, Response } from 'express';

const router = express.Router();

// Kept in step with proactiveEngine.executeAction and the rule editor. A type
// the engine cannot perform would otherwise be saved and then silently do
// nothing at trigger time.
const ACTION_TYPES = ['send_message', 'open_popup', 'add_tag'];
const EVENT_TYPES = ['time_on_page', 'exit_intent', 'scroll_depth', 'inactivity', 'custom_event'];
const URL_MATCH_TYPES = ['any', 'exact', 'contains', 'regex'];
const DEVICE_TYPES = ['all', 'desktop', 'mobile', 'tablet'];

// Same ownership rule as the automation routes: a rule is only reachable when
// the caller's organization owns the site it belongs to.
const loadOwnedRule = async (req: Request, ruleId: unknown) =>
  requireSiteOwnership(req, await ProactiveRule.findById(ruleId), 'Rule');

function validateRuleBody(
  body: Record<string, any>,
  { partial = false }: { partial?: boolean } = {}
): string[] {
  const errors = [];

  if (!partial || body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      errors.push('name is required');
    }
  }

  const trigger = body.triggerCondition;
  if (trigger !== undefined) {
    if (typeof trigger !== 'object' || trigger === null) {
      errors.push('triggerCondition must be an object');
    } else {
      const seconds = trigger.timeThresholdSeconds;
      if (seconds !== undefined && (!Number.isFinite(Number(seconds)) || Number(seconds) < 0)) {
        errors.push('triggerCondition.timeThresholdSeconds must be a non-negative number');
      }
      const scroll = trigger.scrollPercentage;
      if (
        scroll !== undefined &&
        (!Number.isFinite(Number(scroll)) || Number(scroll) < 0 || Number(scroll) > 100)
      ) {
        errors.push('triggerCondition.scrollPercentage must be between 0 and 100');
      }
      if (trigger.eventType !== undefined && !EVENT_TYPES.includes(trigger.eventType)) {
        errors.push(`triggerCondition.eventType must be one of: ${EVENT_TYPES.join(', ')}`);
      }
      if (trigger.urlMatch !== undefined && !URL_MATCH_TYPES.includes(trigger.urlMatch)) {
        errors.push(`triggerCondition.urlMatch must be one of: ${URL_MATCH_TYPES.join(', ')}`);
      }
      // A regex arrives as a plain string and is compiled by the engine on every
      // matching event, so it is checked once here instead of throwing later.
      if (trigger.urlMatch === 'regex') {
        try {
          new RegExp(trigger.urlValue || '');
        } catch {
          errors.push('triggerCondition.urlValue is not a valid regular expression');
        }
      }
    }
  }

  if (body.audienceContext !== undefined) {
    const audience = body.audienceContext;
    if (typeof audience !== 'object' || audience === null) {
      errors.push('audienceContext must be an object');
    } else if (audience.deviceType !== undefined && !DEVICE_TYPES.includes(audience.deviceType)) {
      errors.push(`audienceContext.deviceType must be one of: ${DEVICE_TYPES.join(', ')}`);
    }
  }

  if (!partial || body.action !== undefined) {
    const action = body.action;
    if (typeof action !== 'object' || action === null) {
      errors.push('action must be an object');
    } else {
      if (!ACTION_TYPES.includes(action.type)) {
        errors.push(`action.type must be one of: ${ACTION_TYPES.join(', ')}`);
      }
      if (action.type === 'send_message' && !String(action.messageContent || '').trim()) {
        errors.push('action.messageContent is required for send_message');
      }
      if (action.type === 'add_tag' && !String(action.tag || '').trim()) {
        errors.push('action.tag is required for add_tag');
      }
    }
  }

  if (body.frequencyControl !== undefined) {
    const freq = body.frequencyControl;
    if (typeof freq !== 'object' || freq === null) {
      errors.push('frequencyControl must be an object');
    } else if (
      freq.cooldownMinutes !== undefined &&
      (!Number.isFinite(Number(freq.cooldownMinutes)) || Number(freq.cooldownMinutes) < 0)
    ) {
      errors.push('frequencyControl.cooldownMinutes must be a non-negative number');
    }
  }

  return errors;
}

router.get(
  '/:siteId',
  auth,
  requireOrganization,
  asyncHandler(async (req: Request, res: Response) => {
    const site = await loadOwnedSite(req, req.params.siteId);

    const rules = await ProactiveRule.find({ siteId: site._id }).sort({ createdAt: -1 }).limit(200);
    res.json(rules);
  })
);

router.post(
  '/',
  auth,
  requireOrganization,
  checkPermission('manage_sites'),
  asyncHandler(async (req: Request, res: Response) => {
    const { siteId, name, triggerCondition, audienceContext, action, frequencyControl, isActive } =
      req.body;

    const site = await loadOwnedSite(req, siteId);

    const errors = validateRuleBody(req.body);
    if (errors.length) throw badRequest('Validation failed', errors);

    const rule = new ProactiveRule({
      siteId: site._id,
      name: name.trim(),
      triggerCondition,
      audienceContext,
      action,
      frequencyControl,
      isActive: isActive === undefined ? true : Boolean(isActive)
    });
    await rule.save();
    res.status(201).json(rule);
  })
);

router.put(
  '/:id',
  auth,
  requireOrganization,
  checkPermission('manage_sites'),
  asyncHandler(async (req: Request, res: Response) => {
    const rule = await loadOwnedRule(req, req.params.id);

    const errors = validateRuleBody(req.body, { partial: true });
    if (errors.length) throw badRequest('Validation failed', errors);

    // siteId and metrics stay server-owned so a rule cannot be moved between
    // tenants and its counters cannot be forged.
    const assignable = [
      'name',
      'triggerCondition',
      'audienceContext',
      'action',
      'frequencyControl',
      'isActive'
    ];
    for (const key of assignable) {
      if (req.body[key] === undefined) continue;
      if (key === 'name') rule.name = String(req.body.name).trim();
      else if (key === 'isActive') rule.isActive = Boolean(req.body.isActive);
      else (rule as Record<string, any>)[key] = req.body[key];
    }
    await rule.save();
    res.json(rule);
  })
);

router.delete(
  '/:id',
  auth,
  requireOrganization,
  checkPermission('manage_sites'),
  asyncHandler(async (req: Request, res: Response) => {
    const rule = await loadOwnedRule(req, req.params.id);

    await ProactiveRule.findByIdAndDelete(rule._id);
    res.json({ message: 'Rule deleted' });
  })
);

export default router;
