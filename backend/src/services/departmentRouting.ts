// Guessing which department a visitor's first message belongs to.
//
// This lived inline in the socket handler's `send-message`, as two `if` blocks
// of Turkish keywords compared against a lowercased message and matched to a
// department by a regular expression on its *name*:
//
//     if (msgLower.includes('satış') || msgLower.includes('fiyat') || ...)
//       matched = await Department.findOne({ name: { $regex: /satış|sales/i } });
//
// Three problems with that, all of them invisible from the call site:
//
//   * The rules were buried in a 220-line message handler, so nobody looking
//     for "how does routing work" would find them.
//   * They are Turkish-only and hard-coded, yet the product serves whatever
//     language a customer's visitors write in — there was no way to tell that
//     from the code, and no single place to change it.
//   * Matching a department by its *name* means a customer who renames
//     "Satış" to "Ticaret" silently loses the routing, with no error anywhere.
//
// The rules are now data. That does not make them right — a proper solution
// routes on the department's own configuration rather than on its name, and
// `AutomationRule` already exists for exactly that — but it makes them one
// readable table that a maintainer can find, translate or replace.

import Department from '../models/Department';
import type { Doc } from '../db/model';
import type { DepartmentDoc } from '../models/Department';

/** One routing rule: words a visitor might use, and the department they mean. */
interface RoutingRule {
  /** Matched case-insensitively against the message. */
  keywords: readonly string[];
  /** Matched case-insensitively against the department's name. */
  departmentName: RegExp;
}

const ROUTING_RULES: readonly RoutingRule[] = [
  {
    keywords: ['satış', 'fiyat', 'satın', 'kampanya', 'ödeme', 'sales', 'price', 'pricing', 'buy'],
    departmentName: /satış|sales/i
  },
  {
    keywords: ['destek', 'sorun', 'hata', 'çalışmıyor', 'support', 'problem', 'error', 'broken'],
    departmentName: /destek|support/i
  }
];

/**
 * The department a first message should land in.
 *
 * Returns the keyword match when there is one, otherwise the site's oldest
 * active department as the default queue, otherwise null when the site has
 * none. Never throws: routing is a convenience, and a site with no departments
 * is a perfectly normal configuration.
 */
export async function routeToDepartment(
  siteId: unknown,
  message: string
): Promise<Doc<DepartmentDoc> | null> {
  const text = (message || '').toLowerCase();

  for (const rule of ROUTING_RULES) {
    if (!rule.keywords.some((keyword) => text.includes(keyword))) continue;

    const matched = await Department.findOne({
      siteId,
      isActive: true,
      name: { $regex: rule.departmentName }
    });
    if (matched) return matched;
  }

  // No keyword hit, or the site has no department by that name: fall back to
  // whichever department was created first.
  return Department.findOne({ siteId, isActive: true }).sort({ createdAt: 1 });
}

export { ROUTING_RULES };
