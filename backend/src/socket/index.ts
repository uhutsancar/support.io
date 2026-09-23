// The socket layer's composition root.
//
// This used to be a single 1455-line class that held the authentication
// middleware, every widget event, every admin event, the team chat, an
// automation bridge, an FAQ bot and a background SLA timer. Nothing in it could
// be read, tested or changed in isolation, and the SLA timer in particular
// duplicated services/slaSweeper.ts — both ran, on different intervals, over
// the same rows.
//
// What is left here is wiring:
//
//   auth.ts                      who is on an admin socket
//   context.ts                   the authorised lookups every handler shares
//   handlers/widget.ts           the visitor's side
//   handlers/adminConversations  the agent's side of a conversation
//   handlers/adminPresence       online / away
//   handlers/adminTeamChat       agent-to-agent chat
//
// Domain work the handlers used to inline now lives in src/services:
// conversationIntake, departmentRouting, departmentStats, faqAutoResponse,
// automationTrigger, conversationSla.

import { SocketContext } from './context';
import { installAdminAuthentication } from './auth';
import { installWidgetHandlers } from './handlers/widget';
import { installAdminConversationHandlers } from './handlers/adminConversations';
import { installAdminPresenceHandlers } from './handlers/adminPresence';
import { installAdminTeamChatHandlers } from './handlers/adminTeamChat';
import { userRoom } from '../realtime/rooms';
import type { Server, Socket } from 'socket.io';
import type { AdminSocket } from './types';

/** The room every socket of one organization shares, for org-wide broadcasts. */
const orgRoom = (organizationId: unknown): string => `org:${String(organizationId)}`;

export class SocketHandler {
  readonly ctx: SocketContext;

  constructor(io: Server) {
    this.ctx = new SocketContext(io);

    installAdminAuthentication(this.ctx.admin);
    installWidgetHandlers(this.ctx);
    this.installAdminHandlers();
  }

  private installAdminHandlers(): void {
    this.ctx.admin.on('connection', (rawSocket: Socket) => {
      const socket = rawSocket as AdminSocket;

      // Joined before any event: the per-user room is how a message reaches an
      // agent wherever they are in the app, and the org room is how a broadcast
      // stays inside one tenant.
      // `void`: this listener is not async, and a failure to join is a
      // dead connection the client will retry, not something to handle here.
      void socket.join(userRoom(socket.userId));
      void socket.join(orgRoom(socket.organizationId));

      installAdminConversationHandlers(this.ctx, socket);
      installAdminPresenceHandlers(this.ctx, socket);
      installAdminTeamChatHandlers(this.ctx, socket);
    });
  }
}

export default SocketHandler;
export { SocketContext };
