import AutomationRule from '../models/AutomationRule';
import AutomationLog from '../models/AutomationLog';
import events from '../events';
import Conversation from '../models/Conversation';
import type { ConversationStatus } from '../models/Conversation';
import Message from '../models/Message';
import type { Server } from 'socket.io';
import type { Doc } from '../db/model';
import type { AutomationRuleDoc } from '../models/AutomationRule';
import type {
  AutomationAction,
  AutomationCondition,
  AutomationEvent
} from '../types/domain';

class AutomationEngine {
  io: Server;

  constructor(io: Server) {
    this.io = io;
  }

  /** Evaluates a trigger event against the site's active rules. */
  async evaluateEvent(data: AutomationEvent): Promise<boolean> {
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

  async evaluateConditions(
    conditions: AutomationCondition[] | undefined,
    operator: string,
    payload: unknown
  ): Promise<boolean> {
    if (!conditions || !conditions.length) return true; // No conditions => trigger always

    const results = conditions.map(cond => this.checkCondition(cond, payload));

    if (operator === 'AND') {
        return results.every(res => res === true);
    } else {
        return results.some(res => res === true);
    }
  }

  checkCondition(condition: AutomationCondition, payload: unknown): boolean {
    const { field, operator, value } = condition;

    // Resolve field from payload (e.g. 'message.content' -> payload.message?.content)
    const rawData = field.split('.').reduce<any>(
      (obj, key) => (obj === null || obj === undefined ? undefined : obj[key]),
      payload
    );
    const dataVal = typeof rawData === 'string' ? rawData.toLowerCase() : rawData;
    const condVal = typeof value === 'string' ? value.toLowerCase() : value;

    if (operator === 'exists') return dataVal !== undefined && dataVal !== null;
    if (operator === 'not_exists') return dataVal === undefined || dataVal === null;

    if (dataVal === undefined || dataVal === null) return false;

    switch (operator) {
      case 'equals': return dataVal === condVal;
      case 'not_equals': return dataVal !== condVal;
      case 'contains': return typeof dataVal === 'string' && dataVal.includes(condVal as string);
      case 'not_contains': return typeof dataVal === 'string' && !dataVal.includes(condVal as string);
      // Both sides are coerced so "10" > "9" does not answer false the way a
      // lexicographic string comparison would.
      case 'greater_than': return Number(dataVal) > Number(condVal);
      case 'less_than': return Number(dataVal) < Number(condVal);
      default: return false;
    }
  }

  async executeActions(rule: Doc<AutomationRuleDoc>, eventData: AutomationEvent): Promise<void> {
    const { targetId, siteId, organizationId } = eventData;
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
        // Counters first, log second. The log row is the receipt a reader looks
        // for; written the other way round there was a window in which the
        // receipt existed but the rule's counters did not include it yet, so
        // the panel (and anything waiting on the log) could read a stale count.
        await AutomationRule.findByIdAndUpdate(rule._id, {
            $inc: {
                'metrics.executionsCount': 1,
                [`metrics.${isSuccess ? 'successCount' : 'failureCount'}`]: 1
            }
        });

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

        // Surfaces the run in the admin audit trail ("Automation added VIP tag").
        // Emitting is best effort: a failed audit write must not turn a rule that
        // already ran into a reported failure.
        if (organizationId) {
          try {
            events.emit('automation.executed', {
              organizationId,
              entityId: targetId,
              metadata: {
                ruleId: rule._id,
                ruleName: rule.name,
                triggerType: eventData.triggerType,
                status: isSuccess ? 'success' : 'failed',
                actions: (rule.actions || []).map((a: AutomationAction) => a.type),
                errorDetails: errorDetails || undefined
              }
            });
          } catch (e) {
          }
        }
    }
  }

  async performAction(action: AutomationAction, eventData: AutomationEvent): Promise<void> {
      const { type, payload: actionPayload = {} } = action;
      const { targetId } = eventData; // Usually Conversation ID

      const conversation = await Conversation.findById(targetId);
      // Every action that is implemented below needs the conversation; the one
      // that would not (webhook) is still commented out, so a missing
      // conversation means there is nothing to do either way.
      if (!conversation) return;

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
             if (!conversation.tags.includes(actionPayload.tag as string)) {
                conversation.tags.push(actionPayload.tag as string);
                await conversation.save();
             }
             break;

          case 'change_status':
             conversation.status = actionPayload.status as ConversationStatus; // e.g., 'resolved'
             await conversation.save();
             break;

          case 'internal_note':
              // Internal notes belong to conversation_internal_notes, not to the
              // message transcript: a note must never reach the visitor, and the
              // messages table rejects the sender/message types a note would need.
              conversation.internalNotes.push({
                userId: null,
                note: actionPayload.note as string,
                createdAt: new Date()
              });
              await conversation.save();
              if (this.io) {
                 this.io.of('/admin').to(`site:${conversation.siteId}`).emit('conversation-note-added', {
                    conversationId: targetId,
                    note: actionPayload.note,
                    author: 'automation'
                 });
              }
              break;

          // case 'webhook':
          //    // Implement axios call
          //    break;
      }
  }
}

let engineInstance: AutomationEngine | null = null;

/** Starts the engine for this process and hands it the socket server. */
export function initialize(io: Server): AutomationEngine {
  engineInstance = new AutomationEngine(io);
  return engineInstance;
}

/** The running engine, or null when the process has not started one. */
export function getEngine(): AutomationEngine | null {
  return engineInstance;
}
