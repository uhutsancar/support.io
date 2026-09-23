// Recomputing a conversation's SLA clocks without letting one bad row break a
// whole page.
//
// `calculateSLA()` reads the `sla` json column and can throw on a row written
// by an older version of the schema. Eleven call sites guarded against that the
// same way:
//
//     try { conversation.calculateSLA(); } catch (slaErr) { }
//
// An empty catch is indistinguishable from a forgotten one. The intent — "a
// corrupt SLA must not stop the inbox from rendering" — is right, but it was
// nowhere written down and nothing was ever reported, so a row that had been
// failing for months looked exactly like a row that was fine.

import type { Doc } from '../db/model';
import type { ConversationDoc } from '../models/Conversation';

/**
 * Recomputes the SLA state in place. Returns whether it succeeded.
 *
 * Never throws: the caller is usually rendering a list, where one unreadable
 * row must not take the other forty-nine with it. The failure is logged with
 * the id, so a persistently broken row is findable instead of invisible.
 */
export function refreshSla(conversation: Doc<ConversationDoc>): boolean {
  if (typeof conversation.calculateSLA !== 'function') return false;
  try {
    conversation.calculateSLA();
    return true;
  } catch (error) {
    console.error('[sla] could not recalculate for conversation', conversation._id, error);
    return false;
  }
}

/** `refreshSla` across a list, for the inbox and the assigned-to-me page. */
export function refreshSlaAll(conversations: readonly Doc<ConversationDoc>[]): void {
  for (const conversation of conversations) refreshSla(conversation);
}
