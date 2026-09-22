/**
 * Geliştirici dokümantasyonunun içeriği.
 *
 * Buradaki HER kod örneği çalışan gerçek API'yi anlatır. Eski dokümantasyon
 * sayfası şunu gösteriyordu:
 *
 *     window.supportioConfig = { siteId: "..." }
 *     <script src="https://cdn.support.io/widget/v1/core.js">
 *
 * Bu adres yok, bu global yok, bu alan adı yok. Kopyalayan hiç kimsede
 * çalışmazdı. Gerçek yüzey: `data-site-key` niteliği, sunucunun kendi
 * origin'inden `/widget.js` ve `window.SupportChat`.
 *
 * Ana ilke: FRAMEWORK'E GÖRE FARKLI EMBED KODU YOKTUR. Aşağıdaki framework
 * bölümleri yalnızca AYNI script etiketinin o framework'te nereye konacağını
 * anlatır.
 */

export const SECTIONS = [
  'quickstart',
  'embed',
  'api',
  'events',
  'identify',
  'spa',
  'frameworks',
  'backend',
  'theming',
  'localization',
  'security',
  'troubleshooting',
  'reference'
];

/** Kurulum kodu her yerde aynı; tek kaynaktan üretilir. */
export const embedSnippet = (origin: string, siteKey = 'YOUR_SITE_KEY') =>
  `<script\n  src="${origin}/widget.js"\n  data-site-key="${siteKey}"\n  async><\/script>`;

export const FRAMEWORKS = [
  {
    id: 'html',
    label: 'HTML',
    file: 'index.html',
    lang: 'html',
    code: (origin: string, key: string) => `<!doctype html>
<html>
  <head>
    <title>My site</title>
  </head>
  <body>
    <!-- ... sayfanız ... -->

    <!-- </body> etiketinden hemen önce -->
    ${embedSnippet(origin, key).split('\n').join('\n    ')}
  </body>
</html>`
  },
  {
    id: 'react',
    label: 'React',
    file: 'public/index.html  ·  src/App.jsx',
    lang: 'jsx',
    code: (origin: string, key: string) => `// 1) En basit yol: public/index.html içine script etiketini koyun.
//    Widget kendi kendini başlatır, React'in haberi olmasına gerek yoktur.

// 2) Kullanıcı oturumuna bağlamak isterseniz:
import { useEffect } from 'react';

export default function App({ currentUser }) {
  useEffect(() => {
    if (!window.SupportChat) return;

    if (currentUser) {
      window.SupportChat.identify({
        userId: currentUser.id,
        name: currentUser.name,
        email: currentUser.email
      });
    } else {
      window.SupportChat.logout();
    }
  }, [currentUser]);

  return <YourApp />;
}

// NOT: SupportChat.init() çağırmanız GEREKMEZ ve React 18 Strict Mode'da
// effect iki kez çalışsa bile ikinci bir widget oluşmaz — runtime singleton'dır.`
  },
  {
    id: 'nextjs',
    label: 'Next.js',
    file: 'app/layout.tsx  (App Router)',
    lang: 'tsx',
    code: (origin: string, key: string) => `import Script from 'next/script';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
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

// Pages Router kullanıyorsanız aynı <Script> etiketini pages/_app.tsx içine koyun.
//
// SSR notu: widget yalnızca tarayıcıda çalışır ve DOM'a kendisi bağlanır;
// sunucu tarafında hiçbir şey render etmez, bu yüzden hydration uyuşmazlığı
// üretmez. next/script "afterInteractive" ile ilk boyamayı geciktirmez.`
  },
  {
    id: 'vue',
    label: 'Vue',
    file: 'index.html  ·  App.vue',
    lang: 'vue',
    code: (origin: string, key: string) => `<!-- index.html içine script etiketini koymak yeterlidir. -->

<!-- Kullanıcıyı tanıtmak için: -->
<script setup>
import { onMounted, onUnmounted, watch } from 'vue';

const props = defineProps({ user: Object });

watch(() => props.user, (user) => {
  if (!window.SupportChat) return;
  user ? window.SupportChat.identify(user) : window.SupportChat.logout();
}, { immediate: true });
</script>`
  },
  {
    id: 'nuxt',
    label: 'Nuxt',
    file: 'plugins/support-chat.client.ts',
    lang: 'ts',
    code: (origin: string, key: string) => `// .client.ts uzantısı önemlidir: eklenti yalnızca tarayıcıda çalışır.
export default defineNuxtPlugin(() => {
  const script = document.createElement('script');
  script.src = '${origin}/widget.js';
  script.async = true;
  script.dataset.siteKey = '${key}';
  document.body.appendChild(script);
});

// Alternatif: nuxt.config.ts içinde
// app: { head: { script: [{ src: '${origin}/widget.js', async: true,
//   'data-site-key': '${key}' }] } }`
  },
  {
    id: 'angular',
    label: 'Angular',
    file: 'src/index.html  ·  app.component.ts',
    lang: 'ts',
    code: (origin: string, key: string) => `<!-- src/index.html, </body> öncesi -->
<script src="${origin}/widget.js" data-site-key="${key}" async></script>

// Kullanıcı oturumuna bağlamak için:
import { Component, OnInit } from '@angular/core';

declare global {
  interface Window { SupportChat?: any }
}

@Component({ selector: 'app-root', template: '<router-outlet/>' })
export class AppComponent implements OnInit {
  ngOnInit() {
    this.auth.user$.subscribe((user) => {
      if (!window.SupportChat) return;
      user ? window.SupportChat.identify(user) : window.SupportChat.logout();
    });
  }
}`
  },
  {
    id: 'svelte',
    label: 'Svelte',
    file: 'src/app.html  ·  +layout.svelte',
    lang: 'svelte',
    code: (origin: string, key: string) => `<!-- SvelteKit: src/app.html içinde %sveltekit.body% sonrasına -->
<script src="${origin}/widget.js" data-site-key="${key}" async></script>

<!-- Ya da src/routes/+layout.svelte içinde: -->
<script>
  import { onMount } from 'svelte';

  onMount(() => {
    const script = document.createElement('script');
    script.src = '${origin}/widget.js';
    script.async = true;
    script.dataset.siteKey = '${key}';
    document.body.appendChild(script);

    // SvelteKit istemci-taraflı gezinmede layout'u yeniden mount etmez,
    // ama HMR sırasında etmesi mümkündür: temizlik güvenli tarafta kalır.
    return () => window.SupportChat?.destroy();
  });
</script>`
  },
  {
    id: 'astro',
    label: 'Astro',
    file: 'src/layouts/Layout.astro',
    lang: 'astro',
    code: (origin: string, key: string) => `---
// Layout.astro
---
<html lang="tr">
  <body>
    <slot />
    <script src="${origin}/widget.js" data-site-key="${key}" async is:inline></script>
  </body>
</html>

<!-- is:inline ÖNEMLİ: Astro varsayılan olarak script'leri toplar ve
     yeniden yazar; is:inline etiketi olduğu gibi bırakır, böylece
     data-site-key niteliği ve script'in kendi src'si korunur. -->`
  },
  {
    id: 'wordpress',
    label: 'WordPress',
    file: 'functions.php',
    lang: 'php',
    code: (origin: string, key: string) => `<?php
// Alt temanızın functions.php dosyasına ekleyin.
add_action('wp_footer', function () {
    ?>
    <script src="<?php echo esc_url('${origin}/widget.js'); ?>"
            data-site-key="<?php echo esc_attr('${key}'); ?>"
            async></script>
    <?php
});

// Oturum açmış kullanıcıyı otomatik tanıtmak isterseniz:
add_action('wp_footer', function () {
    if (!is_user_logged_in()) return;
    $user = wp_get_current_user();
    ?>
    <script>
      window.SupportChat && window.SupportChat.identify({
        userId: <?php echo json_encode((string) $user->ID); ?>,
        name:   <?php echo json_encode($user->display_name); ?>,
        email:  <?php echo json_encode($user->user_email); ?>
      });
    </script>
    <?php
}, 20);`
  },
  {
    id: 'laravel',
    label: 'Laravel',
    file: 'resources/views/layouts/app.blade.php',
    lang: 'blade',
    code: (origin: string, key: string) => `{{-- </body> etiketinden hemen önce --}}
<script src="{{ config('services.support_chat.url') }}/widget.js"
        data-site-key="{{ config('services.support_chat.key') }}"
        async></script>

@auth
<script>
  window.SupportChat && window.SupportChat.identify({
    userId: @json((string) auth()->id()),
    name:   @json(auth()->user()->name),
    email:  @json(auth()->user()->email)
  });
</script>
@endauth

{{-- config/services.php
'support_chat' => [
    'url' => env('SUPPORT_CHAT_URL', '${origin}'),
    'key' => env('SUPPORT_CHAT_KEY'),
],
--}}`
  },
  {
    id: 'php',
    label: 'PHP',
    file: 'footer.php',
    lang: 'php',
    code: (origin: string, key: string) => `<?php
$supportChatUrl = getenv('SUPPORT_CHAT_URL') ?: '${origin}';
$supportChatKey = getenv('SUPPORT_CHAT_KEY') ?: '${key}';
?>
<script src="<?= htmlspecialchars($supportChatUrl, ENT_QUOTES) ?>/widget.js"
        data-site-key="<?= htmlspecialchars($supportChatKey, ENT_QUOTES) ?>"
        async></script>`
  },
  {
    id: 'shopify',
    label: 'Shopify',
    file: 'layout/theme.liquid',
    lang: 'liquid',
    code: (origin: string, key: string) => `{%- comment -%} </body> etiketinden hemen önce {%- endcomment -%}
<script src="${origin}/widget.js" data-site-key="${key}" async></script>

{%- if customer -%}
<script>
  window.SupportChat && window.SupportChat.identify({
    userId: {{ customer.id | json }},
    name:   {{ customer.name | json }},
    email:  {{ customer.email | json }}
  });
  window.SupportChat && window.SupportChat.setAttributes({
    ordersCount: {{ customer.orders_count | json }},
    totalSpent:  {{ customer.total_spent | money_without_currency | json }}
  });
</script>
{%- endif -%}`
  }
];

export const API_METHODS = [
  { sig: 'SupportChat.init(options?)', tr: 'Widget’ı başlatır. Script etiketi bunu kendisi çağırır; yalnızca `data-defer` kullandıysanız gerekir.', en: 'Boots the widget. The script tag calls this itself; only needed when you used `data-defer`.' },
  { sig: 'SupportChat.open()', tr: 'Sohbet penceresini açar.', en: 'Opens the chat window.' },
  { sig: 'SupportChat.close()', tr: 'Pencereyi kapatır, launcher kalır.', en: 'Closes the window, the launcher stays.' },
  { sig: 'SupportChat.toggle()', tr: 'Açıksa kapatır, kapalıysa açar.', en: 'Toggles the window.' },
  { sig: 'SupportChat.show()', tr: 'Widget’ı görünür yapar.', en: 'Makes the widget visible.' },
  { sig: 'SupportChat.hide()', tr: 'Widget’ı tamamen gizler (launcher dahil).', en: 'Hides the widget entirely, launcher included.' },
  { sig: 'SupportChat.identify(user)', tr: 'Oturum açmış kullanıcıyı tanıtır: `{ userId, name, email, avatar }`.', en: 'Identifies the signed-in user: `{ userId, name, email, avatar }`.' },
  { sig: 'SupportChat.logout()', tr: 'Kimliği temizler ve YENİ bir ziyaretçi kimliği üretir. Ortak bilgisayarda sohbet geçmişinin sızmaması için şarttır.', en: 'Clears the identity and mints a NEW visitor id. Required so a shared computer does not leak the previous chat.' },
  { sig: 'SupportChat.setAttributes(attrs)', tr: 'Serbest biçimli özellikler ekler: `{ plan: "pro", mrr: 249 }`. Temsilci panelinde görünür.', en: 'Attaches free-form attributes: `{ plan: "pro", mrr: 249 }`. Visible to agents.' },
  { sig: 'SupportChat.setLocale(locale)', tr: '`"tr"` veya `"en"`. Widget metinlerini anında değiştirir, sohbeti korur.', en: '`"tr"` or `"en"`. Swaps the widget copy instantly, keeps the thread.' },
  { sig: 'SupportChat.setTheme(theme)', tr: '`"light"`, `"dark"` veya `"auto"` (sistem tercihini izler).', en: '`"light"`, `"dark"` or `"auto"` (follows the system preference).' },
  { sig: 'SupportChat.on(event, handler)', tr: 'Olay dinler; aboneliği iptal eden bir fonksiyon döndürür.', en: 'Subscribes to an event; returns an unsubscribe function.' },
  { sig: 'SupportChat.off(event, handler?)', tr: 'Dinleyiciyi kaldırır. Handler verilmezse o olayın tüm dinleyicileri gider.', en: 'Removes a listener. Without a handler, every listener for that event goes.' },
  { sig: 'SupportChat.destroy()', tr: 'Widget’ı söker: DOM, soket, zamanlayıcılar ve history sarmalayıcısı geri alınır.', en: 'Tears the widget down: DOM, socket, timers and the history patch are all reverted.' },
  { sig: 'SupportChat.debug()', tr: 'Tanılama nesnesi döndürür: sürüm, bağlantı durumu, site anahtarı, ziyaretçi kimliği, ölümcül hata.', en: 'Returns a diagnostics object: version, connection state, site key, visitor id, fatal error.' },
  { sig: 'SupportChat.version', tr: 'Çalışan SDK sürümü.', en: 'The running SDK version.' }
];

export const EVENTS = [
  { name: 'ready', payload: '{ siteKey, locale, version }', tr: 'Widget yüklendi ve çizildi.', en: 'The widget loaded and rendered.' },
  { name: 'open', payload: '{}', tr: 'Pencere açıldı.', en: 'The window opened.' },
  { name: 'close', payload: '{}', tr: 'Pencere kapandı.', en: 'The window closed.' },
  { name: 'message', payload: '{ message }', tr: 'Yeni bir mesaj alındı (temsilci, bot veya sistem).', en: 'A message arrived (agent, bot or system).' },
  { name: 'message:sent', payload: '{ content, clientMessageId }', tr: 'Ziyaretçi bir mesaj gönderdi.', en: 'The visitor sent a message.' },
  { name: 'conversation:ready', payload: '{ conversationId }', tr: 'Konuşma açıldı veya mevcut konuşmaya bağlanıldı.', en: 'A conversation opened or was rejoined.' },
  { name: 'connection', payload: '{ state, detail }', tr: 'Soket durumu değişti: connecting / connected / reconnecting / disconnected / error.', en: 'Socket state changed: connecting / connected / reconnecting / disconnected / error.' },
  { name: 'unread', payload: '{ count }', tr: 'Okunmamış sayısı değişti.', en: 'The unread count changed.' },
  { name: 'identify', payload: '{ user }', tr: 'Kullanıcı tanıtıldı.', en: 'A user was identified.' },
  { name: 'logout', payload: '{}', tr: 'Kimlik temizlendi.', en: 'The identity was cleared.' },
  { name: 'attributes', payload: '{ attributes }', tr: 'Özellikler güncellendi.', en: 'Attributes were updated.' },
  { name: 'locale', payload: '{ locale }', tr: 'Dil değişti.', en: 'The locale changed.' },
  { name: 'theme', payload: '{ theme }', tr: 'Tema değişti.', en: 'The theme changed.' },
  { name: 'navigate', payload: '{ url, path }', tr: 'SPA yönlendirmesi algılandı.', en: 'An SPA navigation was detected.' },
  { name: 'error', payload: '{ code, message }', tr: 'Bir hata oluştu. Kodlar: MISSING_SITE_KEY, MISSING_API_URL, WIDGET_NOT_FOUND, NETWORK_ERROR, SOCKET_ERROR, SEND_FAILED.', en: 'Something failed. Codes: MISSING_SITE_KEY, MISSING_API_URL, WIDGET_NOT_FOUND, NETWORK_ERROR, SOCKET_ERROR, SEND_FAILED.' },
  { name: 'destroy', payload: '{}', tr: 'Widget söküldü.', en: 'The widget was torn down.' }
];

export const SCRIPT_ATTRS = [
  { attr: 'data-site-key', required: true, tr: 'Zorunlu. Panel → Siteler ekranındaki anahtar.', en: 'Required. The key from Dashboard → Sites.' },
  { attr: 'data-api-url', required: false, tr: 'API adresi. Verilmezse script’in kendi origin’i kullanılır — normalde gerekmez.', en: 'API origin. Defaults to the script’s own origin — normally unnecessary.' },
  { attr: 'data-locale', required: false, tr: '`tr` veya `en`. Verilmezse `<html lang>` ve tarayıcı dili sırayla denenir.', en: '`tr` or `en`. Falls back to `<html lang>` then the browser language.' },
  { attr: 'data-theme', required: false, tr: '`light`, `dark` veya `auto`.', en: '`light`, `dark` or `auto`.' },
  { attr: 'data-position', required: false, tr: 'Paneldeki konumu geçersiz kılar: `bottom-right`, `bottom-left`, `top-right`, `top-left`.', en: 'Overrides the dashboard position: `bottom-right`, `bottom-left`, `top-right`, `top-left`.' },
  { attr: 'data-hidden', required: false, tr: '`true` ise widget gizli başlar; `SupportChat.show()` ile gösterilir.', en: 'When `true` the widget starts hidden; call `SupportChat.show()` to reveal it.' },
  { attr: 'data-defer', required: false, tr: '`true` ise otomatik başlatma yapılmaz. Çerez onayı arkasında çalıştırmak için: onay sonrası `SupportChat.init()`.', en: 'When `true` nothing boots automatically. Use it behind a cookie banner: call `SupportChat.init()` after consent.' },
  { attr: 'data-z-index', required: false, tr: 'Widget kökünün z-index değeri. Varsayılan 2147483000.', en: 'The z-index of the widget root. Defaults to 2147483000.' }
];
