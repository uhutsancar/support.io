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
  footer
}: {
  title: string;
  lines: string[];
  action: string;
  link: string;
  footer: string;
}): { text: string; html: string } {
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

/** Two-step sign-in was switched on or off, or a recovery code was used. */
export function securityNoticeMail({
  name,
  event,
  link,
  locale
}: {
  name: string;
  event: 'mfa_enabled' | 'mfa_disabled' | 'recovery_used' | 'sessions_revoked';
  link: string;
  locale?: MailLocale;
}): Rendered {
  const titles = {
    mfa_enabled: ['İki adımlı doğrulama açıldı', 'Two-step verification is on'],
    mfa_disabled: ['İki adımlı doğrulama kapatıldı', 'Two-step verification is off'],
    recovery_used: ['Bir kurtarma kodu kullanıldı', 'A recovery code was used'],
    sessions_revoked: ['Tüm cihazlardan çıkış yapıldı', 'You were signed out everywhere']
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
