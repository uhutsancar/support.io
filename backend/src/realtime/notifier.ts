// What the server tells the admin panel, as named operations.
//
// The same three-line incantation appeared in routes, services and the socket
// handler alike:
//
//     const io = req.app.get('io');
//     if (io) {
//       io.of('/admin').to(`site:${conversation.siteId}`).emit('conversation-update', {
//         conversationId: conversation._id,
//         conversation: updated.toObject()
//       });
//     }
//
// Six copies of that one event, each free to spell the room, the event name or
// the payload key slightly differently — and one of them did, sending the
// document instead of `toObject()`, so the panel received a shape it did not
// expect. None of it was checkable: `emit` takes any string and any payload.
//
// A notifier turns each broadcast into a method with a typed payload. The room
// and the event name are decided here once, so a rename is a compile error
// rather than a message quietly delivered to nobody.

import { conversationRoom, siteRoom, userRoom } from './rooms';
import type { Namespace, Server } from 'socket.io';

/** Anything that can be serialised to a client; documents are sent as plain objects. */
type Payload = Record<string, unknown>;

/** Accepts a document or a plain row and sends the plain form. */
function plain(value: unknown): unknown {
  if (
    value &&
    typeof value === 'object' &&
    typeof (value as { toObject?: unknown }).toObject === 'function'
  ) {
    return (value as { toObject: () => unknown }).toObject();
  }
  return value;
}

export interface ConversationLike {
  _id: unknown;
  siteId: unknown;
  assignedAgent?: unknown;
}

/**
 * The admin panel's view of what just happened.
 *
 * Every method states who hears it: the site room reaches every agent watching
 * that site's inbox, the user room reaches one agent wherever they are.
 */
export class AdminNotifier {
  private readonly admin: Namespace;

  constructor(io: Server) {
    this.admin = io.of('/admin');
  }

  /** Escape hatch for a one-off event that has not earned a method yet. */
  toSite(siteId: unknown, event: string, payload: Payload): void {
    this.admin.to(siteRoom(siteId)).emit(event, payload);
  }

  toUser(userId: unknown, event: string, payload: Payload): void {
    this.admin.to(userRoom(userId)).emit(event, payload);
  }

  // ------------------------------------------------------------ conversations

  /**
   * The canonical "this conversation changed, here it is" broadcast.
   *
   * Sent after every mutation — assignment, department, priority, status — so
   * an inbox open in another tab re-renders the row without refetching.
   */
  conversationUpdated(conversation: ConversationLike, updated?: unknown): void {
    this.toSite(conversation.siteId, 'conversation-update', {
      conversationId: conversation._id,
      conversation: plain(updated ?? conversation)
    });
  }

  conversationAssigned(
    conversation: ConversationLike,
    agentId: unknown,
    assignedBy: unknown
  ): void {
    // The assignee is told wherever they are; the site room is told so the
    // inbox shows the new owner.
    this.toUser(agentId, 'conversation-assigned', {
      conversationId: conversation._id,
      agentId,
      assignedBy,
      siteId: conversation.siteId
    });
  }

  conversationClaimed(conversation: ConversationLike, agentId: unknown): void {
    this.toUser(agentId, 'conversation-claimed', {
      conversationId: conversation._id,
      agentId
    });
  }

  conversationDepartmentChanged(conversation: ConversationLike, departmentId: unknown): void {
    this.toSite(conversation.siteId, 'conversation-department-changed', {
      conversationId: conversation._id,
      departmentId
    });
  }

  conversationResolved(conversation: ConversationLike, updated?: unknown): void {
    this.toSite(conversation.siteId, 'conversation-resolved', {
      conversationId: conversation._id,
      conversation: plain(updated ?? conversation)
    });
  }

  conversationDeleted(siteId: unknown, conversationId: unknown): void {
    this.toSite(siteId, 'stats-update', {
      type: 'conversation-deleted',
      siteId,
      conversationId
    });
  }

  messagesRead(siteId: unknown, conversationId: unknown): void {
    this.toSite(siteId, 'messages-read', { conversationId, siteId });
  }

  // ------------------------------------------------------------------ the team

  /**
   * A team change reaches the member themselves and every site they work on.
   *
   * Both routes that did this looped over `assignedSites` by hand, each with
   * its own `s._id ? s._id.toString() : s.toString()` dance to cope with the
   * list being either ids or populated documents.
   */
  teamMemberChanged(
    event: 'team-member-added' | 'team-member-deleted' | 'agent-status-changed',
    memberId: unknown,
    assignedSites: readonly unknown[] | undefined,
    payload: Payload
  ): void {
    for (const site of assignedSites ?? []) {
      const siteId =
        site && typeof site === 'object' && '_id' in site ? (site as { _id: unknown })._id : site;
      this.toSite(siteId, event, payload);
    }
    this.toUser(memberId, event, payload);
  }
}

/** The widget namespace, for messages that go back to the visitor. */
export class WidgetNotifier {
  private readonly widget: Namespace;

  constructor(io: Server) {
    this.widget = io.of('/widget');
  }

  toConversation(conversationId: unknown, event: string, payload: Payload): void {
    this.widget.to(conversationRoom(conversationId)).emit(event, payload);
  }

  newMessage(conversationId: unknown, message: unknown): void {
    this.toConversation(conversationId, 'new-message', { message: plain(message) });
  }
}

/**
 * The notifier for a request, from the io instance the server stored on the app.
 *
 * Returns null when there is no io — a unit test, or a script that imports a
 * route module without starting the server — so callers can skip broadcasting
 * without each of them writing `const io = req.app.get('io'); if (io) { ... }`.
 */
export function adminNotifier(io: Server | undefined | null): AdminNotifier | null {
  return io ? new AdminNotifier(io) : null;
}
