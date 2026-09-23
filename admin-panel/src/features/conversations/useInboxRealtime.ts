// The inbox's live updates, as one hook.
//
// This was 230 lines inside `Conversations.tsx`: seven socket listeners, two
// window listeners, and their teardown, all declared inside a single
// `useEffect` whose dependency list was `[socket, selectedConversation,
// selectedSite]`. Three problems came out of that shape, and all three were
// invisible while it sat in the middle of a 1300-line component:
//
//   * Every one of those handlers closed over `conversations`, `sites`,
//     `messages` and `user`, none of which were in the dependency list. The
//     listener that was attached kept the values from the render that attached
//     it, so `sites.find(...)` searched a stale array.
//   * All seven were re-attached on every change to the selected conversation
//     — detaching and reattaching nine listeners each time an agent clicked a
//     row in the list.
//   * Eight of the handlers ended in `catch (err) { }`, so a realtime update
//     that failed to apply left the inbox quietly out of date.
//
// The handlers now receive everything they need as arguments and update state
// through the functional form, so nothing is captured from a stale render. The
// listeners are attached once per socket.

import { useEffect, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import type { Conversation, Message } from '../../types/api';

/** What the page hands this hook so the handlers can act on it. */
export interface InboxRealtimeOptions {
  socket: Socket | null;
  /** The signed-in agent's id, for deciding whether an assignment is theirs. */
  currentUserId: string | null;

  /** Merges an incoming message into the open thread. */
  onMessage: (message: Message) => void;
  /** Applies a partial update to one conversation in the list. */
  onConversationPatched: (conversationId: string, patch: Partial<Conversation>) => void;
  /** A conversation that did not exist in the list yet. */
  onConversationAdded: (conversation: Conversation) => void;
  /** This agent was given, or took, a conversation — the page reloads it. */
  onAssignedToMe: (conversationId: string, siteId: string | null) => void;
}

/**
 * The events the server sends to `/admin`; see backend/src/realtime/notifier.ts.
 *
 * Typed loosely on purpose: the payloads come off the wire and the server is
 * free to add fields, so each handler reads only what it needs and nothing here
 * pretends to guarantee the rest.
 */
interface NewMessageEvent {
  message: Message & { conversationId: string };
}

interface ConversationEvent {
  conversationId: string;
  conversation?: Partial<Conversation>;
}

interface AssignmentEvent {
  conversationId: string;
  agentId: string;
  siteId?: string;
}

export function useInboxRealtime(options: InboxRealtimeOptions): void {
  // The callbacks change identity on every render of the page. Held in a ref,
  // updated in an effect, so the listeners below are attached once per socket
  // rather than on every keystroke in the search box.
  const handlers = useRef(options);
  useEffect(() => {
    handlers.current = options;
  });

  const { socket } = options;

  useEffect(() => {
    if (!socket) return;

    const onNewMessage = (event: NewMessageEvent) => {
      const message = event?.message;
      if (!message?.conversationId) return;
      handlers.current.onMessage(message);
    };

    const onNewConversation = (event: { conversation: Conversation }) => {
      if (event?.conversation) handlers.current.onConversationAdded(event.conversation);
    };

    const onConversationUpdate = (event: ConversationEvent) => {
      if (!event?.conversationId) return;
      handlers.current.onConversationPatched(event.conversationId, event.conversation ?? {});
    };

    // A breach only changes the SLA block; patching the whole conversation
    // would overwrite fields the page has more recent values for.
    const onSlaBreach = (event: ConversationEvent) => {
      if (!event?.conversationId || !event.conversation?.sla) return;
      handlers.current.onConversationPatched(event.conversationId, {
        sla: event.conversation.sla
      });
    };

    const onResolved = (event: ConversationEvent) => {
      if (!event?.conversationId) return;
      handlers.current.onConversationPatched(event.conversationId, {
        status: 'resolved',
        resolvedAt: event.conversation?.resolvedAt
      });
    };

    /**
     * Assignment and claim carry the same decision: is this mine?
     *
     * If it is, the page reloads the thread — the agent needs to see it. If it
     * is not, the row is patched in place so the list shows the new owner
     * without a refetch.
     */
    const onAssignment = (event: AssignmentEvent) => {
      if (!event?.conversationId) return;

      const mine =
        event.agentId &&
        handlers.current.currentUserId &&
        String(event.agentId) === String(handlers.current.currentUserId);

      if (mine) {
        handlers.current.onAssignedToMe(event.conversationId, event.siteId ?? null);
        return;
      }

      handlers.current.onConversationPatched(event.conversationId, {
        assignedAgent: event.agentId,
        status: 'assigned'
      });
    };

    socket.on('new-message', onNewMessage);
    socket.on('new-conversation', onNewConversation);
    socket.on('conversation-update', onConversationUpdate);
    socket.on('sla-breach', onSlaBreach);
    socket.on('conversation-resolved', onResolved);
    socket.on('conversation-assigned', onAssignment);
    socket.on('conversation-claimed', onAssignment);

    return () => {
      socket.off('new-message', onNewMessage);
      socket.off('new-conversation', onNewConversation);
      socket.off('conversation-update', onConversationUpdate);
      socket.off('sla-breach', onSlaBreach);
      socket.off('conversation-resolved', onResolved);
      socket.off('conversation-assigned', onAssignment);
      socket.off('conversation-claimed', onAssignment);
    };
  }, [socket]);
}

/**
 * The two `window` events other pages use to drive the inbox.
 *
 * The notification bell and the sidebar navigate here by dispatching a
 * `CustomEvent` rather than by routing, because the inbox keeps state — the
 * open thread, the socket rooms — that a remount would throw away. Kept beside
 * the socket listeners because they are the same kind of thing: something
 * outside this page asking it to change what it is showing.
 */
export interface InboxNavigationOptions {
  onOpenConversation: (conversationId: string, siteId: string | null) => void;
  onSelectTab: (tab: string) => void;
}

export function useInboxNavigation(options: InboxNavigationOptions): void {
  const handlers = useRef(options);
  useEffect(() => {
    handlers.current = options;
  });

  useEffect(() => {
    const onOpen = (event: Event) => {
      const { conversationId, siteId } = (event as CustomEvent).detail || {};
      if (!conversationId) return;
      handlers.current.onOpenConversation(conversationId, siteId ?? null);
    };

    const onTab = (event: Event) => {
      const { tab } = (event as CustomEvent).detail || {};
      if (tab) handlers.current.onSelectTab(tab);
    };

    window.addEventListener('navigate:open-conversation', onOpen);
    window.addEventListener('navigate:set-tab', onTab);
    return () => {
      window.removeEventListener('navigate:open-conversation', onOpen);
      window.removeEventListener('navigate:set-tab', onTab);
    };
  }, []);
}
