// The addresses the site shows: from the build, so the
// domain decision is one setting, not a search through the code.
export const SUPPORT_EMAIL: string =
  (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined) || 'destek@supbort.io';
export const SECURITY_EMAIL: string =
  (import.meta.env.VITE_SECURITY_EMAIL as string | undefined) || 'security@supbort.io';

/** Fills {{supportEmail}} / {{securityEmail}} in a text that came from the locales. */
export function withContacts(text: string): string {
  return text
    .replace(/\{\{supportEmail\}\}/g, SUPPORT_EMAIL)
    .replace(/\{\{securityEmail\}\}/g, SECURITY_EMAIL);
}
