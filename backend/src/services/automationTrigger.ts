// Handing a conversation event to the automation rule engine.
//
// Deliberately fire-and-forget: a customer's rule must never delay delivery of
// a visitor's message, and a rule that throws must not break the chat. The
// engine is null until server.ts initialises it, so a deployment that never
// calls `initialize` is a silent no-op rather than a crash.

import { getEngine } from './automationEngine';
import type { Doc } from '../db/model';
import type { ConversationDoc } from '../models/Conversation';
import type { MessageDoc } from '../models/Message';

export type AutomationTrigger =
  'conversation_created' | 'message_received' | 'visitor_event' | 'schedule';

interface TriggerContext {
  content?: string;
  message?: Doc<MessageDoc> | null;
}

/**
 * Evaluates the site's rules against what just happened.
 *
 * The field names in the payload are the ones the rule editor's condition
 * builder offers (`message.content`, `visitor.country`, `conversation.status`).
 * Renaming one here silently breaks every rule a customer has already saved, so
 * they are part of the product's contract, not an implementation detail.
 */
export function runAutomation(
  triggerType: AutomationTrigger,
  conversation: Doc<ConversationDoc>,
  { content = '', message = null }: TriggerContext = {}
): void {
  const engine = getEngine();
  if (!engine) return;

  const payload = {
    message: message
      ? {
          content,
          senderType: message.senderType,
          senderName: message.senderName,
          messageType: message.messageType
        }
      : { content },
    visitor: {
      id: conversation.visitorId,
      name: conversation.visitorName,
      email: conversation.visitorEmail,
      country: conversation.metadata?.country || null,
      currentPage: conversation.currentPage
    },
    conversation: {
      status: conversation.status,
      priority: conversation.priority,
      channel: conversation.channel,
      tags: conversation.tags || []
    }
  };

  engine
    .evaluateEvent({
      siteId: conversation.siteId,
      organizationId: conversation.organizationId,
      triggerType,
      targetId: conversation._id,
      payload
    })
    .catch((error) => {
      // The engine logs its own failures; this catch exists so an unhandled
      // rejection cannot take the process down mid-conversation.
      console.error('[automation] rule evaluation failed for', conversation._id, error);
    });
}
