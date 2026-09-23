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
import { slaTargetsFor } from '../domain';
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
  firstMessage: string
): Promise<IntakeResult> {
  const department = await routeToDepartment(site._id, firstMessage);

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
    requiredSkills: department?.requiredSkills || []
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

  await conversation.save();
  await recordNewConversation(department);

  // Best effort: when nobody is available the conversation stays unassigned and
  // an agent picks it up from the inbox.
  await autoAssignConversation(conversation._id, String(site.organizationId));

  const greeting = await postBusinessHoursGreeting(conversation, department);

  return { conversation, department, greeting };
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
