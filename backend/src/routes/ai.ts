import express from 'express';
import { auth } from '../middleware/auth';
import * as aiService from '../services/aiService';
import { getProvider } from '../services/ai';
import { createLimiter } from '../middleware/rateLimit';
import { checkPermission } from '../middleware/rbac';
import Site from '../models/Site';
import { assistantActive, setResponseOwner } from '../services/ai/autoReply';
import { ioFrom } from '../realtime';
import {
  HttpError,
  asyncHandler,
  badRequest,
  conflict,
  loadAccessibleConversation,
  requireOrganization
} from '../http';
import type { Request, Response } from 'express';
import type { Doc } from '../db/model';
import type { ConversationDoc } from '../models/Conversation';

const router = express.Router();

/** One AI task, given the conversation it was asked about. */
type AITask = (conversation: Doc<ConversationDoc>, req: Request) => Promise<unknown>;

// Every call occupies the one GPU all tenants share, so these endpoints get a
// tighter budget than the general API limiter. The shared limiter keys by the
// signed-in user, so one busy office cannot exhaust everyone else's allowance,
// and keeps its counter in Redis, so the limit holds across processes rather
// than multiplying with them.
const aiLimiter = createLimiter({
  name: 'ai',
  code: 'AI_RATE_LIMITED',
  message: 'AI istek sınırına ulaşıldı, bir dakika sonra tekrar deneyin.',
  windowMs: 60 * 1000,
  max: 20
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
 * `loadAccessibleConversation` is the inbox's own rule (src/http/guards.ts):
 * the caller's organization *and* a site their role and assignment reach.
 * Without it an agent could summarise a transcript they may not open by
 * guessing an id — and the summary would quote it straight back.
 */
function handler(run: AITask) {
  return asyncHandler(async (req: Request, res: Response) => {
    const conversation = await loadAccessibleConversation(req, req.params.conversationId);
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
// buttons that always fail, and show "loading" while the model warms up.
// Neither the key nor the model server's address is part of the answer.
router.get(
  '/status',
  auth,
  asyncHandler(async (_req: Request, res: Response) => {
    const provider = getProvider();
    const state = await provider.state();
    res.json({
      enabled: provider.isConfigured && state === 'ready',
      configured: provider.isConfigured,
      state,
      model: provider.model
    });
  })
);

// "Take over" and "give back to AI". Who may do it is the inbox rule: anyone
// who may answer this conversation. Handing back needs the site's assistant to
// be on, otherwise nobody would answer the visitor.
router.put(
  '/conversations/:conversationId/owner',
  auth,
  requireOrganization,
  checkPermission('respond'),
  asyncHandler(async (req: Request, res: Response) => {
    const owner = req.body?.owner;
    if (owner !== 'ai' && owner !== 'human') throw badRequest("owner must be 'ai' or 'human'");

    const conversation = await loadAccessibleConversation(req, req.params.conversationId);
    if (owner === 'ai') {
      const site = await Site.findById(conversation.siteId);
      if (!site || !assistantActive(site)) {
        throw conflict('Otomatik yanıt bu sitede açık değil.');
      }
    }

    const changed = await setResponseOwner(ioFrom(req), conversation, owner);
    res.json({
      responseOwner: changed?.responseOwner ?? conversation.responseOwner,
      aiControlVersion: changed?.aiControlVersion ?? conversation.aiControlVersion
    });
  })
);

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
