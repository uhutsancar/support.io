// SMTP delivery through nodemailer.
//
// Port 465 speaks TLS from the first byte; anything else (587, 25, a local
// sink on 1025) starts in clear and upgrades with STARTTLS when the server
// offers it. Credentials are optional so a relay that trusts the network, or
// a development sink, needs none.

import nodemailer from 'nodemailer';
import type { MailTransport } from './index';

const positiveInt = (name: string, fallback: number): number => {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
};

export function smtpPoolOptions() {
  return {
    pool: true as const,
    maxConnections: positiveInt('SMTP_MAX_CONNECTIONS', 3),
    maxMessages: positiveInt('SMTP_MAX_MESSAGES', 100),
    rateDelta: positiveInt('SMTP_RATE_DELTA_MS', 1000),
    rateLimit: positiveInt('SMTP_RATE_LIMIT', 10)
  };
}

export function smtpTransport(): MailTransport {
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    ...smtpPoolOptions(),
    auth: user ? { user, pass: process.env.SMTP_PASS || '' } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000
  });

  return {
    name: 'smtp',
    async send(mail) {
      await transporter.sendMail({
        from: mail.from,
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html
      });
    }
  };
}
