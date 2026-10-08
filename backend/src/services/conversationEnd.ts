// Telling the visitor's widget that the conversation is over (plan v10
// PRD-04, PRD-06): it then asks for a rating, and offers the transcript, as
// the site's settings say. Both ways a conversation ends — the REST status
// route and the socket's resolve — call this.

import Site from '../models/Site';
import { chatSettings } from './chatSettings';
import { conversationRoom } from '../realtime/rooms';
import { notifyIntegrations } from './integrations';
import type { Server } from 'socket.io';

interface EndedConversation {
  _id: string;
  siteId: unknown;
  organizationId?: unknown;
  ticketId?: string | null;
  status?: string | null;
  visitorName?: string | null;
  visitorEmail?: string | null;
  rating?: { score?: number | null } | null;
}

export async function announceConversationEnded(
  io: Server | null | undefined,
  conversation: EndedConversation
): Promise<void> {
  // Slack, Telegram, webhooks hear it whether or not a widget is listening.
  notifyIntegrations('conversation.closed', conversation);
  if (!io) return;
  try {
    const site = await Site.findById(String(conversation.siteId)).select('chatSettings');
    const settings = chatSettings(site?.chatSettings);
    io.of('/widget')
      .to(conversationRoom(conversation._id))
      .emit('conversation-ended', {
        conversationId: conversation._id,
        csat:
          settings.csat.enabled && !conversation.rating?.score
            ? { style: settings.csat.style }
            : null,
        transcript: settings.transcript
      });
  } catch (error) {
    // The conversation is already closed; only the prompt is lost.
    console.error('[conversation] could not tell the widget it ended', error);
  }
}
