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
function layout({
  title,
  lines,
  action,
  link,
  footer,
  quotes = [],
  footerLink
}: {
  title: string;
  lines: string[];
  action: string;
  link: string;
  footer: string;
  /** Messages shown as a quoted thread: who said it, and what. */
  quotes?: Array<{ who: string; text: string }>;
  /** A second, quiet link under the footer (notification settings, opt-out). */
  footerLink?: { label: string; href: string };
}): { text: string; html: string } {
  const text = [
    title,
    '',
    ...lines,
    ...(quotes.length ? ['', ...quotes.map((q) => `${q.who}: ${q.text}`)] : []),
    '',
    `${action}: ${link}`,
    '',
    footer,
    ...(footerLink ? [`${footerLink.label}: ${footerLink.href}`] : [])
  ].join('\n');
  const quoteHtml = quotes
    .map(
      (q) =>
        `<div style="margin:0 0 10px;padding:10px 12px;border-left:3px solid #c7d2fe;background:#f8fafc;border-radius:6px"><div style="font-size:12px;color:#6b7280;margin-bottom:4px">${escapeHtml(q.who)}</div><div style="font-size:14px;line-height:1.5;white-space:pre-wrap">${escapeHtml(q.text)}</div></div>`
    )
    .join('\n');
  const footerLinkHtml = footerLink
    ? `<p style="margin:8px 0 0;font-size:12px"><a href="${escapeHtml(footerLink.href)}" style="color:#6b7280">${escapeHtml(footerLink.label)}</a></p>`
    : '';
  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111827">
<table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px">
<tr><td style="padding:28px">
<h1 style="margin:0 0 16px;font-size:20px">${escapeHtml(title)}</h1>
${lines.map((l) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.5">${escapeHtml(l)}</p>`).join('\n')}
${quoteHtml}
<p style="margin:24px 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">${escapeHtml(action)}</a></p>
<p style="margin:0;font-size:12px;color:#6b7280;word-break:break-all">${escapeHtml(link)}</p>
<p style="margin:24px 0 0;font-size:12px;color:#6b7280">${escapeHtml(footer)}</p>
${footerLinkHtml}
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

/**
 * Chats nobody has answered yet (PRD-01): one, or several gathered over the
 * last minutes. `visitors` are the names, newest first.
 */
export function missedChatMail({
  site,
  visitors,
  preview,
  link,
  settingsLink,
  locale
}: {
  site: string;
  visitors: string[];
  /** The first visitor message of the newest chat, shortened. */
  preview?: string;
  link: string;
  settingsLink: string;
  locale?: MailLocale;
}): Rendered {
  const count = visitors.length;
  const subject =
    count === 1
      ? pick(locale, `${site}: yanıtlanmamış sohbet`, `${site}: unanswered chat`)
      : pick(
          locale,
          `${site}: ${count} yanıtlanmamış sohbet`,
          `${site}: ${count} unanswered chats`
        );
  const names = visitors.slice(0, 5).join(', ') + (count > 5 ? ` +${count - 5}` : '');
  return {
    subject,
    ...layout({
      title: subject,
      lines: pick(
        locale,
        [
          count === 1
            ? `${names} bir mesaj bıraktı ve henüz yanıt almadı.`
            : `${names} mesaj bıraktı ve henüz yanıt almadı.`
        ],
        [
          count === 1
            ? `${names} left a message and has no answer yet.`
            : `${names} left messages and have no answer yet.`
        ]
      ),
      quotes: preview ? [{ who: visitors[0], text: preview }] : [],
      action: pick(locale, 'Sohbeti aç', 'Open the conversation'),
      link,
      footer: pick(
        locale,
        'Bu e-postaları ayarlardan saatlik özete çevirebilir ya da kapatabilirsiniz.',
        'You can turn these into an hourly digest or switch them off in your settings.'
      ),
      footerLink: {
        label: pick(locale, 'Bildirim ayarları', 'Notification settings'),
        href: settingsLink
      }
    })
  };
}

/** An agent answered while the visitor was away (PRD-01). */
export function visitorReplyMail({
  site,
  replies,
  link,
  optOutLink,
  locale
}: {
  site: string;
  replies: Array<{ who: string; text: string }>;
  link: string;
  optOutLink: string;
  locale?: MailLocale;
}): Rendered {
  const subject = pick(locale, `${site} size yanıt verdi`, `${site} replied to you`);
  return {
    subject,
    ...layout({
      title: subject,
      lines: pick(
        locale,
        ['Sohbetten ayrıldıktan sonra mesajınıza yanıt geldi:'],
        ['You had left the chat when this answer arrived:']
      ),
      quotes: replies,
      action: pick(locale, 'Sohbete dön', 'Back to the chat'),
      link,
      footer: pick(
        locale,
        'Bu e-postayı sohbette e-posta adresinizi bıraktığınız için aldınız. Yanıt vermek için bağlantıyı kullanın; bu e-postaya verilen yanıtlar okunmaz.',
        'You got this e-mail because you left your address in the chat. Use the link to answer; replies to this e-mail are not read.'
      ),
      footerLink: {
        label: pick(
          locale,
          'Bu sohbet için e-posta almak istemiyorum',
          'Stop e-mails about this chat'
        ),
        href: optOutLink
      }
    })
  };
}

/** How was it? Sent when the visitor left before rating (PRD-04). */
export function csatRequestMail({
  site,
  link,
  locale
}: {
  site: string;
  link: string;
  locale?: MailLocale;
}): Rendered {
  const subject = pick(
    locale,
    `${site} ile görüşmenizi değerlendirin`,
    `Rate your conversation with ${site}`
  );
  return {
    subject,
    ...layout({
      title: subject,
      lines: pick(
        locale,
        ['Sohbetiniz kapandı. Yardımcı olabildik mi? Tek tıkla değerlendirebilirsiniz.'],
        ['Your conversation has ended. Did we help? It takes one click to tell us.']
      ),
      action: pick(locale, 'Değerlendir', 'Rate it'),
      link,
      footer: pick(locale, 'Bağlantı 7 gün geçerlidir.', 'The link is valid for 7 days.')
    })
  };
}

/** The whole conversation, mailed to the visitor who asked for it (PRD-06). */
export function transcriptMail({
  site,
  messages,
  link,
  locale
}: {
  site: string;
  messages: Array<{ who: string; text: string }>;
  link: string;
  locale?: MailLocale;
}): Rendered {
  const subject = pick(locale, `${site} ile sohbetinizin dökümü`, `Your chat with ${site}`);
  return {
    subject,
    ...layout({
      title: subject,
      lines: pick(
        locale,
        ['İstediğiniz sohbet dökümü aşağıda.'],
        ['Here is the transcript you asked for.']
      ),
      quotes: messages,
      action: pick(locale, 'Sohbete dön', 'Back to the chat'),
      link,
      footer: pick(
        locale,
        'Bu e-postayı sohbet sırasında siz istediğiniz için aldınız.',
        'You got this e-mail because you asked for it during the chat.'
      )
    })
  };
}

/** The set-up mails after sign-up and the first sight of the widget (PRD-08). */
export function activationMail({
  step,
  name,
  link,
  settingsLink,
  locale
}: {
  step: 'welcome' | 'install_reminder' | 'faq_assistant' | 'invite_team' | 'widget_live';
  name: string;
  link: string;
  settingsLink: string;
  locale?: MailLocale;
}): Rendered {
  const copy = {
    welcome: {
      subject: ['Support.io hesabınız hazır', 'Your Support.io account is ready'],
      lines: [
        [
          `Merhaba ${name},`,
          'Sohbet balonunu sitenize eklemek için tek satırlık kurulum kodunu kopyalayıp sitenizin <head> bölümüne yapıştırın. WordPress, Shopify ve diğer altyapılar için adımlar panelde.'
        ],
        [
          `Hi ${name},`,
          'To put the chat bubble on your site, copy the one-line install code into your site’s <head>. The steps for WordPress, Shopify and the rest are in the panel.'
        ]
      ],
      action: ['Kurulum kodunu al', 'Get the install code']
    },
    install_reminder: {
      subject: [
        'Sohbet balonunuz henüz sitenizde değil',
        'Your chat bubble is not on your site yet'
      ],
      lines: [
        [
          `Merhaba ${name},`,
          'Kurulum kodunu henüz bir sayfada görmedik. Kodu ekledikten sonra panel bunu kendiliğinden fark eder; takıldığınız yerde sohbetten bize yazabilirsiniz.'
        ],
        [
          `Hi ${name},`,
          'We have not seen the install code on a page yet. Once you add it, the panel notices by itself; if you get stuck, write to us in the chat.'
        ]
      ],
      action: ['Kurulum adımları', 'Installation steps']
    },
    faq_assistant: {
      subject: [
        'Sık sorulan soruları yapay zekâ asistanı yanıtlasın',
        'Let the AI assistant answer the common questions'
      ],
      lines: [
        [
          `Merhaba ${name},`,
          'SSS sayfanıza birkaç soru ekleyin ve yapay zekâ asistanını açın: ziyaretçilerin sık sorduğu sorular siz çevrimdışıyken de yanıtlanır, gerisi ekibinize aktarılır.'
        ],
        [
          `Hi ${name},`,
          'Add a few questions to your FAQ page and switch on the AI assistant: common questions get answered even while you are offline, the rest goes to your team.'
        ]
      ],
      action: ['SSS ekle', 'Add FAQs']
    },
    invite_team: {
      subject: ['Ekibinizi davet edin', 'Invite your team'],
      lines: [
        [
          `Merhaba ${name},`,
          'Sohbetleri tek başınıza karşılamak zorunda değilsiniz. Ekip arkadaşlarınızı davet edin; konuşmalar aralarında otomatik dağıtılır.'
        ],
        [
          `Hi ${name},`,
          'You do not have to answer every chat yourself. Invite your teammates; conversations are shared out among them automatically.'
        ]
      ],
      action: ['Ekip arkadaşı davet et', 'Invite a teammate']
    },
    widget_live: {
      subject: ['Sohbet balonunuz yayında', 'Your chat bubble is live'],
      lines: [
        [
          `Tebrikler ${name},`,
          'Kurulum kodunu sitenizde gördük. Bir test mesajı gönderip panelde nasıl düştüğüne bakın.'
        ],
        [
          `Congratulations ${name},`,
          'We have seen the install code on your site. Send a test message and watch it arrive in the panel.'
        ]
      ],
      action: ['Paneli aç', 'Open the panel']
    }
  }[step];
  const subject = pick(locale, copy.subject[0], copy.subject[1]);
  return {
    subject,
    ...layout({
      title: subject,
      lines: pick(locale, copy.lines[0], copy.lines[1]),
      action: pick(locale, copy.action[0], copy.action[1]),
      link,
      footer: pick(
        locale,
        'Bu e-postalar yalnızca hesabınızın kurulumuyla ilgilidir.',
        'These e-mails are only about setting up your account.'
      ),
      footerLink: {
        label: pick(locale, 'Kurulum e-postalarını kapat', 'Turn off set-up e-mails'),
        href: settingsLink
      }
    })
  };
}

/** The figures of one week, for the weekly report mail (PRD-22). */
export interface WeeklyFigures {
  conversations: number;
  resolved: number;
  avgFirstResponseMinutes: number | null;
  slaPercent: number | null;
  csat: number | null;
  rated: number;
  assistantAnswered: number;
  busiestHour: number | null;
  topAgent: { name: string; resolved: number } | null;
}

/** Monday's summary of the last seven days for the workspace's managers. */
export function weeklyReportMail({
  name,
  workspace,
  figures,
  link,
  settingsLink,
  locale
}: {
  name: string;
  workspace: string;
  figures: WeeklyFigures;
  link: string;
  settingsLink: string;
  locale?: MailLocale;
}): Rendered {
  const en = locale === 'en';
  const minutes = (m: number | null) =>
    m === null
      ? '—'
      : m < 60
        ? `${m} ${en ? 'min' : 'dk'}`
        : `${Math.round(m / 6) / 10} ${en ? 'h' : 'sa'}`;
  const hour = (h: number | null) =>
    h === null
      ? '—'
      : `${String(h).padStart(2, '0')}:00–${String((h + 1) % 24).padStart(2, '0')}:00`;
  const rows: Array<[string, string, string]> = [
    ['Konuşma', 'Conversations', String(figures.conversations)],
    ['Çözülen', 'Resolved', String(figures.resolved)],
    ['Ortalama ilk yanıt', 'Average first response', minutes(figures.avgFirstResponseMinutes)],
    [
      'Zamanında ilk yanıt (SLA)',
      'First answers on time (SLA)',
      figures.slaPercent === null ? '—' : `%${figures.slaPercent}`
    ],
    [
      'Memnuniyet',
      'Satisfaction',
      figures.csat === null
        ? '—'
        : `${figures.csat} / 5 (${figures.rated} ${en ? 'ratings' : 'puan'})`
    ],
    [
      'Asistanın yanıtladığı konuşma',
      'Conversations the assistant answered',
      String(figures.assistantAnswered)
    ],
    ['En yoğun saat', 'Busiest hour', hour(figures.busiestHour)],
    [
      'En çok çözen',
      'Most resolved',
      figures.topAgent ? `${figures.topAgent.name} (${figures.topAgent.resolved})` : '—'
    ]
  ];
  const subject = pick(
    locale,
    `${workspace}: geçen haftanın özeti`,
    `${workspace}: last week in short`
  );
  return {
    subject,
    ...layout({
      title: subject,
      lines: pick(
        locale,
        [`Merhaba ${name},`, 'Son yedi günde sohbetlerinizde olanlar:'],
        [`Hi ${name},`, 'What happened in your chats over the last seven days:']
      ),
      quotes: rows.map(([tr, english, value]) => ({ who: en ? english : tr, text: value })),
      action: pick(locale, 'Raporların tamamı', 'The full reports'),
      link,
      footer: pick(
        locale,
        'Bu e-posta her pazartesi hesabın sahibine ve yöneticilerine gider.',
        'This e-mail goes to the account owner and managers every Monday.'
      ),
      footerLink: {
        label: pick(locale, 'Haftalık raporu kapat', 'Turn off the weekly report'),
        href: settingsLink
      }
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

/**
 * Someone tried to sign up with an address that already has an account. The
 * sign-up form answers exactly as for a new address (plan v10 SEC-06), so
 * the owner of the address is the only one told.
 */
export function existingAccountMail({
  name,
  link,
  locale
}: {
  name: string;
  link: string;
  locale?: MailLocale;
}): Rendered {
  const subject = pick(locale, 'Bu adresle zaten bir hesabınız var', 'You already have an account');
  return {
    subject,
    ...layout({
      title: subject,
      lines: pick(
        locale,
        [
          `Merhaba ${name},`,
          'Biri bu e-posta adresiyle yeni bir Support.io hesabı açmaya çalıştı. Bu adresle zaten bir hesabınız olduğu için yeni hesap açılmadı.',
          'Siz denediyseniz giriş yapabilir ya da şifrenizi hatırlamıyorsanız sıfırlayabilirsiniz.'
        ],
        [
          `Hi ${name},`,
          'Someone tried to create a new Support.io account with this e-mail address. You already have one, so no new account was opened.',
          'If it was you, sign in, or reset your password if you have forgotten it.'
        ]
      ),
      action: pick(locale, 'Giriş yap', 'Sign in'),
      link,
      footer: pick(
        locale,
        'Bu siz değilseniz bir şey yapmanız gerekmez; hesabınız değişmedi.',
        'If this was not you, there is nothing to do; your account is unchanged.'
      )
    })
  };
}

/** The password of the account was changed from the settings page. */
export function passwordChangedMail({
  name,
  link,
  locale
}: {
  name: string;
  link: string;
  locale?: MailLocale;
}): Rendered {
  const subject = pick(locale, 'Şifreniz değiştirildi', 'Your password was changed');
  return {
    subject,
    ...layout({
      title: subject,
      lines: pick(
        locale,
        [
          `Merhaba ${name},`,
          'Support.io hesabınızın şifresi az önce değiştirildi. Diğer tüm cihazlardaki oturumlarınız kapatıldı.'
        ],
        [
          `Hi ${name},`,
          'The password of your Support.io account was just changed. You were signed out on every other device.'
        ]
      ),
      action: pick(
        locale,
        'Bu ben değildim — şifremi sıfırla',
        'This was not me — reset my password'
      ),
      link,
      footer: pick(
        locale,
        'Değişikliği siz yaptıysanız bu e-postayı yok sayabilirsiniz.',
        'If you made this change, you can ignore this e-mail.'
      )
    })
  };
}

/** Confirms a new address before it replaces the account's current one. */
export function emailChangeMail({
  name,
  link,
  locale
}: {
  name: string;
  link: string;
  locale?: MailLocale;
}): Rendered {
  const subject = pick(
    locale,
    'Yeni e-posta adresinizi onaylayın',
    'Confirm your new e-mail address'
  );
  return {
    subject,
    ...layout({
      title: subject,
      lines: pick(
        locale,
        [
          `Merhaba ${name},`,
          'Support.io hesabınızın e-posta adresini bu adresle değiştirmek istediniz. Onayladığınızda girişler ve bildirimler bu adrese geçer.'
        ],
        [
          `Hi ${name},`,
          'You asked to move your Support.io account to this address. Once you confirm, sign-in and notifications use it.'
        ]
      ),
      action: pick(locale, 'Adresi onayla', 'Confirm the address'),
      link,
      footer: pick(
        locale,
        'Bağlantı 24 saat geçerlidir. Siz istemediyseniz bu e-postayı yok sayın; hesap değişmez.',
        'The link is valid for 24 hours. If you did not ask for this, ignore this e-mail; the account stays as it is.'
      )
    })
  };
}

/**
 * Sent to the old address: a change was asked for, or made. `changed` says
 * which.
 */
export function emailChangeNoticeMail({
  name,
  newEmail,
  changed,
  link,
  locale
}: {
  name: string;
  newEmail: string;
  changed: boolean;
  link: string;
  locale?: MailLocale;
}): Rendered {
  const subject = changed
    ? pick(locale, 'E-posta adresiniz değiştirildi', 'Your e-mail address was changed')
    : pick(locale, 'E-posta değişikliği istendi', 'An e-mail change was requested');
  return {
    subject,
    ...layout({
      title: subject,
      lines: pick(
        locale,
        [
          `Merhaba ${name},`,
          changed
            ? `Support.io hesabınızın e-posta adresi ${newEmail} olarak değiştirildi.`
            : `Support.io hesabınızın e-posta adresini ${newEmail} olarak değiştirmek için bir istek yapıldı. Yeni adres onaylanana kadar bu adres geçerlidir.`
        ],
        [
          `Hi ${name},`,
          changed
            ? `The e-mail address of your Support.io account is now ${newEmail}.`
            : `Someone asked to move your Support.io account to ${newEmail}. This address stays in use until the new one is confirmed.`
        ]
      ),
      action: pick(
        locale,
        'Bu ben değildim — şifremi sıfırla',
        'This was not me — reset my password'
      ),
      link,
      footer: pick(
        locale,
        'Değişikliği siz istediyseniz bu e-postayı yok sayabilirsiniz.',
        'If you asked for this change, you can ignore this e-mail.'
      )
    })
  };
}

/** Two-step sign-in was switched on or off, a recovery code was used, a Google account was connected. */
export function securityNoticeMail({
  name,
  event,
  link,
  locale
}: {
  name: string;
  event: 'mfa_enabled' | 'mfa_disabled' | 'recovery_used' | 'sessions_revoked' | 'google_linked';
  link: string;
  locale?: MailLocale;
}): Rendered {
  const titles = {
    mfa_enabled: ['İki adımlı doğrulama açıldı', 'Two-step verification is on'],
    mfa_disabled: ['İki adımlı doğrulama kapatıldı', 'Two-step verification is off'],
    recovery_used: ['Bir kurtarma kodu kullanıldı', 'A recovery code was used'],
    sessions_revoked: ['Tüm cihazlardan çıkış yapıldı', 'You were signed out everywhere'],
    google_linked: [
      'Hesabınıza Google ile giriş eklendi',
      'Google sign-in was added to your account'
    ]
  } as const;
  const bodies = {
    mfa_enabled: [
      'Hesabınıza girişte artık doğrulama uygulamanızdaki kod da istenecek.',
      'Signing in to your account now also asks for the code from your authenticator app.'
    ],
    mfa_disabled: [
      'Hesabınıza girişte artık yalnızca şifre isteniyor.',
      'Signing in to your account now asks only for the password.'
    ],
    recovery_used: [
      'Hesabınıza bir kurtarma koduyla giriş yapıldı. Kalan kodlarınızı ve doğrulama uygulamanızı kontrol edin.',
      'Someone signed in to your account with a recovery code. Check your remaining codes and your authenticator app.'
    ],
    sessions_revoked: [
      'Hesabınızın açık olduğu tüm cihazlarda oturum kapatıldı.',
      'Every session of your account was ended, on every device.'
    ],
    google_linked: [
      'Hesabınıza bir Google hesabı bağlandı; artık onunla da giriş yapılabilir. Bağlantıyı Ayarlar → Güvenlik bölümünden kaldırabilirsiniz.',
      'A Google account was connected to your account and can now be used to sign in. You can remove it under Settings → Security.'
    ]
  } as const;
  const [titleTr, titleEn] = titles[event];
  const [bodyTr, bodyEn] = bodies[event];
  const subject = pick(locale, titleTr, titleEn);
  return {
    subject,
    ...layout({
      title: subject,
      lines: pick(locale, [`Merhaba ${name},`, bodyTr], [`Hi ${name},`, bodyEn]),
      action: pick(
        locale,
        'Bu ben değildim — şifremi sıfırla',
        'This was not me — reset my password'
      ),
      link,
      footer: pick(
        locale,
        'Bu işlemi siz yaptıysanız bu e-postayı yok sayabilirsiniz.',
        'If you did this, you can ignore this e-mail.'
      )
    })
  };
}

/** The Pro trial ends in a few days. */
export function trialEndingMail({
  name,
  daysLeft,
  link,
  locale
}: {
  name: string;
  daysLeft: number;
  link: string;
  locale?: MailLocale;
}): Rendered {
  const subject = pick(
    locale,
    `Pro deneme sürenizin bitmesine ${daysLeft} gün kaldı`,
    `Your Pro trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`
  );
  return {
    subject,
    ...layout({
      title: subject,
      lines: pick(
        locale,
        [
          `Merhaba ${name},`,
          'Deneme bittiğinde hesabınız Ücretsiz plana geçer: konuşmalarınız ve ayarlarınız silinmez, yalnızca Pro özellikleri kilitlenir.',
          'Kesinti yaşamamak için şimdi Pro’ya geçebilirsiniz.'
        ],
        [
          `Hi ${name},`,
          'When the trial ends your workspace moves to the Free plan: your conversations and settings stay, only the Pro features lock.',
          'Upgrade now to keep everything running without a break.'
        ]
      ),
      action: pick(locale, 'Planı seç', 'Choose a plan'),
      link,
      footer: pick(
        locale,
        'Kart bilgisi istemedik; otomatik ücret alınmaz.',
        'We never asked for a card; nothing is charged automatically.'
      )
    })
  };
}

/** The Pro trial has ended; the workspace is on Free. */
export function trialEndedMail({
  name,
  link,
  locale
}: {
  name: string;
  link: string;
  locale?: MailLocale;
}): Rendered {
  const subject = pick(locale, 'Pro deneme süreniz bitti', 'Your Pro trial has ended');
  return {
    subject,
    ...layout({
      title: subject,
      lines: pick(
        locale,
        [
          `Merhaba ${name},`,
          'Hesabınız Ücretsiz plana geçti. Verileriniz yerinde; Pro özelliklerini yeniden açmak için planınızı yükseltebilirsiniz.'
        ],
        [
          `Hi ${name},`,
          'Your workspace is on the Free plan now. Your data is all there; upgrade to switch the Pro features back on.'
        ]
      ),
      action: pick(locale, 'Pro’ya geç', 'Upgrade to Pro'),
      link,
      footer: pick(locale, 'Bu e-posta bir kez gönderilir.', 'This e-mail is sent once.')
    })
  };
}

/** Sites or seats went past a smaller plan and were suspended (BIL-04). */
export function planOverageMail({
  name,
  organization,
  sites,
  seats,
  link,
  locale
}: {
  name: string;
  organization: string;
  sites: number;
  seats: number;
  link: string;
  locale?: MailLocale;
}): Rendered {
  const subject = pick(
    locale,
    `${organization}: plan limitinin üzerindeki kayıtlar askıya alındı`,
    `${organization}: what is over your plan's limit is on hold`
  );
  const what = pick(
    locale,
    [sites ? `${sites} site` : '', seats ? `${seats} ekip üyesi` : ''].filter(Boolean).join(' ve '),
    [
      sites ? `${sites} site${sites > 1 ? 's' : ''}` : '',
      seats ? `${seats} seat${seats > 1 ? 's' : ''}` : ''
    ]
      .filter(Boolean)
      .join(' and ')
  );
  return {
    subject,
    ...layout({
      title: subject,
      lines: pick(
        locale,
        [
          `Merhaba ${name},`,
          `Yeni planınız daha az site ve ekip üyesi içeriyor, bu yüzden ${what} askıya alındı. Hiçbir veri silinmedi.`,
          'Askıdaki sitelerde sohbet balonu görünmez; askıdaki ekip üyeleri giriş yapıp okuyabilir ama yanıt yazamaz. Hangilerinin açık kalacağını faturalandırma sayfasından seçebilir ya da planınızı yükselterek hepsini geri açabilirsiniz.'
        ],
        [
          `Hi ${name},`,
          `Your new plan includes fewer sites and seats, so ${what} ${sites + seats > 1 ? 'are' : 'is'} now on hold. Nothing has been deleted.`,
          'The chat bubble stays hidden on sites on hold; members on hold can sign in and read but cannot reply. Choose which ones stay active on the billing page, or upgrade to bring them all back.'
        ]
      ),
      action: pick(locale, 'Seçimi yap', 'Choose what stays active'),
      link,
      footer: pick(
        locale,
        'Bu e-postayı çalışma alanınızın planı değiştiği için aldınız.',
        'You received this because your workspace plan changed.'
      )
    })
  };
}

/** A payment failed: what happens to the workspace, and by when (BIL-05). */
export function paymentFailedMail({
  name,
  organization,
  graceEndsAt,
  link,
  locale
}: {
  name: string;
  organization: string;
  graceEndsAt: Date;
  link: string;
  locale?: MailLocale;
}): Rendered {
  const date = graceEndsAt.toLocaleDateString(locale === 'en' ? 'en-GB' : 'tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Istanbul'
  });
  const subject = pick(
    locale,
    `${organization}: ödemeniz alınamadı`,
    `${organization}: your payment did not go through`
  );
  return {
    subject,
    ...layout({
      title: subject,
      lines: pick(
        locale,
        [
          `Merhaba ${name},`,
          `Aboneliğinizin son ödemesi alınamadı. Planınız ${date} tarihine kadar açık kalıyor; bu tarihe kadar ödeme yönteminizi güncellerseniz hiçbir şey değişmez.`,
          'Güncellenmezse çalışma alanınız Ücretsiz plana geçer. Verileriniz silinmez; planın üzerindeki siteler ve ekip üyeleri askıya alınır.'
        ],
        [
          `Hi ${name},`,
          `The latest payment for your subscription did not go through. Your plan stays on until ${date}; update your payment method before then and nothing changes.`,
          'If it is not updated, the workspace moves to the Free plan. Nothing is deleted; sites and members over the Free plan go on hold.'
        ]
      ),
      action: pick(locale, 'Ödeme yöntemini güncelle', 'Update payment method'),
      link,
      footer: pick(
        locale,
        'Bu e-posta her başarısız ödemede bir kez gönderilir.',
        'This e-mail is sent once for each failed payment.'
      )
    })
  };
}
