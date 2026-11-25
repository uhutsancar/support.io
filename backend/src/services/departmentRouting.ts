// Guessing which department a visitor's first message belongs to: a table of
// keywords per department, matched against the message and the department's
// name.

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
