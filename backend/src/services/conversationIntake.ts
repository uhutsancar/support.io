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
import { ConversationQuotaError, crossesWarning, tryConsumeConversation } from './entitlements';
import { warnQuota } from './quotaWarning';
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
  /** 'assistant' when the site's FAQ assistant answers; the default keeps people first. */
  responseOwner: ResponseOwner = 'human'
): Promise<IntakeResult> {
  const department = await routeToDepartment(site._id, firstMessage);
  const verifiedUserId =
    typeof visitor.metadata?.verifiedUserId === 'string' ? visitor.metadata.verifiedUserId : null;

  // Numbered before the transaction, in a statement of its own. Inside it,
  // every opener on the platform waited on the one counter row until the
  // previous opener committed (scripts/loadtest.ts showed it). A number taken
  // for a conversation that is not created after all is simply skipped.
  const ticketNumber = await Conversation.nextTicketNumber();

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
    if (rows[0]) return { existingId: rows[0].id, conversation: null, quota: null };

    const conversation = buildConversation(site, visitor, department, responseOwner);
    conversation.ticketNumber = ticketNumber;
    conversation.ticketId = `#${String(ticketNumber).padStart(4, '0')}`;
    await conversation.save({ client });

    // Counted last: the organization's usage row stays locked until commit,
    // and every message of the organization counts on that row too. Over the
    // quota, the throw rolls the conversation back with the count.
    const quota = await tryConsumeConversation(String(site.organizationId), client);
    if (!quota.ok) throw new ConversationQuotaError();
    return { existingId: null, conversation, quota };
  });

  if (opened.existingId) {
    const existing = await Conversation.findById(opened.existingId);
    if (existing) return { conversation: existing, department, greeting: null, created: false };
  }
  const conversation = opened.conversation as Doc<ConversationDoc>;

  if (opened.quota && crossesWarning(opened.quota.count, opened.quota.limit)) {
    // Once a month, to the owner; never on the visitor's path.
    void warnQuota(String(site.organizationId), opened.quota.count, opened.quota.limit);
  }

  await recordNewConversation(department);

  // Best effort: when nobody is available the conversation stays unassigned and
  // an agent picks it up from the inbox.
  await autoAssignConversation(conversation._id, String(site.organizationId));

  // With the assistant answering there is someone here now; the closed-hours
  // note is given when it hands over instead (services/assistant).
  const greeting =
    responseOwner === 'assistant'
      ? null
      : await postBusinessHoursGreeting(conversation, department);

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
