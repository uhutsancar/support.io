const ProactiveRule = require('../models/ProactiveRule');
const ProactiveTriggerLog = require('../models/ProactiveTriggerLog');
const EventLog = require('../models/EventLog');

class ProactiveEngine {
  constructor(io) {
    this.io = io;
    this._recentTriggers = new Map(); // Memory buffer to prevent race conditions during DB saves
  }

  /**
   * Evaluate a single event against proactive rules
   * @param {Object} eventData - { siteId, visitorId, sessionId, eventType, url, timeOnPage, scrollDepth, customEventName, audienceContext }
   */
  async evaluateEvent(eventData) {
    try {
      const { siteId, visitorId, eventType } = eventData;

      // Log the event asynchronously
      this.logEvent(eventData).catch(err => console.error('Failed to log event', err));

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
           const lastFire = this._recentTriggers.get(cacheKey);
           
           if (lastFire === 'PROCESSING') {
              continue; // Another event is currently evaluating the DB for this rule
           }
           
           // Use <= cooldownMs to ensure even 0ms cooldown is respected effectively in high-speed bursts
           if (lastFire === -1 || (Date.now() - lastFire <= cooldownMs)) {
              continue; // Blocked in memory by cooldown or permanent lock
           }
        }

        // 🟢 IMMEDIATE LOCK: Set a 'PROCESSING' flag in memory BEFORE DB check
        // This prevents a second event that yields a millisecond later from bypassing the check
        this._recentTriggers.set(cacheKey, 'PROCESSING');

        const canTrigger = await this.checkFrequencyControl(rule, visitorId);
        if (canTrigger) {
          // Confirm permanent lock (-1 for once-per-visitor, timestamp for cooldown)
          this._recentTriggers.set(cacheKey, frequencyControl?.triggerOncePerVisitor ? -1 : Date.now());

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

  async logEvent(eventData) {
    const log = new EventLog({
      siteId: eventData.siteId,
      visitorId: eventData.visitorId,
      sessionId: eventData.sessionId,
      eventType: eventData.eventType,
      url: eventData.url,
      referrer: eventData.audienceContext?.referrer,
      userAgent: eventData.audienceContext?.userAgent,
      eventData: eventData.payload || {}
    });
    await log.save();
  }

  async checkConditions(rule, eventData) {
    const { triggerCondition, audienceContext: ruleAudience } = rule;
    
    // Check URL Match
    if (triggerCondition.urlMatch !== 'any' && eventData.url) {
      const dbUrl = triggerCondition.urlValue || '';
      const currentUrl = eventData.url || '';
      
      if (triggerCondition.urlMatch === 'exact' && currentUrl !== dbUrl) return false;
      if (triggerCondition.urlMatch === 'contains' && !currentUrl.includes(dbUrl)) return false;
      if (triggerCondition.urlMatch === 'regex' && !(new RegExp(dbUrl, 'i').test(currentUrl))) return false;
    }

    // Check specific event metrics
    if (triggerCondition.eventType === 'time_on_page' && eventData.timeOnPage < triggerCondition.timeThresholdSeconds) return false;
    if (triggerCondition.eventType === 'inactivity' && eventData.timeOnPage < triggerCondition.timeThresholdSeconds) return false; // Reusing timeOnPage for inactivity duration for simplicity
    if (triggerCondition.eventType === 'scroll_depth' && eventData.scrollDepth < triggerCondition.scrollPercentage) return false;
    if (triggerCondition.eventType === 'custom_event' && eventData.customEventName !== triggerCondition.customEventName) return false;

    // Check Audience Context
    const currentAudience = eventData.audienceContext || {};
    if (ruleAudience.deviceType !== 'all') {
      const isMobile = /Mobi|Android/i.test(currentAudience.userAgent || '');
      const currentDevice = isMobile ? 'mobile' : 'desktop';
      if (ruleAudience.deviceType !== currentDevice) return false;
    }

    if (ruleAudience.country && currentAudience.country && ruleAudience.country !== currentAudience.country) {
       return false;
    }

    return true; // All conditions met
  }

  async checkFrequencyControl(rule, visitorId) {
    const { frequencyControl } = rule;
    const cooldownMs = (frequencyControl.cooldownMinutes || 0) * 60 * 1000;

    // Pure DB check — memory caching is handled by evaluateEvent
    const existingLogs = await ProactiveTriggerLog.find({ ruleId: rule._id, visitorId }).sort({ triggeredAt: -1 });

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

  async executeAction(rule, eventData) {
    const { action, siteId } = rule;
    const { visitorId, sessionId } = eventData;

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
        const Conversation = require('../models/Conversation');
        let conversation = await Conversation.findOne({ siteId, visitorId, status: { $in: ['open', 'assigned', 'pending'] } });

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
           if (!conversation.tags.includes(action.tag)) {
              conversation.tags.push(action.tag);
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

let engineInstance = null;

module.exports = {
  initialize: (io) => {
    engineInstance = new ProactiveEngine(io);
    return engineInstance;
  },
  getEngine: () => engineInstance
};
