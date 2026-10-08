/**
 * Kurulum rehberinin içeriği.
 *
 * Rehber kısa tutulur: bir kod, platform başına üç adım, isteğe bağlı kimlik
 * tanıtma ve birkaç sorun giderme notu. Rakiplerin kurulum sayfaları da böyle
 * — okuyan çoğu kişi yazılımcı değil, kodu yapıştırıp çıkmak istiyor.
 *
 * Buradaki HER kod örneği bu depodaki gerçek çalışma zamanına karşılık gelir:
 * `/widget.js`, `data-site-key` ve `window.SupportChat`
 * (backend/src/widget/widget.ts). Framework'e göre farklı bir kurulum kodu
 * yoktur; framework bölümleri yalnızca aynı etiketin nereye konacağını ve
 * `SupportChat.q.push` ile koddan nasıl çağrılacağını gösterir.
 *
 * Origin hiçbir zaman "localhost" olarak gösterilmez (lib/publicOrigin.ts).
 */

/**
 * The closing tag of an embed snippet, assembled rather than written whole.
 * A literal closing script tag in a file that is ever inlined into an HTML
 * `<script>` block would terminate that block early.
 */
export const CLOSE_SCRIPT = `<${'/'}script>`;

/** Okuyanın kendi anahtarıyla değiştireceği yer tutucu. */
export const KEY_PLACEHOLDER = { tr: 'SITE_ANAHTARINIZ', en: 'YOUR_SITE_KEY' };

/** Kurulum kodu her yerde aynı; tek kaynaktan üretilir. */
export const embedSnippet = (origin: string, key = KEY_PLACEHOLDER.tr) =>
  `<script\n  src="${origin}/widget.js"\n  data-site-key="${key}"\n  async>${CLOSE_SCRIPT}`;

type Lang = 'tr' | 'en';
type Text = Record<Lang, string>;

export interface Platform {
  id: string;
  label: string;
  /** Kısa, numaralı adımlar. */
  steps: Text[];
  /** Kopyalanacak kod; yoksa yalnızca kurulum kodu gösterilir. */
  code?: (origin: string, key: string, lang: Lang) => string;
  file?: string;
}

/**
 * Framework'lerin paylaştığı tek satırlık yardımcı. Script henüz yüklenmemişse
 * komut sıraya girer; yüklendiyse hemen çalışır. Sitenin kodu hangisinin
 * olduğunu bilmek zorunda kalmaz.
 */
const HELPER_JS = `export const supportChat = (...command) =>
  (window.SupportChat = window.SupportChat || { q: [] }).q.push(command);`;

const HELPER_TS = `export const supportChat = (...command: unknown[]) => {
  const w = window as unknown as { SupportChat?: { q: { push: (c: unknown[]) => void } } };
  (w.SupportChat ??= { q: [] }).q.push(command);
};`;

export const PLATFORMS: Platform[] = [
  {
    id: 'html',
    label: 'HTML',
    file: 'index.html',
    steps: [
      { tr: 'Aşağıdaki kodu kopyalayın.', en: 'Copy the code below.' },
      {
        tr: 'Sitenizin her sayfasında yer alan şablona, </body> etiketinden hemen önce yapıştırın.',
        en: 'Paste it into the template every page uses, right before the </body> tag.'
      },
      {
        tr: 'Sayfayı yenileyin; sohbet balonu sağ alt köşede belirir.',
        en: 'Reload the page; the chat bubble appears in the bottom-right corner.'
      }
    ],
    code: (origin, key, lang) => `<body>
  <!-- ${lang === 'tr' ? '... sayfanız ...' : '... your page ...'} -->

  ${embedSnippet(origin, key).split('\n').join('\n  ')}
</body>`
  },
  {
    id: 'wordpress',
    label: 'WordPress',
    steps: [
      {
        tr: 'Yönetim panelinde Eklentiler → Yeni Ekle’den “WPCode” eklentisini kurup etkinleştirin.',
        en: 'In the admin, go to Plugins → Add New, then install and activate “WPCode”.'
      },
      {
        tr: 'Code Snippets → Header & Footer sayfasını açın ve kodu “Footer” alanına yapıştırın.',
        en: 'Open Code Snippets → Header & Footer and paste the code into the “Footer” box.'
      },
      {
        tr: 'Kaydedin. Temanızı değiştirseniz de kod yerinde kalır.',
        en: 'Save. The code stays in place even if you change your theme.'
      }
    ]
  },
  {
    id: 'shopify',
    label: 'Shopify',
    steps: [
      {
        tr: 'Shopify yönetiminde Online Mağaza → Temalar’a gidin.',
        en: 'In Shopify admin, go to Online Store → Themes.'
      },
      {
        tr: 'Temanızın “…” menüsünden Kodu düzenle’yi seçip layout/theme.liquid dosyasını açın.',
        en: 'From your theme’s “…” menu choose Edit code and open layout/theme.liquid.'
      },
      {
        tr: 'Kodu </body> etiketinden hemen önce yapıştırıp kaydedin.',
        en: 'Paste the code right before </body> and save.'
      }
    ]
  },
  {
    id: 'wix',
    label: 'Wix',
    steps: [
      {
        tr: 'Wix panelinde Ayarlar → Özel Kod’u açın (ücretli plan ve bağlı alan adı gerekir).',
        en: 'In your Wix dashboard open Settings → Custom Code (needs a premium plan and a connected domain).'
      },
      {
        tr: '“+ Özel Kod Ekle”ye tıklayın ve kodu yapıştırın.',
        en: 'Click “+ Add Custom Code” and paste the code.'
      },
      {
        tr: '“Tüm sayfalar” ve “Body – end” seçeneklerini seçip uygulayın.',
        en: 'Choose “All pages” and “Body – end”, then apply.'
      }
    ]
  },
  {
    id: 'webflow',
    label: 'Webflow',
    steps: [
      {
        tr: 'Site settings → Custom code sekmesini açın.',
        en: 'Open Site settings → Custom code.'
      },
      {
        tr: 'Kodu “Footer code” alanına yapıştırıp kaydedin.',
        en: 'Paste the code into “Footer code” and save.'
      },
      { tr: 'Siteyi yeniden yayınlayın (Publish).', en: 'Publish the site again.' }
    ]
  },
  {
    id: 'gtm',
    label: 'Google Tag Manager',
    steps: [
      {
        tr: 'Etiketler → Yeni → Etiket yapılandırması → Özel HTML’i seçin.',
        en: 'Go to Tags → New → Tag configuration → Custom HTML.'
      },
      {
        tr: 'Kodu yapıştırın ve tetikleyici olarak “All Pages”i seçin.',
        en: 'Paste the code and pick “All Pages” as the trigger.'
      },
      { tr: 'Kaydedip yayınlayın (Submit → Publish).', en: 'Save, then Submit → Publish.' }
    ]
  },
  {
    id: 'react',
    label: 'React',
    file: 'src/supportChat.js  ·  src/App.jsx',
    steps: [
      {
        tr: 'Kodu index.html dosyasında (Vite’te proje kökü, Create React App’te public/) </body> etiketinden önce yapıştırın.',
        en: 'Paste the code before </body> in index.html (project root on Vite, public/ on Create React App).'
      },
      {
        tr: 'Koddan kullanmak isterseniz tek satırlık yardımcıyı ekleyin; script yüklenmemiş olsa bile çağrılar kaybolmaz.',
        en: 'To call it from code, add the one-line helper; calls made before the script loads are not lost.'
      },
      {
        tr: 'Giriş yapan kullanıcıyı tanıtın, çıkışta da logout çağırın.',
        en: 'Identify the signed-in user, and call logout when they sign out.'
      }
    ],
    code: (_origin, _key, lang) => `// src/supportChat.js
${HELPER_JS}

// src/App.jsx
import { useEffect } from 'react';
import { supportChat } from './supportChat';

export default function App({ user, onSignOut }) {
  useEffect(() => {
    if (user) supportChat('identify', { userId: user.id, name: user.name, email: user.email });
  }, [user]);

  const signOut = () => {
    supportChat('logout');
    onSignOut();
  };

  return (
    <>
      <button onClick={() => supportChat('open')}>${lang === 'tr' ? 'Bize yazın' : 'Chat with us'}</button>
      <button onClick={signOut}>${lang === 'tr' ? 'Çıkış' : 'Sign out'}</button>
    </>
  );
}`
  },
  {
    id: 'nextjs',
    label: 'Next.js',
    file: 'app/layout.tsx  ·  lib/supportChat.ts',
    steps: [
      {
        tr: 'Kök layout’a next/script ile ekleyin. Pages Router kullanıyorsanız aynı etiketi pages/_app.tsx içine koyun.',
        en: 'Add it to the root layout with next/script. On the Pages Router, put the same tag in pages/_app.tsx.'
      },
      {
        tr: '“afterInteractive” sayfanın ilk açılışını yavaşlatmaz; balon yalnızca tarayıcıda çalışır, sunucu tarafında hiçbir şey çizmez.',
        en: '“afterInteractive” does not slow the first paint; the bubble runs only in the browser and renders nothing on the server.'
      },
      {
        tr: 'Koddan çağırmak için yardımcıyı “use client” bileşenlerinde kullanın.',
        en: 'To call it from code, use the helper in “use client” components.'
      }
    ],
    code: (origin, key, lang) => `// app/layout.tsx
import Script from 'next/script';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="${lang}">
      <body>
        {children}
        <Script
          src="${origin}/widget.js"
          data-site-key="${key}"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}

// lib/supportChat.ts — ${lang === 'tr' ? '"use client" bileşenlerinden çağırın' : 'call it from "use client" components'}
${HELPER_TS}`
  },
  {
    id: 'vue',
    label: 'Vue / Nuxt',
    file: 'nuxt.config.ts  ·  src/supportChat.js',
    steps: [
      {
        tr: 'Vue (Vite): kodu index.html dosyasında </body> etiketinden önce yapıştırın.',
        en: 'Vue (Vite): paste the code before </body> in index.html.'
      },
      {
        tr: 'Nuxt 3: index.html yoktur; etiketi nuxt.config.ts içinde app.head ile ekleyin.',
        en: 'Nuxt 3 has no index.html; add the tag through app.head in nuxt.config.ts.'
      },
      {
        tr: 'Koddan çağırmak için aynı tek satırlık yardımcıyı kullanın.',
        en: 'Use the same one-line helper to call it from code.'
      }
    ],
    code: (origin, key, lang) => `// nuxt.config.ts (Nuxt 3)
export default defineNuxtConfig({
  app: {
    head: {
      script: [
        {
          src: '${origin}/widget.js',
          'data-site-key': '${key}',
          async: true,
          tagPosition: 'bodyClose'
        }
      ]
    }
  }
});

// src/supportChat.js
${HELPER_JS}

// ${lang === 'tr' ? 'Bir bileşende' : 'In a component'} (<script setup>)
import { watch } from 'vue';
import { supportChat } from '@/supportChat';

watch(user, (u) => {
  if (u) supportChat('identify', { userId: u.id, name: u.name, email: u.email });
}, { immediate: true });`
  },
  {
    id: 'angular',
    label: 'Angular',
    file: 'src/app/support-chat.service.ts',
    steps: [
      {
        tr: 'Kodu src/index.html dosyasında </body> etiketinden önce yapıştırın.',
        en: 'Paste the code before </body> in src/index.html.'
      },
      {
        tr: 'Koddan çağırmak için küçük bir servis ekleyin; sunucu tarafında (SSR) hiçbir şey yapmaz.',
        en: 'Add a small service to call it from code; it does nothing during server-side rendering.'
      },
      {
        tr: 'Girişte identify, çıkışta logout çağırın.',
        en: 'Call identify on sign-in and logout on sign-out.'
      }
    ],
    code: () => `// src/app/support-chat.service.ts
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SupportChatService {
  private run(...command: unknown[]) {
    if (typeof window === 'undefined') return;
    const w = window as unknown as { SupportChat?: { q: { push: (c: unknown[]) => void } } };
    (w.SupportChat ??= { q: [] }).q.push(command);
  }

  identify(user: { id: string; name?: string; email?: string }) {
    this.run('identify', { userId: user.id, name: user.name, email: user.email });
  }

  logout() {
    this.run('logout');
  }

  open() {
    this.run('open');
  }
}`
  }
];

/** Kimlik örneği — düz HTML sayfası için. */
export const identifySnippet = () => `<script>
  (window.SupportChat = window.SupportChat || { q: [] }).q.push(['identify', {
    userId: '42',
    name: 'Ayşe Yılmaz',
    email: 'ayse@ornek.com'
  }]);
${CLOSE_SCRIPT}`;

/** Sunucuda imza: panelde "doğrulanmış müşteri" rozeti için. */
export const userHashSnippet = (
  lang: Lang
) => `// Node.js — ${lang === 'tr' ? 'sitenizin sunucusunda; anahtar tarayıcıya asla gönderilmez' : 'on your own server; the key never reaches the browser'}
import { createHmac } from 'node:crypto';

const userHash = createHmac('sha256', process.env.SUPPORT_IDENTITY_SECRET)
  .update(String(user.id))
  .digest('hex');

// ${lang === 'tr' ? 'Sayfaya' : 'In the page'}: ['identify', { userId: user.id, name, email, userHash }]`;

/** En çok kullanılan komutlar. */
export const COMMANDS: Array<{ call: string; text: Text }> = [
  { call: "['open']", text: { tr: 'Sohbet penceresini açar.', en: 'Opens the chat window.' } },
  { call: "['close']", text: { tr: 'Pencereyi kapatır.', en: 'Closes the window.' } },
  {
    call: "['identify', { userId, name, email }]",
    text: { tr: 'Giriş yapmış kullanıcıyı tanıtır.', en: 'Identifies the signed-in user.' }
  },
  {
    call: "['logout']",
    text: {
      tr: 'Kimliği temizler; ortak bilgisayarda önceki sohbet görünmez.',
      en: 'Clears the identity, so a shared computer does not show the previous chat.'
    }
  },
  {
    call: "['setAttributes', { plan: 'pro' }]",
    text: {
      tr: 'Temsilcinin panelde göreceği bilgileri ekler.',
      en: 'Adds details your agents see in the dashboard.'
    }
  },
  {
    call: "['setLocale', 'en']",
    text: {
      tr: 'Balonun dilini değiştirir: tr veya en.',
      en: 'Switches the bubble language: tr or en.'
    }
  },
  {
    call: "['hide']  ·  ['show']",
    text: {
      tr: 'Balonu belirli sayfalarda gizler ya da yeniden gösterir.',
      en: 'Hides the bubble on certain pages or shows it again.'
    }
  },
  {
    call: "['on', 'message', (e) => …]",
    text: {
      tr: 'Ekibiniz ya da asistan yazdığında çağrılır; e.message mesajın kendisidir. Diğer olaylar: open, close, unread, ready.',
      en: 'Called when your team or the assistant writes; e.message is the message. Other events: open, close, unread, ready.'
    }
  }
];

/** Script etiketine eklenebilen seçenekler — yalnızca gerçekten kullanılanlar. */
export const OPTIONS: Array<{ attr: string; text: Text }> = [
  {
    attr: 'data-locale="en"',
    text: {
      tr: 'Dili sabitler. Verilmezse sayfanızın dili kullanılır.',
      en: 'Fixes the language. Without it, your page’s language is used.'
    }
  },
  {
    attr: 'data-position="bottom-left"',
    text: {
      tr: 'Paneldeki konumu bu sayfa için değiştirir.',
      en: 'Overrides the dashboard position on this page.'
    }
  },
  {
    attr: 'data-hidden="true"',
    text: {
      tr: 'Balon gizli başlar; ["show"] ile gösterilir.',
      en: 'The bubble starts hidden; ["show"] reveals it.'
    }
  },
  {
    attr: 'data-back-button="false"',
    text: {
      tr: 'Telefonda geri tuşu açık pencereyi kapatır; sayfanızın geçmişine dokunulmasın isterseniz kapatın.',
      en: 'On phones the back button closes the open window; turn it off to leave your page’s history alone.'
    }
  },
  {
    attr: 'data-defer="true"',
    text: {
      tr: 'Çerez onayı için: balon, siz ["init"] çağırana kadar açılmaz.',
      en: 'For cookie consent: the bubble waits until you call ["init"].'
    }
  }
];

/* ------------------------------------------------- gizlilik metni (LEG-04) */

/**
 * The paragraph a customer adds to their own privacy notice. The customer is
 * the controller of their visitors' data; the brackets are theirs to fill.
 * The AI provider is never named here (its name appears only in our own
 * sub-processor list).
 */
export const privacyParagraph = (lang: 'tr' | 'en', origin: string) =>
  lang === 'en'
    ? [
        'Live chat',
        'The chat window on this site is provided by Support.io. When you use it, the messages you write, any files you send and the name, e-mail address or phone number you choose to give are processed to answer your questions, together with the page you are on, your browser and operating system, your IP address and country.',
        '[Your company name] is the controller of this data; Support.io processes it only on our behalf and instructions. Conversations are kept for [retention period] after the last message.',
        '[If you use the AI assistant:] Some questions may be answered by an AI assistant; its answers are marked as such in the chat window and you can ask for a person at any time.',
        "The chat window keeps a few entries in your browser's local storage so the conversation continues when you change page; it sets no advertising or tracking cookies.",
        `Support.io's privacy policy: ${origin}/en/privacy`
      ].join('\n\n')
    : [
        'Canlı destek',
        'Sitemizdeki sohbet penceresi Support.io tarafından sağlanır. Sohbet penceresini kullandığınızda yazdığınız mesajlar, gönderdiğiniz dosyalar ve kendi isteğinizle verdiğiniz ad, e-posta adresi ya da telefon numarası; bulunduğunuz sayfa, tarayıcınız ve işletim sisteminiz, IP adresiniz ve ülkeniz ile birlikte sorularınızı yanıtlamak amacıyla işlenir.',
        'Bu verilerin sorumlusu [Şirket adınız]’dır; Support.io bu verileri yalnızca bizim adımıza ve talimatımızla işler. Sohbetler son mesajdan sonra [saklama süresi] boyunca saklanır.',
        '[Yapay zekâ asistanını kullanıyorsanız:] Sorularınızın bir kısmı yapay zekâ destekli bir asistan tarafından yanıtlanabilir; bu yanıtlar sohbet penceresinde ayrıca belirtilir ve dilediğiniz an bir temsilciye bağlanabilirsiniz.',
        'Sohbet penceresi, sayfa değiştirdiğinizde konuşmanın sürmesi için tarayıcınızın yerel deposunu kullanır; reklam ya da izleme çerezi kullanmaz.',
        `Support.io gizlilik politikası: ${origin}/gizlilik`
      ].join('\n\n');

/** What the chat bubble keeps in the visitor's browser (local storage only). */
export const STORAGE_KEYS: Array<{ key: string; text: Text }> = [
  {
    key: 'sc_widget_session:<site>',
    text: {
      tr: 'İmzalı ziyaretçi oturumu: sayfa değişince aynı konuşmaya dönmek için.',
      en: 'Signed visitor session: to return to the same conversation after a page change.'
    }
  },
  {
    key: 'sc_contact_<site>',
    text: {
      tr: 'İletişim formunun doldurulduğu; form tekrar sorulmasın diye.',
      en: 'That the contact form was filled in, so it is not asked again.'
    }
  },
  {
    key: 'sc_visitor_name',
    text: {
      tr: 'Ziyaretçinin kendi yazdığı ad.',
      en: 'The name the visitor typed.'
    }
  },
  {
    key: 'sc_visitor_email',
    text: {
      tr: 'Ziyaretçinin kendi yazdığı e-posta adresi.',
      en: 'The e-mail address the visitor typed.'
    }
  }
];

// ------------------------------------------------------------- webhooks

/** The events a webhook can ask for (backend services/integrations.ts). */
export const WEBHOOK_EVENTS: Array<{ name: string; text: Text }> = [
  {
    name: 'conversation.created',
    text: {
      tr: 'Ziyaretçi yeni bir konuşma başlattı; ilk mesajı da içindedir.',
      en: 'A visitor started a conversation; its first message is included.'
    }
  },
  {
    name: 'message.created',
    text: {
      tr: 'Ziyaretçi ya da ekibiniz konuşmaya yeni bir mesaj yazdı.',
      en: 'The visitor or your team wrote a new message.'
    }
  },
  {
    name: 'conversation.closed',
    text: {
      tr: 'Konuşma çözüldü ya da kapatıldı.',
      en: 'The conversation was resolved or closed.'
    }
  },
  {
    name: 'rating.created',
    text: {
      tr: 'Ziyaretçi konuşmayı 1–5 arasında puanladı.',
      en: 'The visitor rated the conversation from 1 to 5.'
    }
  }
];

/** What a webhook receives: one JSON object per event. */
export const WEBHOOK_PAYLOAD = `{
  "id": "6727a1c0e4b0f3a9d1c2b3a4",
  "event": "message.created",
  "createdAt": "2026-10-09T10:15:00.000Z",
  "data": {
    "site": { "id": "6727a0f1e4b0f3a9d1c2b100", "name": "Örnek Mağaza" },
    "conversation": {
      "id": "6727a19ee4b0f3a9d1c2b2f0",
      "ticketId": "#0042",
      "status": "open",
      "visitorName": "Ayşe",
      "visitorEmail": null
    },
    "message": {
      "id": "6727a1c0e4b0f3a9d1c2b3a5",
      "senderType": "visitor",
      "senderName": "Ayşe",
      "content": "Kargom nerede?",
      "createdAt": "2026-10-09T10:15:00.000Z"
    }
  }
}`;

/** Checking the signature in Node.js (Express), with the secret shown once. */
export const WEBHOOK_VERIFY = `import crypto from 'node:crypto';
import express from 'express';

const app = express();
const SECRET = process.env.SUPPORTIO_WEBHOOK_SECRET; // whsec_…

app.post('/supportio', express.raw({ type: 'application/json' }), (req, res) => {
  const header = req.get('X-SupportIO-Signature') || '';
  const [, t, v1] = /^t=(\\d+),v1=([0-9a-f]{64})$/.exec(header) || [];
  const expected = crypto
    .createHmac('sha256', SECRET)
    .update(t + '.' + req.body)
    .digest('hex');
  const fresh = Math.abs(Date.now() / 1000 - Number(t)) < 300;
  if (!v1 || !fresh || !crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected))) {
    return res.status(401).end();
  }
  const event = JSON.parse(req.body);
  console.log(event.event, event.data.conversation.id);
  res.status(200).end();
});`;
