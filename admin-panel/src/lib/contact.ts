// The addresses the site shows (plan v10 MKT-01): from the build, so the
// domain decision (MKT-05) is one setting, not a search through the code.
export const SUPPORT_EMAIL: string =
  (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined) || 'destek@support.io';
export const SECURITY_EMAIL: string =
  (import.meta.env.VITE_SECURITY_EMAIL as string | undefined) || 'security@support.io';

/** Fills {{supportEmail}} / {{securityEmail}} in a text that came from the locales. */
export function withContacts(text: string): string {
  return text
    .replace(/\{\{supportEmail\}\}/g, SUPPORT_EMAIL)
    .replace(/\{\{securityEmail\}\}/g, SECURITY_EMAIL);
}
