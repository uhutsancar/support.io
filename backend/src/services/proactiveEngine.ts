/** What the widget reports, and what a rule is matched against. */
import ProactiveRule from '../models/ProactiveRule';
import ProactiveTriggerLog from '../models/ProactiveTriggerLog';
import EventLog from '../models/EventLog';
import Conversation from '../models/Conversation';
import type { Server } from 'socket.io';
import type { Doc } from '../db/model';
import type { ProactiveRuleDoc } from '../models/ProactiveRule';
import type { VisitorEventType } from '../models/EventLog';

/**
 * One visitor event, as the tracking endpoint reports it.
 *
 * The nullable members say "the widget did not report this", which is a real
 * state: a page view with no referrer, an event with no URL. The route has
 * always sent `null` for those; the interface said `undefined` and only
 * type-checked because the route built the object from an untyped `any`. The
 * numeric members are read through comparisons below, so they are defaulted
 * rather than cast.
 */
export interface ProactiveEventData {
  siteId: string;
  visitorId: string;
  sessionId?: string | null;
  eventType: VisitorEventType | string;
  url?: string | null;
  timeOnPage?: number | null;
  scrollDepth?: number | null;
  customEventName?: string | null;
  audienceContext?: {
    referrer?: string | null;
    userAgent?: string | null;
    deviceType?: string | null;
    country?: string | null;
    [extra: string]: unknown;
  };
  payload?: Record<string, unknown> | null;
}

/**
 * The in-memory lock for one rule/visitor pair:
 *   'PROCESSING' — another event is checking the database right now
 *   -1           — fired once and never again for this visitor
 *   number       — the timestamp of the last firing, for the cooldown
 */
type TriggerLock = 'PROCESSING' | number;

class ProactiveEngine {
  io: Server;
  /** Memory buffer to prevent race conditions during DB saves. */
  _recentTriggers: Map<string, TriggerLock>;

  constructor(io: Server) {
    this.io = io;
    this._recentTriggers = new Map();
  }

  /** Evaluates a single visitor event against the site's proactive rules. */
  async evaluateEvent(eventData: ProactiveEventData): Promise<boolean> {
    try {
      const { siteId, visitorId, eventType } = eventData;

      // Log the event asynchronously
      this.logEvent(eventData).catch((err) => console.error('Failed to log event', err));

      // 1. Fetch active rules for this site and eventType
      const rules = await ProactiveRule.find({
        siteId,
        isActive: true,
        'triggerCondition.eventType': eventType
      });

      if (!rules.length) return false;

      // 2. Evaluate rules
      for (const rule of rules) {
        const isMatch = await this.checkConditions(rule, eventData);
        if (!isMatch) continue;

        const cacheKey = `${rule._id}-${visitorId}`;
        const { frequencyControl } = rule;
        const cooldownMs = (frequencyControl?.cooldownMinutes || 0) * 60 * 1000;

        // 🟢 HIGH PERFORMANCE LOCK: Check memory FIRST to block parallel execution
        if (this._recentTriggers.has(cacheKey)) {
          const lastFire = this._recentTriggers.get(cacheKey) as TriggerLock;

          if (lastFire === 'PROCESSING') {
            continue; // Another event is currently evaluating the DB for this rule
          }

          // Use <= cooldownMs to ensure even 0ms cooldown is respected effectively in high-speed bursts
          if (lastFire === -1 || Date.now() - lastFire <= cooldownMs) {
            continue; // Blocked in memory by cooldown or permanent lock
          }
        }

        // 🟢 IMMEDIATE LOCK: Set a 'PROCESSING' flag in memory BEFORE DB check
        // This prevents a second event that yields a millisecond later from bypassing the check
        this._recentTriggers.set(cacheKey, 'PROCESSING');

        const canTrigger = await this.checkFrequencyControl(rule, visitorId);
        if (canTrigger) {
          // Confirm permanent lock (-1 for once-per-visitor, timestamp for cooldown)
          this._recentTriggers.set(
            cacheKey,
            frequencyControl?.triggerOncePerVisitor ? -1 : Date.now()
          );

          await this.executeAction(rule, eventData);
          return true; // Break after first rule fires
        } else {
          // If DB check fails, we remove the processing lock so it can be re-evaluated later
          this._recentTriggers.delete(cacheKey);
        }
      }

      return false;
    } catch (error) {
      console.error('ProactiveEngine error:', error);
      return false;
    }
  }

  async logEvent(eventData: ProactiveEventData): Promise<void> {
    const log = new EventLog({
      siteId: eventData.siteId,
      visitorId: eventData.visitorId,
      sessionId: eventData.sessionId,
      eventType: eventData.eventType as VisitorEventType,
      url: eventData.url,
      referrer: eventData.audienceContext?.referrer,
      userAgent: eventData.audienceContext?.userAgent,
      eventData: eventData.payload || {}
    });
    await log.save();
  }

  async checkConditions(
    rule: Doc<ProactiveRuleDoc>,
    eventData: ProactiveEventData
  ): Promise<boolean> {
    const { triggerCondition, audienceContext: ruleAudience } = rule;

    // Check URL Match
    if (triggerCondition.urlMatch !== 'any' && eventData.url) {
      const dbUrl = triggerCondition.urlValue || '';
      const currentUrl = eventData.url || '';

      if (triggerCondition.urlMatch === 'exact' && currentUrl !== dbUrl) return false;
      if (triggerCondition.urlMatch === 'contains' && !currentUrl.includes(dbUrl)) return false;
      if (triggerCondition.urlMatch === 'regex' && !new RegExp(dbUrl, 'i').test(currentUrl))
        return false;
    }

    // Check specific event metrics
    if (
      triggerCondition.eventType === 'time_on_page' &&
      (eventData.timeOnPage ?? 0) < triggerCondition.timeThresholdSeconds
    )
      return false;
    // Inactivity reuses timeOnPage as the idle duration the widget reports.
    if (
      triggerCondition.eventType === 'inactivity' &&
      (eventData.timeOnPage ?? 0) < triggerCondition.timeThresholdSeconds
    )
      return false;
    if (
      triggerCondition.eventType === 'scroll_depth' &&
      (eventData.scrollDepth ?? 0) < triggerCondition.scrollPercentage
    )
      return false;
    if (
      triggerCondition.eventType === 'custom_event' &&
      eventData.customEventName !== triggerCondition.customEventName
    )
      return false;

    // Check Audience Context
    const currentAudience = eventData.audienceContext || {};
    if (ruleAudience.deviceType !== 'all') {
      const isMobile = /Mobi|Android/i.test(currentAudience.userAgent || '');
      const currentDevice = isMobile ? 'mobile' : 'desktop';
      if (ruleAudience.deviceType !== currentDevice) return false;
    }

    if (
      ruleAudience.country &&
      currentAudience.country &&
      ruleAudience.country !== currentAudience.country
    ) {
      return false;
    }

    return true; // All conditions met
  }

  async checkFrequencyControl(rule: Doc<ProactiveRuleDoc>, visitorId: string): Promise<boolean> {
    const { frequencyControl } = rule;
    const cooldownMs = (frequencyControl.cooldownMinutes || 0) * 60 * 1000;

    // Pure DB check — memory caching is handled by evaluateEvent
    const existingLogs = await ProactiveTriggerLog.find({ ruleId: rule._id, visitorId }).sort({
      triggeredAt: -1
    });

    if (existingLogs.length > 0) {
      if (frequencyControl.triggerOncePerVisitor) {
        return false; // Already fired once
      }

      const lastLog = existingLogs[0];
      const timeSinceLastTrigger = Date.now() - new Date(lastLog.triggeredAt).getTime();
      if (timeSinceLastTrigger < cooldownMs) {
        return false; // Still in cooldown
      }
    }

    return true; // OK to trigger
  }

  async executeAction(
    rule: Doc<ProactiveRuleDoc>,
    eventData: ProactiveEventData
  ): Promise<boolean> {
    const { action, siteId } = rule;
    const { visitorId } = eventData;

    try {
      // Create Trigger Log
      const log = new ProactiveTriggerLog({
        ruleId: rule._id,
        siteId,
        visitorId
      });
      await log.save();

      // Update Rule Metrics
      await ProactiveRule.findByIdAndUpdate(rule._id, { $inc: { 'metrics.triggersCount': 1 } });

      // Emit socket event to the widget
      if (this.io) {
        const widgetNs = this.io.of('/widget');

        // Find if this visitor has an active conversation to send the message to
        const conversation = await Conversation.findOne({
          siteId,
          visitorId,
          status: { $in: ['open', 'assigned', 'pending'] }
        });

        if (action.type === 'send_message' || action.type === 'open_popup') {
          if (!conversation && action.type === 'send_message') {
            // Create a dummy/bot message to trigger the popup without creating a full conversation yet,
            // or just emit raw event
          }

          // Target visitor-specific room. DO NOT double-emit to session room as it causes duplicates.
          widgetNs.to(`site:${siteId}:visitor:${visitorId}`).emit('proactive-trigger', {
            actionType: action.type,
            messageContent: action.messageContent,
            ruleId: rule._id
          });
        }

        if (action.type === 'add_tag' && conversation) {
          if (!conversation.tags.includes(action.tag as string)) {
            conversation.tags.push(action.tag as string);
            await conversation.save();
          }
        }
      }
      return true;
    } catch (error) {
      console.error('Proactive executeAction error:', error);
      return false;
    }
  }
}

let engineInstance: ProactiveEngine | null = null;

/** Starts the engine for this process and hands it the socket server. */
export function initialize(io: Server): ProactiveEngine {
  engineInstance = new ProactiveEngine(io);
  return engineInstance;
}

/** The running engine, or null when the process has not started one. */
export function getEngine(): ProactiveEngine | null {
  return engineInstance;
}
