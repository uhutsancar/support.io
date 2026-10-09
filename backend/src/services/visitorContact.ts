// What a visitor leaves in the pre-chat or offline form (plan v10 PRD-01,
// PRD-05), checked against the site's settings: only the fields the site
// asks for, each within bounds, the required ones present, and the consent
// box ticked when the site requires it. The time of consent is what is kept.

import { chatSettings } from './chatSettings';
import { HttpError } from '../http/errors';
import type { ChatSettings } from './chatSettings';

export interface VisitorContact {
  name: string | null;
  email: string | null;
  phone: string | null;
  /** Answers to the site's own questions, by label. */
  fields: Record<string, string>;
  consentAt: Date | null;
  departmentId: string | null;
}

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const PHONE = /^[+0-9 ()-]{5,40}$/;

const text = (value: unknown, max: number): string | null =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;

/** Throws PRECHAT_INVALID / PRECHAT_INCOMPLETE; returns the clean contact. */
export function parseVisitorContact(raw: unknown, siteSettings: unknown): VisitorContact {
  const settings: ChatSettings = chatSettings(siteSettings);
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const pre = settings.preChat;

  const name = text(input.name, 100);
  const email = text(input.email, 254)?.toLowerCase() ?? null;
  const phone = text(input.phone, 40);
  if (email && !EMAIL.test(email)) {
    throw new HttpError(400, 'Enter a valid e-mail address', 'PRECHAT_INVALID', { field: 'email' });
  }
  if (phone && !PHONE.test(phone)) {
    throw new HttpError(400, 'Enter a valid phone number', 'PRECHAT_INVALID', { field: 'phone' });
  }

  const fields: Record<string, string> = {};
  const given = input.fields && typeof input.fields === 'object' ? input.fields : {};
  for (const label of pre.customFields) {
    const value = text((given as Record<string, unknown>)[label], 500);
    if (value) fields[label] = value;
  }

  // The offline form asks for the address only; the pre-chat form for what
  // the site chose. "required" applies to the pre-chat form's own fields.
  if (pre.mode === 'required') {
    const missing = [
      pre.name && !name ? 'name' : null,
      pre.email && !email ? 'email' : null,
      pre.phone && !phone ? 'phone' : null,
      ...pre.customFields.filter((label) => !fields[label])
    ].filter(Boolean);
    if (missing.length) {
      throw new HttpError(400, 'Please fill in the form', 'PRECHAT_INCOMPLETE', { missing });
    }
  }

  const consented = input.consent === true;
  if (pre.consent.mode === 'required' && !consented) {
    throw new HttpError(400, 'Please accept the privacy notice', 'PRECHAT_INCOMPLETE', {
      missing: ['consent']
    });
  }

  const departmentId =
    pre.department &&
    typeof input.departmentId === 'string' &&
    /^[0-9a-f]{24}$/.test(input.departmentId)
      ? input.departmentId
      : null;

  return {
    name,
    email,
    phone,
    fields,
    consentAt: consented && pre.consent.mode !== 'off' ? new Date() : null,
    departmentId
  };
}

/**
 * Whether a first message may open a conversation yet: a site with a
 * required form (or a required consent box) needs it filled first. A
 * customer the shop identified (verified userHash) skips the form.
 */
export function preChatSatisfied(
  siteSettings: unknown,
  contact: VisitorContact | undefined,
  verified: boolean
): boolean {
  const pre = chatSettings(siteSettings).preChat;
  if (verified) return true;
  if (pre.mode === 'required' && !contact) return false;
  if (pre.consent.mode === 'required' && !contact?.consentAt) return false;
  return true;
}
