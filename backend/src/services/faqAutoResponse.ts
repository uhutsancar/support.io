// Answering a visitor from the site's FAQ before an agent gets there.
//
// A deliberately conservative feature: one full-text search, and the answer is
// only sent when the match is confident. A wrong automatic answer is worse than
// none — the visitor reads it, believes it came from support, and leaves.

import FAQ from '../models/FAQ';
import Message from '../models/Message';
import type { Doc } from '../db/model';
import type { ConversationDoc } from '../models/Conversation';
import type { SocketContext } from '../socket/context';

/**
 * How good a text-search rank has to be before the bot speaks.
 *
 * PostgreSQL's `ts_rank` is not normalised, so this is a tuned threshold rather
 * than a probability. Raising it makes the bot quieter and more often right.
 */
const MIN_MATCH_SCORE = 0.5;

/**
 * Posts an FAQ answer if one clearly matches, and says whether it did.
 *
 * Never throws: this runs on the message delivery path, and a failure to find a
 * canned answer must not stop the visitor's message reaching an agent. The
 * previous version swallowed the error entirely, so a broken search index was
 * indistinguishable from "no FAQ matched".
 */
export async function tryFaqAutoResponse(
  ctx: SocketContext,
  conversation: Doc<ConversationDoc>,
  visitorMessage: string
): Promise<boolean> {
  try {
    const [best] = await FAQ.find(
      { siteId: conversation.siteId, isActive: true, $text: { $search: visitorMessage } },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(1);

    if (!best || (best.score ?? 0) <= MIN_MATCH_SCORE) return false;

    const reply = await Message.create({
      conversationId: conversation._id,
      senderType: 'bot',
      senderId: 'auto-faq',
      senderName: 'Support Bot',
      content: best.answer
    });

    best.viewCount++;
    await best.save();

    ctx.toWidgetConversation(conversation._id, 'new-message', { message: reply });
    ctx.toAdminConversation(conversation._id, 'new-message', { message: reply, conversation });
    ctx.toAdminSite(conversation.siteId, 'new-message', { message: reply, conversation });

    return true;
  } catch (error) {
    console.error('[faq] auto-response failed for conversation', conversation._id, error);
    return false;
  }
}

export { MIN_MATCH_SCORE };
