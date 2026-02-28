const AutomationRule = require('../models/AutomationRule');
const AutomationLog = require('../models/AutomationLog');

class AutomationEngine {
  constructor(io) {
    this.io = io;
  }

  /**
   * Evaluate a trigger event
   * @param {Object} data - { siteId, triggerType, payload, targetId }
   */
  async evaluateEvent(data) {
    try {
      const { siteId, triggerType, payload, targetId } = data;

      // 1. Fetch active rules for this trigger, ordered by priority desc
      const rules = await AutomationRule.find({
        siteId,
        isActive: true,
        triggerType
      }).sort({ priority: -1 });

      if (!rules.length) return false;

      // 2. Evaluate Rules
      for (const rule of rules) {
        const isMatch = await this.evaluateConditions(rule.conditions, rule.conditionOperator, payload);
        
        if (isMatch) {
            // Execute actions asynchronously or queue them
            this.executeActions(rule, data).catch(e => console.error('Automation action failed:', e));
            // Break on first match? Usually yes in priority systems, or allow continue. Let's break on first matched workflow for now to avoid conflicts.
            return true;
        }
      }
      return false;
    } catch (error) {
      console.error('AutomationEngine error:', error);
      return false;
    }
  }

  async evaluateConditions(conditions, operator, payload) {
    if (!conditions || !conditions.length) return true; // No conditions => trigger always

    const results = conditions.map(cond => this.checkCondition(cond, payload));

    if (operator === 'AND') {
        return results.every(res => res === true);
    } else {
        return results.some(res => res === true);
    }
  }

  checkCondition(condition, payload) {
    const { field, operator, value } = condition;
    
    // Resolve field from payload (e.g. 'message.content' -> payload.message?.content)
    const rawData = field.split('.').reduce((obj, key) => (obj && obj[key] !== 'undefined') ? obj[key] : undefined, payload);
    const dataVal = typeof rawData === 'string' ? rawData.toLowerCase() : rawData;
    const condVal = typeof value === 'string' ? value.toLowerCase() : value;

    if (operator === 'exists') return dataVal !== undefined && dataVal !== null;
    if (operator === 'not_exists') return dataVal === undefined || dataVal === null;

    if (dataVal === undefined || dataVal === null) return false;

    switch (operator) {
      case 'equals': return dataVal === condVal;
      case 'not_equals': return dataVal !== condVal;
      case 'contains': return typeof dataVal === 'string' && dataVal.includes(condVal);
      case 'not_contains': return typeof dataVal === 'string' && !dataVal.includes(condVal);
      case 'greater_than': return dataVal > condVal;
      case 'less_than': return dataVal < condVal;
      default: return false;
    }
  }

  async executeActions(rule, eventData) {
    const { targetId, siteId, payload } = eventData;
    const startMs = Date.now();
    let isSuccess = true;
    let errorDetails = '';

    try {
        for (const action of rule.actions) {
            await this.performAction(action, eventData);
        }
    } catch (error) {
        isSuccess = false;
        errorDetails = error.message;
        console.error(`Error executing rule ${rule._id}:`, error);
    } finally {
        // Log execution
        const log = new AutomationLog({
            ruleId: rule._id,
            siteId,
            triggerType: eventData.triggerType,
            targetId,
            status: isSuccess ? 'success' : 'failed',
            errorDetails,
            executionTimeMs: Date.now() - startMs
        });
        await log.save();

        // Update rule metrics
        await AutomationRule.findByIdAndUpdate(rule._id, {
            $inc: { 
                'metrics.executionsCount': 1,
                [`metrics.${isSuccess ? 'successCount' : 'failureCount'}`]: 1
            }
        });
    }
  }

  async performAction(action, eventData) {
      const { type, payload: actionPayload } = action;
      const { targetId } = eventData; // Usually Conversation ID
      const Conversation = require('../models/Conversation');
      const Message = require('../models/Message');

      const conversation = await Conversation.findById(targetId);
      if (!conversation && type !== 'webhook') return;

      switch(type) {
          case 'send_message':
              const botMessage = new Message({
                conversationId: targetId,
                senderType: 'bot',
                senderId: 'automation-bot',
                senderName: 'System',
                content: actionPayload.text,
                isRead: true
              });
              await botMessage.save();
              
              if (this.io) {
                 this.io.of('/widget').to(`conversation:${targetId}`).emit('new-message', { message: botMessage });
                 this.io.of('/admin').to(`site:${conversation.siteId}`).emit('new-message', { message: botMessage, conversation });
              }
              break;

          case 'assign_team':
             conversation.department = actionPayload.departmentId;
             await conversation.save();
             if (this.io) {
                 this.io.of('/admin').to(`site:${conversation.siteId}`).emit('conversation-department-changed', {
                    conversationId: targetId,
                    departmentId: actionPayload.departmentId,
                    conversation
                 });
             }
             break;

          case 'assign_agent':
             conversation.assignedAgent = actionPayload.agentId;
             conversation.status = 'assigned';
             await conversation.save();
             if (this.io) {
                 this.io.of('/admin').to(`site:${conversation.siteId}`).emit('conversation-assigned', {
                    conversationId: targetId,
                    agentId: actionPayload.agentId,
                    assignedBy: 'system'
                 });
             }
             break;

          case 'add_tag':
             if (!conversation.tags.includes(actionPayload.tag)) {
                conversation.tags.push(actionPayload.tag);
                await conversation.save();
             }
             break;

          case 'change_status':
             conversation.status = actionPayload.status; // e.g., 'resolved'
             await conversation.save();
             break;

          case 'internal_note':
              const noteMessage = new Message({
                conversationId: targetId,
                senderType: 'system',
                senderId: 'automation-system',
                senderName: 'System Note',
                content: actionPayload.note,
                messageType: 'internal_note',
                isRead: true
              });
              await noteMessage.save();
              if (this.io) {
                 this.io.of('/admin').to(`site:${conversation.siteId}`).emit('new-message', { message: noteMessage, conversation });
              }
              break;

          // case 'webhook':
          //    // Implement axios call
          //    break;
      }
  }
}

let engineInstance = null;

module.exports = {
  initialize: (io) => {
    engineInstance = new AutomationEngine(io);
    return engineInstance;
  },
  getEngine: () => engineInstance
};
