// Whether an agent is at their desk.
//
// This matters beyond the little coloured dot: presence drives auto-assignment
// and what the widget tells a visitor about expected response times, so a
// status that fails to save is a routing bug, not a cosmetic one.

import Conversation from '../../models/Conversation';
import Team from '../../models/Team';
import User from '../../models/User';
import { checkAndReassign } from '../../services/autoAssignment';
import { PRESENCE_STATUSES, isAwayPresence, isPresenceStatus } from '../../domain';
import { userRoom } from '../../realtime/rooms';
import type { SocketContext } from '../context';
import type { AdminSocket, UpdateStatusPayload } from '../types';

/** The room every socket of one organization shares, for org-wide broadcasts. */
const orgRoom = (organizationId: unknown): string => `org:${String(organizationId)}`;

export function installAdminPresenceHandlers(ctx: SocketContext, socket: AdminSocket): void {
  socket.on(
    'update-status',
    ctx.guard(socket, async (data: UpdateStatusPayload) => {
      const { status } = data || {};
      if (!isPresenceStatus(status)) {
        socket.emit('error', {
          message: `status must be one of: ${PRESENCE_STATUSES.join(', ')}`
        });
        return;
      }
      if (!socket.userId) return;

      // The account lives in one of two tables: the organization owner and any
      // account that was not invited sit in `users`, invited agents in `teams`.
      // An earlier version wrote only to `teams`, so an owner changing their
      // status saw it silently discarded and visitors kept seeing the old value.
      const scope = { organizationId: socket.organizationId, isActive: true };
      const updated =
        (await Team.findOneAndUpdate(
          { _id: socket.userId, ...scope },
          { status },
          { new: true }
        )) ??
        (await User.findOneAndUpdate({ _id: socket.userId, ...scope }, { status }, { new: true }));
      if (!updated) return;

      // Stepping away hands back whatever they were holding, so a visitor is not
      // left waiting on somebody who has gone.
      if (isAwayPresence(status)) {
        await releaseAssignments(socket);
      }

      const announcement = { userId: socket.userId, status };
      if (socket.siteId) {
        ctx.toAdminSite(socket.siteId, 'agent-status-changed', announcement);
      } else if (socket.organizationId) {
        // This used to be `adminNamespace.emit(...)` — an unscoped broadcast that
        // reached every organization's dashboard. One company's agent going idle
        // appeared on other companies' screens.
        ctx.admin.to(orgRoom(socket.organizationId)).emit('agent-status-changed', announcement);
      }
      ctx.admin.to(userRoom(socket.userId)).emit('agent-status-changed', announcement);
    })
  );
}

/** Passes on the conversations an agent is holding as they step away. */
async function releaseAssignments(socket: AdminSocket): Promise<void> {
  const held = await Conversation.find({
    assignedAgent: socket.userId,
    organizationId: socket.organizationId,
    status: { $in: ['assigned', 'pending'] }
  }).select('_id organizationId');

  for (const conversation of held) {
    const organizationId = conversation.organizationId ?? socket.organizationId;
    if (organizationId) await checkAndReassign(conversation._id, String(organizationId));
  }
}
