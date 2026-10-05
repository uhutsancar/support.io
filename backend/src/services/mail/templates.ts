// The words of every product e-mail, in Turkish and English.
//
// Plain and short on purpose: a security mail that looks like marketing is a
// mail people learn to ignore. Every value interpolated into HTML is escaped;
// a name is user input like any other.

export type MailLocale = 'tr' | 'en';

interface Rendered {
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** One paragraph-and-button mail, the only layout these need. */
function layout(
  { title, lines, action, link, footer }: {
    title: string;
    lines: string[];
    action: string;
    link: string;
    footer: string;
  }
): { text: string; html: string } {
  const text = [title, '', ...lines, '', `${action}: ${link}`, '', footer].join('\n');
  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111827">
<table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px">
<tr><td style="padding:28px">
<h1 style="margin:0 0 16px;font-size:20px">${escapeHtml(title)}</h1>
${lines.map((l) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.5">${escapeHtml(l)}</p>`).join('\n')}
<p style="margin:24px 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">${escapeHtml(action)}</a></p>
<p style="margin:0;font-size:12px;color:#6b7280;word-break:break-all">${escapeHtml(link)}</p>
<p style="margin:24px 0 0;font-size:12px;color:#6b7280">${escapeHtml(footer)}</p>
</td></tr></table></body></html>`;
  return { text, html };
}

const pick = <T>(locale: MailLocale | undefined, tr: T, en: T): T => (locale === 'en' ? en : tr);

export function verificationMail({
  name,
  link,
  locale
}: {
  name: string;
  link: string;
  locale?: MailLocale;
}): Rendered {
  const subject = pick(locale, 'E-posta adresinizi doğrulayın', 'Verify your e-mail address');
  return {
    subject,
    ...layout({
      title: subject,
      lines: pick(
        locale,
        [
          `Merhaba ${name},`,
          'Support.io hesabınızı tamamlamak için e-posta adresinizi doğrulayın. Widget’ınız ve ödeme işlemleri doğrulamadan sonra açılır.'
        ],
        [
          `Hi ${name},`,
          'Verify your e-mail address to finish setting up your Support.io account. Your widget and billing open once it is verified.'
        ]
      ),
      action: pick(locale, 'E-postamı doğrula', 'Verify my e-mail'),
      link,
      footer: pick(
        locale,
        'Bağlantı 24 saat geçerlidir. Bu hesabı siz açmadıysanız bu e-postayı yok sayın.',
        'The link is valid for 24 hours. If you did not create this account, ignore this e-mail.'
      )
    })
  };
}

export function passwordResetMail({
  name,
  link,
  locale
}: {
  name: string;
  link: string;
  locale?: MailLocale;
}): Rendered {
  const subject = pick(locale, 'Şifre sıfırlama', 'Reset your password');
  return {
    subject,
    ...layout({
      title: subject,
      lines: pick(
        locale,
        [
          `Merhaba ${name},`,
          'Şifrenizi sıfırlamak için bir istek aldık. Yeni şifre belirlediğinizde tüm cihazlardaki oturumlarınız kapanır.'
        ],
        [
          `Hi ${name},`,
          'We received a request to reset your password. Setting a new one signs you out on every device.'
        ]
      ),
      action: pick(locale, 'Yeni şifre belirle', 'Set a new password'),
      link,
      footer: pick(
        locale,
        'Bağlantı 1 saat geçerlidir ve bir kez kullanılabilir. İsteği siz yapmadıysanız şifreniz değişmez; bu e-postayı yok sayabilirsiniz.',
        'The link is valid for 1 hour and works once. If you did not ask for this, your password stays as it is; you can ignore this e-mail.'
      )
    })
  };
}

export function invitationMail({
  organization,
  inviter,
  link,
  locale
}: {
  organization: string;
  inviter: string;
  link: string;
  locale?: MailLocale;
}): Rendered {
  const subject = pick(
    locale,
    `${organization} sizi Support.io'ya davet etti`,
    `${organization} invited you to Support.io`
  );
  return {
    subject,
    ...layout({
      title: subject,
      lines: pick(
        locale,
        [
          `${inviter}, sizi ${organization} destek ekibine davet etti.`,
          'Daveti kabul edip kendi şifrenizi belirleyerek ekibe katılabilirsiniz.'
        ],
        [
          `${inviter} invited you to the ${organization} support team.`,
          'Accept the invitation and choose your own password to join.'
        ]
      ),
      action: pick(locale, 'Daveti kabul et', 'Accept the invitation'),
      link,
      footer: pick(
        locale,
        'Davet 7 gün geçerlidir. Beklemiyorsanız bu e-postayı yok sayın.',
        'The invitation is valid for 7 days. If you were not expecting it, ignore this e-mail.'
      )
    })
  };
}

export function missedChatMail({
  site,
  visitor,
  link,
  locale
}: {
  site: string;
  visitor: string;
  link: string;
  locale?: MailLocale;
}): Rendered {
  const subject = pick(locale, `${site}: yanıtlanmamış sohbet`, `${site}: unanswered chat`);
  return {
    subject,
    ...layout({
      title: subject,
      lines: pick(
        locale,
        [`${visitor} çevrimdışıyken bir mesaj bıraktı ve henüz yanıt almadı.`],
        [`${visitor} left a message while you were offline and has no answer yet.`]
      ),
      action: pick(locale, 'Sohbeti aç', 'Open the conversation'),
      link,
      footer: pick(
        locale,
        'Bu bildirimi ekip ayarlarınızdan kapatabilirsiniz.',
        'You can switch this notification off in your team settings.'
      )
    })
  };
}

export function quotaWarningMail({
  organization,
  used,
  limit,
  link,
  locale
}: {
  organization: string;
  used: number;
  limit: number;
  link: string;
  locale?: MailLocale;
}): Rendered {
  const subject = pick(
    locale,
    `${organization}: aylık konuşma kotanızın %80'i doldu`,
    `${organization}: 80% of this month's conversations used`
  );
  return {
    subject,
    ...layout({
      title: subject,
      lines: pick(
        locale,
        [
          `Bu ay ${limit} yeni konuşmanın ${used} tanesi kullanıldı.`,
          'Kota dolduğunda açık konuşmalar sürer, ancak yeni ziyaretçiler ay sonuna kadar sohbet başlatamaz. Kesinti yaşamamak için planınızı yükseltebilirsiniz.'
        ],
        [
          `${used} of this month's ${limit} new conversations are used.`,
          'When the quota is reached, open conversations continue but new visitors cannot start one until the month ends. Upgrade to avoid the interruption.'
        ]
      ),
      action: pick(locale, 'Planı görüntüle', 'View your plan'),
      link,
      footer: pick(
        locale,
        'Bu e-posta her ay en fazla bir kez gönderilir.',
        'This e-mail is sent at most once a month.'
      )
    })
  };
}
