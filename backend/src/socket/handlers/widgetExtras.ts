// The visitor's side of the forms, ratings and transcripts (plan v10
// PRD-01, PRD-04, PRD-05, PRD-06). Installed on every widget socket next to
// the chat handlers in ./widget.ts.
//
//   visitor-contact     the pre-chat / offline form: name, address, phone,
//                       the site's own questions, the consent box
//   rate-conversation   the rating shown when the conversation ends
//   request-transcript  "mail me this conversation"
//
// Each answers through its acknowledgement: { ok: true, ... } or
// { ok: false, code, message }.

import Conversation from '../../models/Conversation';
import Message from '../../models/Message';
import Site from '../../models/Site';
import Department from '../../models/Department';
import { parseVisitorContact } from '../../services/visitorContact';
import { recordRating } from '../../services/ratings';
import { chatSettings } from '../../services/chatSettings';
import { mail } from '../../services/mail';
import { signVisitorLink } from '../../config/tokens';
import { resumeLink } from '../../services/conversationMail';
import { createQuota } from '../../middleware/rateLimit';
import { HttpError } from '../../http/errors';
import type { SocketContext } from '../context';
import type { WidgetSocket } from '../types';

type Ack = (reply: Record<string, unknown>) => void;

const transcriptQuota = createQuota({
  name: 'transcript',
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.TRANSCRIPT_RATE_MAX) || 3
});

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

function answer(ack: Ack | undefined, error: unknown): void {
  if (error instanceof HttpError) {
    ack?.({ ok: false, code: error.code, message: error.message, details: error.details });
    return;
  }
  console.error('[widget] extra handler failed', error);
  ack?.({ ok: false, code: 'INTERNAL', message: 'Something went wrong' });
}

export function installWidgetExtras(ctx: SocketContext, socket: WidgetSocket): void {
  socket.on('visitor-contact', async (data: unknown, ack?: Ack) => {
    try {
      const site = await Site.findOne({ _id: socket.siteId, isActive: true });
      if (!site) throw new HttpError(404, 'Site not found', 'SITE_NOT_FOUND');
      const contact = parseVisitorContact(data, site.chatSettings);
      if (contact.departmentId) {
        const department = await Department.findOne({
          _id: contact.departmentId,
          siteId: site._id,
          isActive: true
        });
        if (!department) contact.departmentId = null;
      }
      socket.contact = contact;
      if (contact.name) socket.visitorName = contact.name;
      if (contact.email) socket.visitorEmail = contact.email;

      // A conversation already running takes the details at once.
      if (socket.conversationId) {
        const conversation = await Conversation.findOne({
          _id: socket.conversationId,
          siteId: socket.siteId,
          visitorId: socket.visitorId
        });
        if (conversation) {
          applyContact(conversation, contact);
          await conversation.save();
          ctx.toAdminSite(conversation.siteId, 'conversation-update', {
            conversationId: conversation._id,
            conversation
          });
        }
      }
      ack?.({ ok: true });
    } catch (error) {
      answer(ack, error);
    }
  });

  socket.on('rate-conversation', async (data: Record<string, unknown> | undefined, ack?: Ack) => {
    try {
      const conversationId =
        typeof data?.conversationId === 'string' ? data.conversationId : socket.conversationId;
      if (!conversationId) throw new HttpError(404, 'Conversation not found', 'NOT_FOUND');
      const rating = await recordRating(ctx.io, {
        conversationId,
        siteId: String(socket.siteId),
        visitorId: String(socket.visitorId),
        score: data?.score,
        feedback: data?.feedback,
        channel: 'widget'
      });
      ack?.({ ok: true, rating });
    } catch (error) {
      answer(ack, error);
    }
  });

  socket.on('request-transcript', async (data: Record<string, unknown> | undefined, ack?: Ack) => {
    try {
      const email = typeof data?.email === 'string' ? data.email.trim().toLowerCase() : '';
      if (!EMAIL.test(email)) {
        throw new HttpError(400, 'Enter a valid e-mail address', 'PRECHAT_INVALID', {
          field: 'email'
        });
      }
      const conversationId =
        typeof data?.conversationId === 'string' ? data.conversationId : socket.conversationId;
      const conversation = conversationId
        ? await Conversation.findOne({
            _id: conversationId,
            siteId: socket.siteId,
            visitorId: socket.visitorId
          })
        : null;
      if (!conversation) throw new HttpError(404, 'Conversation not found', 'NOT_FOUND');
      const site = await Site.findById(String(conversation.siteId));
      if (!site || !chatSettings(site.chatSettings).transcript) {
        throw new HttpError(403, 'Transcripts are not offered here', 'TRANSCRIPT_OFF');
      }
      if (!(await transcriptQuota.take(`${socket.widgetSessionId}`))) {
        throw new HttpError(429, 'Too many transcripts, try again later', 'TOO_MANY_REQUESTS');
      }
      const messages = await Message.find({ conversationId: conversation._id })
        .sort({ createdAt: 1 })
        .limit(500);
      const claims = {
        siteId: String(site._id),
        conversationId: String(conversation._id),
        visitorId: String(socket.visitorId)
      };
      await mail.sendTranscript(email, {
        site: site.name,
        messages: messages.map((m) => ({
          who: m.senderType === 'visitor' ? conversation.visitorName || 'Siz' : m.senderName,
          text: m.content
        })),
        link: resumeLink(site, conversation.currentPage, signVisitorLink('resume', claims))
      });
      ack?.({ ok: true });
    } catch (error) {
      answer(ack, error);
    }
  });
}

/** Writes the form's answers onto a conversation (not saved here). */
export function applyContact(
  conversation: {
    visitorName: string;
    visitorEmail: string | null;
    visitorPhone: string | null;
    prechat: Record<string, string>;
    visitorConsentAt: Date | null;
  },
  contact: NonNullable<WidgetSocket['contact']>
): void {
  if (contact.name) conversation.visitorName = contact.name;
  if (contact.email) conversation.visitorEmail = contact.email;
  if (contact.phone) conversation.visitorPhone = contact.phone;
  if (Object.keys(contact.fields).length) {
    conversation.prechat = { ...(conversation.prechat || {}), ...contact.fields };
  }
  if (contact.consentAt && !conversation.visitorConsentAt) {
    conversation.visitorConsentAt = contact.consentAt;
  }
}
