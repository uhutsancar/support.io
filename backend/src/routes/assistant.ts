// The FAQ assistant (Google Gemini), for the panel.
//
//   GET /api/assistant/status    whether it can be switched on here
//   GET /api/assistant/overview  every site's switch, how many public FAQ
//                                entries it can answer from, and what the
//                                assistant did there in the last 30 days
//
// Neither says the key, the provider or the model: customers buy "the
// assistant", not a vendor (product decision, 2026-10-05). The overview counts the assistant's own messages
// (sender_id 'assistant'): one without a handoff reason is an answer, one
// with a reason is a handover, and the reasons are grouped so the panel can
// say why conversations went to a person ("the FAQ has no answer" is the
// usual one, and the fix is a new FAQ entry).

import express from 'express';
import { auth } from '../middleware/auth';
import { checkPermission } from '../middleware/rbac';
import { assistantConfig } from '../config/assistant';
import { query } from '../db/pool';
import { assistantAllowance, getPlan } from '../services/entitlements';
import { PLAN_LIMITS } from '../domain/plans';
import { asyncHandler, orgId, requireOrganization, restrictedSiteIds } from '../http';
import type { Request, Response } from 'express';

const router = express.Router();

/** The window the overview counts over. */
const OVERVIEW_DAYS = 30;

router.get('/status', auth, requireOrganization, (_req: Request, res: Response) => {
  const config = assistantConfig();
  res.json({ available: config !== null });
});

router.get(
  '/overview',
  auth,
  requireOrganization,
  checkPermission('manage_sites'),
  asyncHandler(async (req: Request, res: Response) => {
    const config = assistantConfig();
    const restricted = restrictedSiteIds(req);
    const restrictedList = restricted ? [...restricted] : null;
    const { rows: sites } = await query<{
      id: string;
      name: string;
      domain: string;
      assistant_enabled: boolean;
      faq_auto_reply: boolean;
      faq_count: number;
    }>(
      `SELECT s.id, s.name, s.domain, s.assistant_enabled, s.faq_auto_reply,
              (SELECT count(*) FROM faqs f
                WHERE f.site_id = s.id AND f.is_active AND f.page_specific = '*')::int AS faq_count
         FROM sites s
        WHERE s.organization_id = $1 AND ($2::text[] IS NULL OR s.id = ANY($2))
        ORDER BY s.created_at`,
      [orgId(req), restrictedList]
    );
    const siteIds = sites.map((s) => s.id);

    const [activity, reasons, allowance, plan] = await Promise.all([
      query<{ site_id: string; answered: number; handed_over: number; conversations: number }>(
        `SELECT c.site_id,
                count(*) FILTER (WHERE m.assistant ->> 'handoff' IS NULL)::int AS answered,
                count(*) FILTER (WHERE m.assistant ->> 'handoff' IS NOT NULL)::int AS handed_over,
                count(DISTINCT c.id)::int AS conversations
           FROM messages m
           JOIN conversations c ON c.id = m.conversation_id
          WHERE c.site_id = ANY($1) AND m.sender_id = 'assistant'
            AND m.created_at > now() - make_interval(days => $2)
          GROUP BY c.site_id`,
        [siteIds, OVERVIEW_DAYS]
      ),
      query<{ reason: string; n: number }>(
        `SELECT m.assistant ->> 'handoff' AS reason, count(*)::int AS n
           FROM messages m
           JOIN conversations c ON c.id = m.conversation_id
          WHERE c.site_id = ANY($1) AND m.sender_id = 'assistant'
            AND m.assistant ->> 'handoff' IS NOT NULL
            AND m.created_at > now() - make_interval(days => $2)
          GROUP BY 1
          ORDER BY 2 DESC`,
        [siteIds, OVERVIEW_DAYS]
      ),
      assistantAllowance(orgId(req)),
      getPlan(orgId(req))
    ]);
    const bySite = new Map(activity.rows.map((r) => [r.site_id, r]));

    res.json({
      available: config !== null,
      days: OVERVIEW_DAYS,
      plan,
      // This month's answers against the plan's allowance.
      usage: {
        used: allowance.used,
        limit: allowance.limit,
        repliesPerConversation: PLAN_LIMITS[plan].assistant.repliesPerConversation
      },
      sites: sites.map((s) => ({
        _id: s.id,
        name: s.name,
        domain: s.domain,
        assistantEnabled: s.assistant_enabled,
        faqAutoReply: s.faq_auto_reply,
        faqCount: s.faq_count,
        answered: bySite.get(s.id)?.answered ?? 0,
        handedOver: bySite.get(s.id)?.handed_over ?? 0,
        conversations: bySite.get(s.id)?.conversations ?? 0
      })),
      // Gemini errors are one reason for the panel: "the service was busy".
      reasons: reasons.rows.reduce<Record<string, number>>((acc, r) => {
        const key = r.reason.startsWith('api_') ? 'api' : r.reason;
        acc[key] = (acc[key] ?? 0) + r.n;
        return acc;
      }, {})
    });
  })
);

export default router;
