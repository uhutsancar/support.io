// Outgoing e-mail.
//
// One interface, two transports chosen by MAIL_PROVIDER:
//
//   smtp     nodemailer over SMTP (SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS)
//   console  development: the message is printed and kept in a small
//            in-memory outbox the e2e suite and the developer can read
//            (GET /api/dev/outbox, never mounted in production)
//
// Callers ask for a product message — a verification link, a reset link, an
// invitation — and never build a raw mail; the wording lives in ./templates.
// A failed send is logged and reported to the caller as `false`: none of
// these flows may leak whether an address exists by failing differently.

import { isProduction } from '../../config/env';
import { consoleTransport } from './console';
import { smtpTransport } from './smtp';
import {
  invitationMail,
  missedChatMail,
  passwordResetMail,
  quotaWarningMail,
  verificationMail
} from './templates';
import type { MailLocale } from './templates';

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface MailTransport {
  readonly name: string;
  send(mail: OutgoingMail & { from: string }): Promise<void>;
}

export type MailProvider = 'smtp' | 'console';

export function mailProvider(): MailProvider {
  const configured = String(process.env.MAIL_PROVIDER || '').toLowerCase();
  if (configured === 'smtp' || configured === 'console') return configured;
  // Production must say what it uses (config/env.ts refuses to boot without
  // it); development defaults to printing.
  return isProduction ? 'smtp' : 'console';
}

/** The address mails come from. */
export function mailFrom(): string {
  return process.env.MAIL_FROM || 'Support.io <no-reply@localhost>';
}

/** Where links in mails point: the panel's own origin. */
export function appBaseUrl(): string {
  const configured = (process.env.APP_BASE_URL || '').trim().replace(/\/+$/, '');
  if (configured) return configured;
  return isProduction ? '' : 'http://localhost';
}

let transport: MailTransport | null = null;

function currentTransport(): MailTransport {
  if (!transport) transport = mailProvider() === 'smtp' ? smtpTransport() : consoleTransport();
  return transport;
}

/** For tests that swap the transport; production never calls it. */
export function setMailTransport(next: MailTransport | null): void {
  transport = next;
}

/** Sends one mail. True when the transport accepted it. */
export async function sendMail(mail: OutgoingMail): Promise<boolean> {
  try {
    await currentTransport().send({ ...mail, from: mailFrom() });
    return true;
  } catch (error) {
    // The recipient is not logged: an address is personal data, and the
    // reason is what an operator needs.
    console.error(
      `[mail] ${currentTransport().name} could not send "${mail.subject}":`,
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

export const mail = {
  sendVerification(to: string, args: { name: string; link: string; locale?: MailLocale }) {
    return sendMail({ to, ...verificationMail(args) });
  },
  sendPasswordReset(to: string, args: { name: string; link: string; locale?: MailLocale }) {
    return sendMail({ to, ...passwordResetMail(args) });
  },
  sendInvitation(
    to: string,
    args: { organization: string; inviter: string; link: string; locale?: MailLocale }
  ) {
    return sendMail({ to, ...invitationMail(args) });
  },
  sendQuotaWarning(
    to: string,
    args: { organization: string; used: number; limit: number; link: string; locale?: MailLocale }
  ) {
    return sendMail({ to, ...quotaWarningMail(args) });
  },
  sendMissedChat(
    to: string,
    args: { site: string; visitor: string; link: string; locale?: MailLocale }
  ) {
    return sendMail({ to, ...missedChatMail(args) });
  }
};

export type { MailLocale };
