// Who the assistant may answer on the free tier (plan v10 AI-02).
//
// Google's terms allow only the paid Gemini API for apps that serve people in
// the European Economic Area, Switzerland or the United Kingdom. While
// GEMINI_TIER=free, a visitor from there is never sent to the model: their
// conversation starts with a person, as on a site without the assistant.
//
// The country is Cloudflare's CF-IPCountry header. Caddy removes it from any
// request that did not come through Cloudflare (Caddyfile.prod), so a client
// cannot pick its own. Without the header — local development — the call is
// made; in production a missing or unknown country counts as "do not call".

import { isProduction } from '../../config/env';
import type { GeminiTier } from '../../config/assistant';

// The 27 EU members, then the rest of the EEA.
const EEA = (
  'AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE ' + 'IS LI NO'
).split(' ');

/** Where the free tier must not be used. */
export const FREE_TIER_EXCLUDED = new Set([...EEA, 'CH', 'GB']);

/** A two-letter country from the header, or null. 'XX' (unknown) and 'T1' (Tor) count as null. */
export function visitorCountry(header: unknown): string | null {
  const value = String(Array.isArray(header) ? header[0] : (header ?? ''))
    .trim()
    .toUpperCase();
  return /^[A-Z]{2}$/.test(value) && value !== 'XX' ? value : null;
}

/** Whether the assistant may answer a visitor from `country` on this tier. */
export function regionAllowsAssistant(
  country: string | null,
  tier: GeminiTier,
  production = isProduction
): boolean {
  if (tier === 'paid') return true;
  if (!country) return !production;
  return !FREE_TIER_EXCLUDED.has(country);
}
