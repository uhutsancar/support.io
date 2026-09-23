import express from 'express';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { auth } from '../middleware/auth';
import * as aiService from '../services/aiService';
import { getProvider } from '../services/ai';
import { HttpError, asyncHandler, loadOwnedConversation, requireOrganization } from '../http';
import type { Request, Response } from 'express';
import type { Doc } from '../db/model';
import type { ConversationDoc } from '../models/Conversation';

const router = express.Router();

/** One AI task, given the conversation it was asked about. */
type AITask = (conversation: Doc<ConversationDoc>, req: Request) => Promise<unknown>;

// Model calls cost money per request, so these endpoints get a tighter budget
// than the general API limiter. Keyed per authenticated user rather than per IP
// so one busy office cannot exhaust everyone else's allowance.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  // Authenticated calls are keyed by user id. The anonymous fallback goes
  // through ipKeyGenerator because a raw req.ip lets an IPv6 client sidestep
  // the limit by walking its own /64.
  keyGenerator: (req: Request) =>
    req.userId ? `user:${req.userId}` : ipKeyGenerator(req.ip ?? ''),
  message: { error: 'AI istek sınırına ulaşıldı, bir dakika sonra tekrar deneyin.' }
});

/** True for the provider layer's own failure type, which carries a status. */
function isAIError(error: unknown): error is Error & {
  name: 'AIError';
  status?: number;
  code?: string;
  retryable?: boolean;
} {
  return error instanceof Error && error.name === 'AIError';
}

/**
 * Every handler here has the same shape: resolve the conversation the caller is
 * allowed to see, run the task, and let a provider failure keep its own status
 * instead of collapsing into a blanket 500.
 *
 * `loadOwnedConversation` is the shared tenant guard (src/http/guards.ts).
 * Without it an agent could summarise another tenant's transcript by guessing
 * an id — and the summary would quote it straight back.
 */
function handler(run: AITask) {
  return asyncHandler(async (req: Request, res: Response) => {
    const conversation = await loadOwnedConversation(req, req.params.conversationId);
    try {
      res.json(await run(conversation, req));
    } catch (error) {
      if (isAIError(error)) {
        throw new HttpError(error.status || 502, error.message, error.code || 'AI_ERROR', {
          retryable: Boolean(error.retryable)
        });
      }
      throw error;
    }
  });
}

// Lets the admin panel hide or disable the AI controls instead of offering
// buttons that always fail.
router.get('/status', auth, (_req: Request, res: Response) => {
  const provider = getProvider();
  res.json({
    enabled: provider.isConfigured,
    provider: provider.name
  });
});

router.post(
  '/conversations/:conversationId/summary',
  auth,
  requireOrganization,
  aiLimiter,
  handler((conversation) => aiService.summarize(conversation))
);

// The reply is returned, never sent. Delivery stays with the agent, who can
// accept, edit, regenerate or reject it.
router.post(
  '/conversations/:conversationId/suggest-reply',
  auth,
  requireOrganization,
  aiLimiter,
  handler((conversation, req) =>
    aiService.suggestReply(conversation, {
      instruction: req.body?.instruction || null
    })
  )
);

router.post(
  '/conversations/:conversationId/rewrite',
  auth,
  requireOrganization,
  aiLimiter,
  handler((conversation, req) =>
    aiService.rewrite(conversation, {
      draft: req.body?.draft,
      tone: req.body?.tone
    })
  )
);

router.post(
  '/conversations/:conversationId/translate',
  auth,
  requireOrganization,
  aiLimiter,
  handler((conversation, req) =>
    aiService.translate(conversation, {
      text: req.body?.text,
      targetLanguage: req.body?.targetLanguage
    })
  )
);

router.post(
  '/conversations/:conversationId/analyze',
  auth,
  requireOrganization,
  aiLimiter,
  handler((conversation) => aiService.analyze(conversation))
);

router.post(
  '/conversations/:conversationId/knowledge-answer',
  auth,
  requireOrganization,
  aiLimiter,
  handler((conversation, req) =>
    aiService.knowledgeAnswer(conversation, {
      question: req.body?.question
    })
  )
);

export default router;
