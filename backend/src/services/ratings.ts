// Satisfaction ratings (plan v10 PRD-04).
//
// A visitor rates a conversation that has ended — from the widget, or from
// the link in the rating mail. The score is 1–5; the thumbs style sends 5 or
// 1, so the average the analytics page shows means the same for both. A
// rating can be changed for a day, then it stands. A low one (1–2) is put in
// front of the team at once.

import Conversation from '../models/Conversation';
import events from '../events';
import { AdminNotifier } from '../realtime';
import { HttpError } from '../http/errors';
import type { Server } from 'socket.io';

const CHANGE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const LOW_RATING = 2;

export interface RatingInput {
  conversationId: string;
  siteId: string;
  visitorId: string;
  score: unknown;
  feedback: unknown;
  channel: 'widget' | 'email';
}

export async function recordRating(io: Server | null | undefined, input: RatingInput) {
  const score = Number(input.score);
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    throw new HttpError(400, 'The score must be a whole number from 1 to 5', 'INVALID_RATING');
  }
  const feedback =
    typeof input.feedback === 'string' && input.feedback.trim()
      ? input.feedback.trim().slice(0, 1000)
      : null;

  const conversation = await Conversation.findOne({
    _id: input.conversationId,
    siteId: input.siteId,
    visitorId: input.visitorId
  });
  if (!conversation) throw new HttpError(404, 'Conversation not found', 'NOT_FOUND');
  if (!['resolved', 'closed'].includes(conversation.status)) {
    throw new HttpError(409, 'Rate the conversation once it has ended', 'CONVERSATION_OPEN');
  }
  const previous = conversation.rating?.ratedAt ? new Date(conversation.rating.ratedAt) : null;
  if (previous && Date.now() - previous.getTime() > CHANGE_WINDOW_MS) {
    throw new HttpError(409, 'This conversation has been rated', 'ALREADY_RATED');
  }

  conversation.rating = { score, feedback, ratedAt: new Date(), channel: input.channel };
  await conversation.save();

  if (io) {
    const notifier = new AdminNotifier(io);
    notifier.conversationUpdated(conversation, conversation);
    if (score <= LOW_RATING) {
      notifier.toSite(conversation.siteId, 'low-rating', {
        conversationId: conversation._id,
        ticketNumber: conversation.ticketNumber,
        visitorName: conversation.visitorName,
        score,
        feedback
      });
    }
  }
  events.emit('rating.created', {
    organizationId: conversation.organizationId,
    siteId: conversation.siteId,
    conversationId: conversation._id,
    score,
    feedback
  });
  return conversation.rating;
}
