// Opening a new conversation from the widget.
//
// This was roughly a hundred lines inside the socket handler's `send-message`,
// wedged between validating the message and saving it: department routing, SLA
// seeding, business-hours detection, department counters, auto-assignment and
// the bot greeting, all in one nesting level. The handler could not be read
// without reading all of it, and none of it was reachable from anywhere else —
// so the HTTP side, which creates conversations too, had its own partial copy
// of the SLA seeding.
//
// Starting a conversation is a domain operation, not a transport detail. It
// lives here, and the socket handler asks for it in one line.

import Conversation from '../models/Conversation';
import Message from '../models/Message';
import { withTransaction } from '../db/pool';
import { ACTIVE_CONVERSATION_STATUSES, slaTargetsFor } from '../domain';
import type { ResponseOwner } from '../domain';
import { routeToDepartment } from './departmentRouting';
import {
  isWithinBusinessHours,
  getBusinessHoursMessage,
  shouldCalculateSLA
} from './businessHours';
import { autoAssignConversation } from './autoAssignment';
import { recordNewConversation } from './departmentStats';
import { refreshSla } from './conversationSla';
import type { Doc } from '../db/model';
import type { ConversationDoc } from '../models/Conversation';
import type { DepartmentDoc } from '../models/Department';
import type { MessageDoc } from '../models/Message';
import type { SiteDoc } from '../models/Site';
import type { VisitorMetadata } from '../socket/types';

/** Who is starting the conversation, as the widget socket knows them. */
export interface VisitorIdentity {
  visitorId: string;
  visitorName: string;
  visitorEmail: string | null;
  currentPage: string;
  metadata?: VisitorMetadata;
}

export interface IntakeResult {
  conversation: Doc<ConversationDoc>;
  department: Doc<DepartmentDoc> | null;
  /** Posted by the bot when the department is closed right now, else null. */
  greeting: Doc<MessageDoc> | null;
  /**
   * False when another first message of the same visitor — a second tab, a
   * double send — opened the conversation a moment earlier; this call then
   * hands back that one instead of opening a second.
   */
  created: boolean;
}

/** When outside business hours, the clock resumes at this hour tomorrow. */
const NEXT_BUSINESS_MORNING_HOUR = 9;

function nextBusinessMorning(): Date {
  const at = new Date();
  at.setDate(at.getDate() + 1);
  at.setHours(NEXT_BUSINESS_MORNING_HOUR, 0, 0, 0);
  return at;
}

/**
 * Creates the conversation behind a visitor's first message.
 *
 * The caller has already resolved and authorised the site. On return the
 * conversation is saved, counted, and assigned if an agent was available.
 */
export async function openConversation(
  site: Doc<SiteDoc>,
  visitor: VisitorIdentity,
  firstMessage: string,
  /** 'ai' when the site's assistant answers; the default keeps people first. */
  responseOwner: ResponseOwner = 'human'
): Promise<IntakeResult> {
  const department = await routeToDepartment(site._id, firstMessage);
  const verifiedUserId =
    typeof visitor.metadata?.verifiedUserId === 'string' ? visitor.metadata.verifiedUserId : null;

  // One visitor, one running conversation per identity — even when two first
  // messages arrive at once (two tabs, a double send). A transaction-scoped
  // advisory lock on the visitor serialises the openers; whoever comes second
  // finds the conversation the first committed and returns it.
  const opened = await withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      `conversation-intake:${site._id}:${visitor.visitorId}:${verifiedUserId ?? ''}`
    ]);

    const { rows } = await client.query<{ id: string }>(
      `SELECT id FROM conversations
        WHERE site_id = $1 AND visitor_id = $2 AND status = ANY($3)
          AND (metadata->>'verifiedUserId' IS NULL OR metadata->>'verifiedUserId' = $4)
        ORDER BY last_message_at DESC
        LIMIT 1`,
      [site._id, visitor.visitorId, [...ACTIVE_CONVERSATION_STATUSES], verifiedUserId ?? '']
    );
    if (rows[0]) return { existingId: rows[0].id, conversation: null };

    const conversation = buildConversation(site, visitor, department, responseOwner);
    // Numbered on this same connection: the model's save hook would otherwise
    // take a second pool connection while this one holds the lock, and under
    // load every opener would end up waiting for a connection none can free.
    const ticket = await client.query<{ seq: string }>(
      `INSERT INTO counters (id, seq) VALUES ('ticketNumber', 1)
       ON CONFLICT (id) DO UPDATE SET seq = counters.seq + 1
       RETURNING seq`
    );
    conversation.ticketNumber = Number(ticket.rows[0].seq);
    conversation.ticketId = `#${String(conversation.ticketNumber).padStart(4, '0')}`;
    await conversation.save({ client });
    return { existingId: null, conversation };
  });

  if (opened.existingId) {
    const existing = await Conversation.findById(opened.existingId);
    if (existing) return { conversation: existing, department, greeting: null, created: false };
  }
  const conversation = opened.conversation as Doc<ConversationDoc>;

  await recordNewConversation(department);

  // Best effort: when nobody is available the conversation stays unassigned and
  // an agent picks it up from the inbox.
  await autoAssignConversation(conversation._id, String(site.organizationId));

  // With the assistant answering there is someone here now; the closed-hours
  // note is given when it hands over instead (services/ai/autoReply.ts).
  const greeting =
    responseOwner === 'ai' ? null : await postBusinessHoursGreeting(conversation, department);

  return { conversation, department, greeting, created: true };
}

/** The new conversation's row, SLA clocks set, not yet saved. */
function buildConversation(
  site: Doc<SiteDoc>,
  visitor: VisitorIdentity,
  department: Doc<DepartmentDoc> | null,
  responseOwner: ResponseOwner
): Doc<ConversationDoc> {

  const conversation = new Conversation({
    siteId: site._id,
    organizationId: site.organizationId,
    visitorId: visitor.visitorId,
    visitorName: visitor.visitorName,
    visitorEmail: visitor.visitorEmail,
    currentPage: visitor.currentPage,
    metadata: visitor.metadata,
    department: department?._id ?? null,
    status: 'open',
    channel: 'web-chat',
    priority: 'normal',
    requiredSkills: department?.requiredSkills || [],
    responseOwner
  });

  // The department's policy wins where it has one; otherwise the product
  // defaults apply. Both this path and the HTTP one now read the same table.
  Object.assign(conversation.sla, slaTargetsFor(conversation.priority, department?.sla));

  if (shouldCalculateSLA(department)) {
    if (!conversation.createdAt) conversation.createdAt = new Date();
    refreshSla(conversation);
  } else {
    // The department only counts business hours and is closed: park the clock
    // rather than letting it run overnight and report a breach by morning.
    conversation.nextSlaCheckAt = nextBusinessMorning();
  }

  return conversation;
}

/**
 * Tells the visitor when to expect an answer, if the department is closed.
 *
 * Returned rather than broadcast: delivery belongs to the transport that called
 * this, which knows which rooms to reach.
 */
async function postBusinessHoursGreeting(
  conversation: Doc<ConversationDoc>,
  department: Doc<DepartmentDoc> | null
): Promise<Doc<MessageDoc> | null> {
  if (!department || isWithinBusinessHours(department)) return null;

  const text = getBusinessHoursMessage(department);
  if (!text) return null;

  return Message.create({
    conversationId: conversation._id,
    senderType: 'bot',
    senderId: 'business-hours-bot',
    senderName: 'Support Bot',
    content: text,
    isRead: true
  });
}
