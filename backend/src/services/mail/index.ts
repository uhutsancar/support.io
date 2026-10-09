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

import { increment } from '../../config/metrics';
import { isProduction } from '../../config/env';
import { consoleTransport } from './console';
import { smtpTransport } from './smtp';
import {
  activationMail,
  csatRequestMail,
  transcriptMail,
  visitorReplyMail,
  emailChangeMail,
  emailChangeNoticeMail,
  existingAccountMail,
  invitationMail,
  missedChatMail,
  passwordChangedMail,
  passwordResetMail,
  paymentFailedMail,
  planOverageMail,
  quotaWarningMail,
  securityNoticeMail,
  trialEndedMail,
  weeklyReportMail,
  referralRewardMail,
  trialEndingMail,
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

/**
 * The recipient domains a staging server may write to (plan v10 INF-03):
 * MAIL_ALLOWLIST_DOMAINS="example.com,ourcompany.com". Empty: every domain
 * (production). Staging uses real SMTP but must never mail a real customer.
 */
export function mailAllowed(to: string, raw = process.env.MAIL_ALLOWLIST_DOMAINS): boolean {
  const allowed = String(raw || '')
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);
  if (!allowed.length) return true;
  const domain = to.trim().toLowerCase().split('@').pop() || '';
  return allowed.some((d) => domain === d || domain.endsWith(`.${d}`));
}

/** Sends one mail. True when the transport accepted it. */
export async function sendMail(mail: OutgoingMail): Promise<boolean> {
  if (!mailAllowed(mail.to)) {
    // Withheld on purpose, not failed: counted, and the subject logged so a
    // tester can see what would have gone out (never the address).
    increment('supportio_mail_total', { outcome: 'withheld' });
    console.log(`[mail] withheld by MAIL_ALLOWLIST_DOMAINS: "${mail.subject}"`);
    return false;
  }
  try {
    await currentTransport().send({ ...mail, from: mailFrom() });
    increment('supportio_mail_total', { outcome: 'sent' });
    return true;
  } catch (error) {
    increment('supportio_mail_total', { outcome: 'failed' });
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
  sendExistingAccount(to: string, args: { name: string; link: string; locale?: MailLocale }) {
    return sendMail({ to, ...existingAccountMail(args) });
  },
  sendPasswordChanged(to: string, args: { name: string; link: string; locale?: MailLocale }) {
    return sendMail({ to, ...passwordChangedMail(args) });
  },
  sendEmailChange(to: string, args: { name: string; link: string; locale?: MailLocale }) {
    return sendMail({ to, ...emailChangeMail(args) });
  },
  sendEmailChangeNotice(
    to: string,
    args: { name: string; newEmail: string; changed: boolean; link: string; locale?: MailLocale }
  ) {
    return sendMail({ to, ...emailChangeNoticeMail(args) });
  },
  sendSecurityNotice(
    to: string,
    args: {
      name: string;
      event:
        'mfa_enabled' | 'mfa_disabled' | 'recovery_used' | 'sessions_revoked' | 'google_linked';
      link: string;
      locale?: MailLocale;
    }
  ) {
    return sendMail({ to, ...securityNoticeMail(args) });
  },
  sendTrialEnding(
    to: string,
    args: { name: string; daysLeft: number; link: string; locale?: MailLocale }
  ) {
    return sendMail({ to, ...trialEndingMail(args) });
  },
  sendTrialEnded(to: string, args: { name: string; link: string; locale?: MailLocale }) {
    return sendMail({ to, ...trialEndedMail(args) });
  },
  sendPaymentFailed(
    to: string,
    args: {
      name: string;
      organization: string;
      graceEndsAt: Date;
      link: string;
      locale?: MailLocale;
    }
  ) {
    return sendMail({ to, ...paymentFailedMail(args) });
  },
  sendPlanOverage(
    to: string,
    args: {
      name: string;
      organization: string;
      sites: number;
      seats: number;
      link: string;
      locale?: MailLocale;
    }
  ) {
    return sendMail({ to, ...planOverageMail(args) });
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
    args: {
      site: string;
      visitors: string[];
      preview?: string;
      link: string;
      settingsLink: string;
      locale?: MailLocale;
    }
  ) {
    return sendMail({ to, ...missedChatMail(args) });
  },
  sendVisitorReply(
    to: string,
    args: {
      site: string;
      replies: Array<{ who: string; text: string }>;
      link: string;
      optOutLink: string;
      locale?: MailLocale;
    }
  ) {
    return sendMail({ to, ...visitorReplyMail(args) });
  },
  sendCsatRequest(to: string, args: { site: string; link: string; locale?: MailLocale }) {
    return sendMail({ to, ...csatRequestMail(args) });
  },
  sendTranscript(
    to: string,
    args: {
      site: string;
      messages: Array<{ who: string; text: string }>;
      link: string;
      locale?: MailLocale;
    }
  ) {
    return sendMail({ to, ...transcriptMail(args) });
  },
  sendReferralReward(to: string, args: Parameters<typeof referralRewardMail>[0]) {
    return sendMail({ to, ...referralRewardMail(args) });
  },
  sendWeeklyReport(to: string, args: Parameters<typeof weeklyReportMail>[0]) {
    return sendMail({ to, ...weeklyReportMail(args) });
  },
  sendActivation(
    to: string,
    args: {
      step: 'welcome' | 'install_reminder' | 'faq_assistant' | 'invite_team' | 'widget_live';
      name: string;
      link: string;
      settingsLink: string;
      locale?: MailLocale;
    }
  ) {
    return sendMail({ to, ...activationMail(args) });
  }
};

export type { MailLocale };
