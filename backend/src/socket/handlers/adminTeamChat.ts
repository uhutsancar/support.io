// Internal chat between agents, over the socket.
//
// Membership is checked on every event through `ctx.chatFor`, which resolves a
// chat only when this socket is one of its participants. Knowing a chat id is
// never enough.

import TeamChat from '../../models/TeamChat';
import TeamMessage from '../../models/TeamMessage';
import { teamChatRoom, userRoom } from '../../realtime/rooms';
import type { SocketContext } from '../context';
import type { AdminSocket, TeamChatPayload, TeamChatSendPayload } from '../types';

const MAX_MESSAGE_LENGTH = 10000;

export function installAdminTeamChatHandlers(ctx: SocketContext, socket: AdminSocket): void {
  socket.on(
    'team-chat-join',
    ctx.guard(socket, async (data: TeamChatPayload | undefined) => {
      const chat = await ctx.chatFor(socket, data?.chatId);
      if (!chat) return ctx.reject(socket);
      await socket.join(teamChatRoom(chat.chatId));
    })
  );

  socket.on('team-chat-leave', (data: TeamChatPayload) => {
    // No membership check needed: leaving a room you are not in is a no-op.
    if (data?.chatId) void socket.leave(teamChatRoom(data.chatId));
  });

  socket.on(
    'team-chat-send',
    ctx.guard(socket, async (data: TeamChatSendPayload | undefined) => {
      const { content } = data || {};
      if (typeof content !== 'string' || !content.trim() || content.length > MAX_MESSAGE_LENGTH) {
        return socket.emit('error', { message: 'Invalid message content' });
      }

      const chat = await ctx.chatFor(socket, data?.chatId);
      if (!chat) return ctx.reject(socket);

      const body = content.trim();
      const message = await TeamMessage.create({
        chatId: chat.chatId,
        chatType: chat.chatType,
        senderId: socket.userId,
        senderName: socket.userName,
        content: body,
        // The sender has by definition read their own message.
        readBy: [socket.userId]
      });

      // The denormalised preview the chat list renders and sorts on. `createdAt`
      // is the field both sides agree on; see models/TeamChat.ts.
      await TeamChat.findOneAndUpdate(
        { chatId: chat.chatId, participants: socket.userId },
        {
          lastMessage: {
            content: body,
            senderId: socket.userId,
            senderName: socket.userName,
            createdAt: new Date()
          }
        }
      );

      // Two deliveries, deliberately: the room reaches whoever has the thread
      // open, and the per-user room reaches the rest so their chat list and
      // unread badge update wherever they are in the app.
      ctx.toTeamChat(chat.chatId, 'team-chat-message', { message });

      for (const participantId of chat.participants) {
        if (String(participantId) === String(socket.userId)) continue;
        ctx.admin.to(userRoom(participantId)).emit('team-chat-message', { message });
        ctx.admin.to(userRoom(participantId)).emit('team-chat-notification', {
          chatId: chat.chatId,
          message,
          chatType: chat.chatType,
          groupName: chat.groupName
        });
      }
    })
  );

  socket.on(
    'team-chat-typing',
    ctx.guard(socket, async (data: TeamChatPayload | undefined) => {
      const chat = await ctx.chatFor(socket, data?.chatId);
      if (!chat) return;
      // `socket.to` excludes the sender, who does not need to see themselves type.
      socket.to(teamChatRoom(chat.chatId)).emit('team-chat-user-typing', {
        chatId: chat.chatId,
        userName: socket.userName
      });
    })
  );
}
