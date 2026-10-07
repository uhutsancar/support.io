// What every widget session answer carries that changes only when the owner
// edits it (plan v10 PERF-04): the saved widget look, the public FAQ list and
// whether the plan shows "Powered by". POST /api/widget/session runs on every
// page view of every customer site, so these three reads are kept for
// BUNDLE_TTL_SECONDS in the shared cache (db/cache.ts) and dropped at once
// when the owner changes them (FAQ and widget-config routes).
//
// Not cached, on purpose: the site itself (switched off, suspended, key
// regenerated), blocks, availability and the visitor's own conversation —
// each must be right at once.

import WidgetConfig from '../models/WidgetConfig';
import FAQ from '../models/FAQ';
import { cached, forget } from '../db/cache';
import { limitsFor } from './entitlements';

const BUNDLE_TTL_SECONDS = Number(process.env.WIDGET_BUNDLE_TTL_SECONDS) || 60;

export interface SiteBundle {
  /** The saved widget configuration as a plain object, or null. */
  saved: Record<string, unknown> | null;
  faqs: Array<{ id: string; question: string; answer: string; category: string | null }>;
  branding: boolean;
}

const key = (siteId: string) => `widget:bundle:${siteId}`;

export function siteBundle(siteId: string, organizationId: string): Promise<SiteBundle> {
  return cached(key(siteId), BUNDLE_TTL_SECONDS, async () => {
    const [saved, faqs, plan] = await Promise.all([
      WidgetConfig.findOne({ siteId, isActive: true }),
      FAQ.find({ siteId, isActive: true }).sort({ order: 1 }).limit(50).lean(),
      limitsFor(organizationId)
    ]);
    return {
      saved: saved ? (saved.toObject() as Record<string, unknown>) : null,
      faqs: (faqs || []).map((f) => ({
        id: String(f._id),
        question: f.question,
        answer: f.answer,
        category: f.category || null
      })),
      branding: plan.limits.branding
    };
  });
}

/** After the owner changed the site's FAQ or widget look. */
export function forgetSiteBundle(siteId: unknown): Promise<void> {
  return forget(key(String(siteId)));
}
