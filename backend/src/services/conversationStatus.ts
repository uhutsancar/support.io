// Moving a conversation to a new status, with everything that follows from
// it: the assigned agent's load, the resolution figures, the visitor's
// end-of-chat card (and Slack, Telegram, webhooks), the panel's live update
// and the audit entry. The panel's routes (single and bulk) and the public
// API (PRD-12) all come here, so none of them does it differently.

import events from '../events';
import { AdminNotifier } from '../realtime';
import { refreshSla } from './conversationSla';
import { recordAgentResolution, recordResolution } from './departmentStats';
import { announceConversationEnded } from './conversationEnd';
import Conversation from '../models/Conversation';
import { transitionConversationStatusAtomically } from './conversationAssignment';
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

  const transition = await transitionConversationStatusAtomically(
    conversation._id,
    actor.organizationId,
    status
  );
  if (transition.reason) {
    throw new Error(`Conversation status transition failed: ${transition.reason}`);
  }
  const previousStatus = transition.previousStatus;
  const wasActive = ['open', 'assigned', 'pending', 'unassigned'].includes(previousStatus);
  const updated = await Conversation.findById(conversation._id).populate('department');
  if (!updated) throw new Error('Conversation disappeared during status transition');

  if (status === 'resolved') {
    refreshSla(updated);
    await updated.save();
    if (transition.changed && wasActive) {
      // The same rollup the socket handler performs; see
      // services/departmentStats.ts for why it is not written out twice.
      await recordResolution(updated);
      await recordAgentResolution(updated.assignedAgent);
    }
  }
  await updated.populate('assignedAgent', AGENT_FIELDS);

  const notifier = io ? new AdminNotifier(io) : null;
  notifier?.conversationUpdated(updated, updated);
  if (status === 'resolved') notifier?.conversationResolved(updated, updated);
  if (wasActive && (status === 'resolved' || status === 'closed')) {
    await announceConversationEnded(io, updated);
  }

  emitStatusEvent(actor, updated, previousStatus, status);
  return updated;
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
