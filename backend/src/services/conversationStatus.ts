// Moving a conversation to a new status, with everything that follows from
// it: the assigned agent's load, the resolution figures, the visitor's
// end-of-chat card (and Slack, Telegram, webhooks), the panel's live update
// and the audit entry. The panel's routes (single and bulk) and the public
// API (PRD-12) all come here, so none of them does it differently.

import events from '../events';
import { AdminNotifier } from '../realtime';
import { updateAgentLoad } from './autoAssignment';
import { refreshSla } from './conversationSla';
import { recordAgentResolution, recordResolution } from './departmentStats';
import { announceConversationEnded } from './conversationEnd';
import { isActiveConversationStatus } from '../domain';
import type { Server } from 'socket.io';
import type { Doc } from '../db/model';
import type { ConversationDoc } from '../models/Conversation';

/** Who made the change, for the audit trail. */
export interface StatusActor {
  organizationId: string;
  /** Null for the public API: the key is named in the metadata instead. */
  userId: string | null;
  ip?: string;
  ua?: string;
  via?: string;
}

const AGENT_FIELDS = 'name avatar status';

export async function setConversationStatus(
  io: Server | null,
  conversation: Doc<ConversationDoc>,
  status: ConversationDoc['status'],
  actor: StatusActor
): Promise<Doc<ConversationDoc>> {
  await conversation.populate('department');

  const previousStatus = conversation.status;
  const wasActive = isActiveConversationStatus(previousStatus);
  const willBeActive = isActiveConversationStatus(status);

  // An agent's load follows the conversation in and out of the active set.
  if (conversation.assignedAgent && wasActive !== willBeActive) {
    await updateAgentLoad(conversation.assignedAgent, willBeActive ? 1 : -1);
  }

  conversation.status = status;

  if (status === 'closed') {
    conversation.closedAt = new Date();
  } else if (status === 'resolved') {
    conversation.resolvedAt = new Date();
    refreshSla(conversation);
    if (wasActive) {
      // The same rollup the socket handler performs; see
      // services/departmentStats.ts for why it is not written out twice.
      await recordResolution(conversation);
      await recordAgentResolution(conversation.assignedAgent);
    }
  }

  await conversation.save();
  await conversation.populate('assignedAgent', AGENT_FIELDS);

  const notifier = io ? new AdminNotifier(io) : null;
  notifier?.conversationUpdated(conversation, conversation);
  if (status === 'resolved') notifier?.conversationResolved(conversation, conversation);
  if (wasActive && (status === 'resolved' || status === 'closed')) {
    await announceConversationEnded(io, conversation);
  }

  emitStatusEvent(actor, conversation, previousStatus, status);
  return conversation;
}

/**
 * Records a close or a reopen in the audit trail.
 *
 * Isolated from the change it follows: the status change is already
 * committed, so a failure here must not turn a successful write into an
 * error. The reason is logged rather than discarded.
 */
function emitStatusEvent(
  actor: StatusActor,
  conversation: Doc<ConversationDoc>,
  previousStatus: string,
  status: string
): void {
  const name =
    status === 'closed' ? 'ticket.closed' : previousStatus === 'closed' ? 'ticket.reopened' : null;
  if (!name) return;

  try {
    events.emit(name, {
      organizationId: actor.organizationId,
      userId: actor.userId,
      entityId: conversation._id,
      metadata: { previousStatus, ...(actor.via ? { via: actor.via } : {}) },
      ip: actor.ip,
      ua: actor.ua
    });
  } catch (error) {
    console.error(`[conversations] could not emit ${name}`, error);
  }
}
