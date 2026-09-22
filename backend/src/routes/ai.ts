import express from 'express';
import { sendError } from '../middleware/errors';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { auth } from '../middleware/auth';
import { isValidObjectId } from '../db/objectId';
import Conversation from '../models/Conversation';
import * as aiService from '../services/aiService';
import { getProvider } from '../services/ai';
import type { Request, Response } from 'express';
import type { Doc } from '../db/model';
import type { ConversationDoc } from '../models/Conversation';

const router = express.Router();

/** One AI task, given the conversation it was asked about. */
type AITask = (conversation: Doc<ConversationDoc>, req: Request) => Promise<unknown>;
void 0;

// Model calls cost money per request, so these endpoints get a tighter budget
// than the general API limiter. Keyed per authenticated user rather than per IP
// so one busy office cannot exhaust everyone else's allowance.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  // Authenticated calls are keyed by user id. The anonymous fallback goes
  // through ipKeyGenerator because a raw req.ip lets an IPv6 client sidestep
  // the limit by walking its own /64.
  keyGenerator: (req: Request) => (req.userId ? `user:${req.userId}` : ipKeyGenerator(req.ip ?? '')),
  message: { error: 'AI istek sınırına ulaşıldı, bir dakika sonra tekrar deneyin.' }
});

// Loads a conversation only when the caller's organization owns it. Without
// this an agent could summarize another tenant's transcript by guessing an id —
// and the summary would happily quote it back.
async function findOwnedConversation(
  req: Request,
  conversationId: string
): Promise<Doc<ConversationDoc> | null> {
  if (!isValidObjectId(conversationId)) return null;
  const orgId = req.organization?._id || req.user.organizationId;
  if (!orgId) return null;
  return Conversation.findOne({ _id: conversationId, organizationId: orgId });
}

// Every handler shares this shape: resolve the conversation, run the task,
// translate an AIError into its own status instead of a blanket 500.
function handler(run: AITask) {
  return async (req: Request, res: Response) => {
    try {
      const conversation = await findOwnedConversation(req, req.params.conversationId);
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

      const result = await run(conversation, req);
      res.json(result);
    } catch (error) {
      if (error.name === 'AIError') {
        return res.status(error.status || 502).json({
          error: error.message,
          code: error.code,
          retryable: Boolean(error.retryable)
        });
      }
      sendError(res, error);
    }
  };
}

// Lets the admin panel hide or disable the AI controls instead of offering
// buttons that always fail.
router.get('/status', auth, (req: Request, res: Response) => {
  const provider = getProvider();
  res.json({
    enabled: provider.isConfigured,
    provider: provider.name
  });
});

router.post('/conversations/:conversationId/summary', auth, aiLimiter,
  handler((conversation) => aiService.summarize(conversation)));

// The reply is returned, never sent. Delivery stays with the agent, who can
// accept, edit, regenerate or reject it.
router.post('/conversations/:conversationId/suggest-reply', auth, aiLimiter,
  handler((conversation, req) => aiService.suggestReply(conversation, {
    instruction: req.body?.instruction || null
  })));

router.post('/conversations/:conversationId/rewrite', auth, aiLimiter,
  handler((conversation, req) => aiService.rewrite(conversation, {
    draft: req.body?.draft,
    tone: req.body?.tone
  })));

router.post('/conversations/:conversationId/translate', auth, aiLimiter,
  handler((conversation, req) => aiService.translate(conversation, {
    text: req.body?.text,
    targetLanguage: req.body?.targetLanguage
  })));

router.post('/conversations/:conversationId/analyze', auth, aiLimiter,
  handler((conversation) => aiService.analyze(conversation)));

router.post('/conversations/:conversationId/knowledge-answer', auth, aiLimiter,
  handler((conversation, req) => aiService.knowledgeAnswer(conversation, {
    question: req.body?.question
  })));

export default router;