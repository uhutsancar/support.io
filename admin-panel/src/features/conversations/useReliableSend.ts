// Sending an agent's reply so that it is neither lost nor doubled.
//
// The reply used to be a bare `socket.emit`: if the connection dropped at the
// wrong moment the agent saw their text vanish from the composer and never
// appear in the thread, and pressing send again could store it twice.
//
// Now every reply gets a clientMessageId (crypto.randomUUID) the moment it is
// written. It shows at once as "sending", goes out with an acknowledgement,
// and settles when the server answers with the stored row. A reply sent while
// the socket is down — or whose answer was lost with it — waits and goes out
// again after the reconnect under the same id; the server's unique index on
// (conversation_id, client_message_id) turns a repeat into the original.
// Without an answer while online, the bubble offers a retry instead of
// spinning forever.

import { useCallback, useMemo, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Socket } from 'socket.io-client';
import type { Message } from '../../types/api';

/** How long a reply waits for the server's acknowledgement. */
const ACK_TIMEOUT_MS = 12_000;

export type OutgoingStatus = 'pending' | 'failed';

/** What `send-message` answers through its acknowledgement. */
type SendReply = { ok: true; message: Message; duplicate?: boolean } | { ok: false; code: string };

export interface ReplyFields {
  conversationId: string;
  content: string;
  messageType?: 'text' | 'image' | 'file';
  fileData?: Record<string, unknown> | null;
}

export interface UseReliableSendOptions {
  socket: Socket | null;
  setMessages: Dispatch<SetStateAction<Message[]>>;
  sender: { id: string; name: string };
  /** A refusal the agent should read (rate limit, permissions…). */
  onRefused?: (code: string) => void;
}

/** Replaces the optimistic copy of `clientMessageId` with the stored row. */
export function settleReply(current: Message[], stored: Message): Message[] {
  if (current.some((m) => m._id === stored._id)) {
    // The broadcast arrived first and is already in the list; drop the copy.
    return current.filter(
      (m) => !(m.clientMessageId === stored.clientMessageId && m._id !== stored._id)
    );
  }
  const index = stored.clientMessageId
    ? current.findIndex((m) => m.clientMessageId === stored.clientMessageId)
    : -1;
  if (index === -1) return [...current, stored];
  const next = current.slice();
  next[index] = stored;
  return next;
}

export function useReliableSend({
  socket,
  setMessages,
  sender,
  onRefused
}: UseReliableSendOptions) {
  // What is still owed to the server, by clientMessageId. Kept in a ref: it
  // is bookkeeping, not something the page renders.
  const outbox = useRef(
    new Map<string, { payload: ReplyFields & { clientMessageId: string }; attempt: number }>()
  );

  const mark = useCallback(
    (clientMessageId: string, status: OutgoingStatus) =>
      setMessages((current) =>
        current.map((m) =>
          m.clientMessageId === clientMessageId && m.status !== undefined ? { ...m, status } : m
        )
      ),
    [setMessages]
  );

  const deliver = useCallback(
    (clientMessageId: string) => {
      const entry = outbox.current.get(clientMessageId);
      // Offline: the reply waits as "sending" and goes out on reconnect.
      if (!entry || !socket || !socket.connected) return;
      const attempt = ++entry.attempt;
      socket
        .timeout(ACK_TIMEOUT_MS)
        .emit('send-message', entry.payload, (err: Error | null, reply: SendReply) => {
          const current = outbox.current.get(clientMessageId);
          // Settled already, or superseded by a resend after a reconnect.
          if (!current || current.attempt !== attempt) return;
          if (err) {
            if (socket.connected) mark(clientMessageId, 'failed');
            return;
          }
          if (reply?.ok) {
            outbox.current.delete(clientMessageId);
            setMessages((list) => settleReply(list, reply.message));
            return;
          }
          mark(clientMessageId, 'failed');
          onRefused?.(reply?.code ?? 'SERVER_ERROR');
        });
    },
    [socket, setMessages, mark, onRefused]
  );

  /** Shows the reply at once and sends it. */
  const send = useCallback(
    (fields: ReplyFields) => {
      const clientMessageId = crypto.randomUUID();
      const optimistic: Message = {
        _id: `local-${clientMessageId}`,
        clientMessageId,
        conversationId: fields.conversationId,
        senderType: 'agent',
        senderId: sender.id,
        senderName: sender.name,
        content: fields.content,
        messageType: fields.messageType ?? 'text',
        // Until the server answers, the attachment shows through the signed
        // preview link the upload returned: its stable address opens nothing
        // by itself (private attachments, plan v10 SEC-08).
        fileData: fields.fileData
          ? ({
              ...fields.fileData,
              url:
                (fields.fileData as { previewUrl?: string }).previewUrl ??
                (fields.fileData as { url?: string }).url
            } as Message['fileData'])
          : null,
        isRead: true,
        readAt: null,
        createdAt: new Date().toISOString(),
        status: 'pending'
      };
      setMessages((current) => [...current, optimistic]);
      outbox.current.set(clientMessageId, { payload: { ...fields, clientMessageId }, attempt: 0 });
      deliver(clientMessageId);
    },
    [sender.id, sender.name, setMessages, deliver]
  );

  /** The retry button on a failed bubble: same reply, same id. */
  const retry = useCallback(
    (clientMessageId: string) => {
      if (!outbox.current.has(clientMessageId)) return;
      mark(clientMessageId, 'pending');
      deliver(clientMessageId);
    },
    [mark, deliver]
  );

  /** After a reconnect: everything still owed goes out again, oldest first. */
  const resend = useCallback(() => {
    for (const clientMessageId of outbox.current.keys()) {
      mark(clientMessageId, 'pending');
      deliver(clientMessageId);
    }
  }, [mark, deliver]);

  /** The broadcast of one of our replies landed before its acknowledgement. */
  const settledByBroadcast = useCallback((stored: Message) => {
    if (stored.clientMessageId) outbox.current.delete(stored.clientMessageId);
  }, []);

  return useMemo(
    () => ({ send, retry, resend, settledByBroadcast }),
    [send, retry, resend, settledByBroadcast]
  );
}
