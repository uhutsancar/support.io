// SMTP delivery through nodemailer.
//
// Port 465 speaks TLS from the first byte; anything else (587, 25, a local
// sink on 1025) starts in clear and upgrades with STARTTLS when the server
// offers it. Credentials are optional so a relay that trusts the network, or
// a development sink, needs none.

import nodemailer from 'nodemailer';
import type { MailTransport } from './index';

export function smtpTransport(): MailTransport {
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
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
