/**
 * Geliştirici dokümantasyonu.
 *
 * Eski sayfa çalışmayan bir kurulum kodu gösteriyordu (`cdn.support.io`,
 * `window.supportioConfig`, `siteId`). Hiçbiri mevcut değildi; kopyalayan
 * herkeste sessizce hiçbir şey olmuyordu. Bu sayfadaki her örnek, bu depodaki
 * gerçek çalışma zamanına karşılık gelir.
 *
 * Yapısal ilke: framework bölümleri FARKLI BİR EMBED KODU ÜRETMEZ. Hepsi aynı
 * tek script etiketini kullanır; bölümler yalnızca o etiketin ilgili
 * framework'te nereye konacağını anlatır.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Copy, Check, Menu, X, Rocket, Code2, Terminal, Radio, UserCheck, Route,
  Boxes, Server, Palette, Languages, ShieldCheck, LifeBuoy, BookOpen, ArrowRight
} from 'lucide-react';
import { Header, Footer } from '../components/marketing/Shell';
import { FRAMEWORKS, API_METHODS, EVENTS, SCRIPT_ATTRS, embedSnippet } from './docs/content';

const NAV = [
  { id: 'quickstart', icon: Rocket },
  { id: 'embed', icon: Code2 },
  { id: 'api', icon: Terminal },
  { id: 'events', icon: Radio },
  { id: 'identify', icon: UserCheck },
  { id: 'spa', icon: Route },
  { id: 'frameworks', icon: Boxes },
  { id: 'backend', icon: Server },
  { id: 'theming', icon: Palette },
  { id: 'localization', icon: Languages },
  { id: 'security', icon: ShieldCheck },
  { id: 'troubleshooting', icon: LifeBuoy }
];

/* ------------------------------------------------------------------ parçalar */

const CodeBlock = ({ code, filename, id, copiedId, onCopy, label }: { code?: any; filename?: any; id?: string; copiedId?: any; onCopy?: (...args: any[]) => void; label?: any; [prop: string]: any }) => (
  <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-950">
    <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-white/[0.07]">
      <span className="text-[11.5px] font-mono text-gray-400 truncate">{filename || ''}</span>
      <button
        onClick={() => onCopy?.(code, id)}
        className="shrink-0 inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11.5px] font-medium
          text-gray-400 hover:text-white hover:bg-white/10 transition"
      >
        {copiedId === id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
        {copiedId === id ? label.copied : label.copy}
      </button>
    </div>
    <pre className="overflow-x-auto p-4 text-[12.5px] leading-[1.7] text-gray-200">
      <code>{code}</code>
    </pre>
  </div>
);

const Prose = ({ children }: { children?: any; [prop: string]: any }) => (
  <p className="text-[14.5px] leading-relaxed text-gray-600 dark:text-gray-400 max-w-[65ch]">{children}</p>
);

const H2 = ({ children }: { children?: any; [prop: string]: any }) => (
  <h2 className="text-[22px] font-semibold tracking-tight text-gray-900 dark:text-white scroll-mt-24">
    {children}
  </h2>
);

const H3 = ({ children }: { children?: any; [prop: string]: any }) => (
  <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white mt-8 mb-2">{children}</h3>
);

const Callout = ({ tone = 'info', title, children }: { title?: any; children?: any; [prop: string]: any }) => {
  const tones = {
    info: 'border-blue-200 bg-blue-50/60 dark:border-blue-500/25 dark:bg-blue-500/[0.07]',
    warn: 'border-amber-200 bg-amber-50/60 dark:border-amber-500/25 dark:bg-amber-500/[0.07]',
    danger: 'border-red-200 bg-red-50/60 dark:border-red-500/25 dark:bg-red-500/[0.07]'
  };
  return (
    <div className={`rounded-xl border px-4 py-3 ${tones[tone as keyof typeof tones]}`}>
      {title && <p className="text-[13px] font-semibold text-gray-900 dark:text-white mb-1">{title}</p>}
      <div className="text-[13.5px] leading-relaxed text-gray-700 dark:text-gray-300 max-w-[65ch]">{children}</div>
    </div>
  );
};

const Table = ({ head, rows }: { head?: any; rows?: any; [prop: string]: any }) => (
  <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
    <table className="w-full text-left border-collapse min-w-[520px]">
      <thead>
        <tr className="bg-gray-50 dark:bg-gray-800/60">
          {head.map((h: any) => (
            <th key={h} className="px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-wider
              text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row: any, i: number) => (
          <tr key={i} className="border-b border-gray-100 dark:border-gray-800/60 last:border-0">
            {row.map((cell: any, j: number) => (
              <td key={j} className="px-4 py-2.5 text-[13px] text-gray-700 dark:text-gray-300 align-top">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Mono = ({ children }: { children?: any; [prop: string]: any }) => (
  <code className="px-1.5 py-0.5 rounded-md text-[12.5px] font-mono
    bg-gray-100 dark:bg-gray-800 text-indigo-700 dark:text-indigo-300 whitespace-nowrap">
    {children}
  </code>
);

/* --------------------------------------------------------------------- sayfa */

const Docs = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'tr';
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [active, setActive] = useState('quickstart');
  const [framework, setFramework] = useState('html');
  const observed = useRef(new Map());

  const origin = import.meta.env.VITE_API_URL || window.location.origin;
  const snippet = useMemo(() => embedSnippet(origin), [origin]);
  const copyLabel = { copy: t('common.copy'), copied: t('common.copied') };

  const copy = async (code: any, id: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      // Pano izni yoksa sessiz kal: kod zaten ekranda ve seçilebilir.
    }
  };

  // Scroll-spy: hangi bölüm görünürse sol menüde o işaretlenir.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: '-88px 0px -70% 0px', threshold: 0 }
    );
    NAV.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const goTo = (id: string) => {
    setNavOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const activeFramework = FRAMEWORKS.find((f) => f.id === framework) || FRAMEWORKS[0];

  const sidebar = (
    <nav className="space-y-0.5" aria-label={t('docs.nav.title')}>
      {NAV.map(({ id, icon: Icon }) => (
        <button
          key={id}
          onClick={() => goTo(id)}
          aria-current={active === id ? 'true' : undefined}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13.5px] text-left transition
            ${active === id
              ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-medium'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
        >
          <Icon className="w-4 h-4 shrink-0" />
          <span className="truncate">{t(`docsPage.nav.${id}`)}</span>
        </button>
      ))}
    </nav>
  );

  return (
    <>
      <Helmet>
        <title>{`${t('docsPage.meta.title')} — Support.io`}</title>
        <meta name="description" content={t('docsPage.meta.description')} />
      </Helmet>

      <div className="min-h-screen bg-white dark:bg-gray-950">
        <Header />

        {/* ----------------------------------------------------------- hero */}
        <div className="border-b border-gray-200 dark:border-gray-800 pt-24 pb-10">
          <div className="max-w-7xl mx-auto px-5 sm:px-8">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px]
              font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
              <BookOpen className="w-3.5 h-3.5" /> SDK v3.0.0
            </span>
            <h1 className="mt-4 text-[34px] sm:text-[42px] font-semibold tracking-[-0.025em]
              text-gray-900 dark:text-white leading-[1.1]">
              {t('docsPage.hero.title')}
            </h1>
            <p className="mt-3 text-[16px] leading-relaxed text-gray-600 dark:text-gray-400 max-w-[62ch]">
              {t('docsPage.hero.description')}
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-5 sm:px-8 flex gap-10">
          {/* --------------------------------------------------- sol menü */}
          <aside className="hidden lg:block w-56 shrink-0 py-10">
            <div className="sticky top-24">{sidebar}</div>
          </aside>

          <button
            onClick={() => setNavOpen(true)}
            className="lg:hidden fixed bottom-5 right-5 z-40 p-3.5 rounded-full bg-indigo-600 text-white shadow-lg"
            aria-label={t('docs.nav.title')}
          >
            <Menu className="w-5 h-5" />
          </button>

          {navOpen && (
            <div className="lg:hidden fixed inset-0 z-50 bg-gray-900/50" onClick={() => setNavOpen(false)}>
              <div
                className="absolute inset-y-0 right-0 w-72 max-w-[85vw] bg-white dark:bg-gray-900 p-4 overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{t('docs.nav.title')}</span>
                  <button onClick={() => setNavOpen(false)} aria-label={t('common.close')}>
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
                {sidebar}
              </div>
            </div>
          )}

          {/* ---------------------------------------------------- içerik */}
          <main className="flex-1 min-w-0 py-10 space-y-20 pb-32">

            {/* ============================================ QUICK START */}
            <section id="quickstart" className="space-y-5 scroll-mt-24">
              <H2>{t('docsPage.quickstart.title')}</H2>
              <Prose>{t('docsPage.quickstart.intro')}</Prose>

              <ol className="space-y-5">
                {['step1', 'step2', 'step3'].map((step, index) => (
                  <li key={step} className="flex gap-4">
                    <span className="shrink-0 w-7 h-7 rounded-full bg-gray-900 dark:bg-white
                      text-white dark:text-gray-900 text-[13px] font-semibold flex items-center justify-center">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="text-[14.5px] font-medium text-gray-900 dark:text-white">
                        {t(`docsPage.quickstart.${step}.title`)}
                      </p>
                      <p className="mt-1 text-[14px] leading-relaxed text-gray-600 dark:text-gray-400 max-w-[62ch]">
                        {t(`docsPage.quickstart.${step}.body`)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>

              <CodeBlock
                code={snippet}
                filename="index.html"
                id="qs"
                copiedId={copiedId}
                onCopy={copy}
                label={copyLabel}
              />

              <Callout tone="info" title={t('docsPage.quickstart.calloutTitle')}>
                {t('docsPage.quickstart.calloutBody')}
              </Callout>

              <Link
                to={i18n.language === 'en' ? '/en/dashboard/sites' : '/dashboard/sites'}
                className="inline-flex items-center gap-1.5 text-[13.5px] font-medium
                  text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {t('docsPage.quickstart.getKey')} <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </section>

            {/* ================================================ EMBED */}
            <section id="embed" className="space-y-5 scroll-mt-24">
              <H2>{t('docsPage.embed.title')}</H2>
              <Prose>{t('docsPage.embed.intro')}</Prose>

              <H3>{t('docsPage.embed.attrs')}</H3>
              <Table
                head={[t('docsPage.table.attribute'), t('docsPage.table.required'), t('docsPage.table.description')]}
                rows={SCRIPT_ATTRS.map((a) => [
                  <Mono key="a">{a.attr}</Mono>,
                  a.required ? t('common.yes') : t('common.no'),
                  a[lang]
                ])}
              />

              <H3>{t('docsPage.embed.versioning')}</H3>
              <Prose>{t('docsPage.embed.versioningBody')}</Prose>
              <CodeBlock
                code={`<!-- ${t('docsPage.embed.latest')} -->\n<script src="${origin}/widget.js" data-site-key="YOUR_SITE_KEY" async><\/script>\n\n<!-- ${t('docsPage.embed.pinned')} -->\n<script src="${origin}/widget/v3/widget.js" data-site-key="YOUR_SITE_KEY" async><\/script>`}
                id="ver"
                copiedId={copiedId}
                onCopy={copy}
                label={copyLabel}
              />

              <H3>{t('docsPage.embed.consent')}</H3>
              <Prose>{t('docsPage.embed.consentBody')}</Prose>
              <CodeBlock
                code={`<script src="${origin}/widget.js"\n        data-site-key="YOUR_SITE_KEY"\n        data-defer="true" async><\/script>\n\n<script>\n  cookieBanner.onAccept(function () {\n    SupportChat.init();\n  });\n<\/script>`}
                id="consent"
                copiedId={copiedId}
                onCopy={copy}
                label={copyLabel}
              />
            </section>

            {/* ================================================== API */}
            <section id="api" className="space-y-5 scroll-mt-24">
              <H2>{t('docsPage.api.title')}</H2>
              <Prose>{t('docsPage.api.intro')}</Prose>
              <div className="space-y-2.5">
                {API_METHODS.map((method) => (
                  <div
                    key={method.sig}
                    className="rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-3"
                  >
                    <code className="block text-[13px] font-mono text-indigo-700 dark:text-indigo-300">
                      {method.sig}
                    </code>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-gray-600 dark:text-gray-400 max-w-[62ch]">
                      {method[lang]}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* ================================================ EVENTS */}
            <section id="events" className="space-y-5 scroll-mt-24">
              <H2>{t('docsPage.events.title')}</H2>
              <Prose>{t('docsPage.events.intro')}</Prose>
              <CodeBlock
                code={`const stop = SupportChat.on('message', function (payload) {\n  console.log('${t('docsPage.events.sample')}', payload.message);\n});\n\n// ${t('docsPage.events.unsub')}\nstop();\n\n// ${t('docsPage.events.wildcard')}\nSupportChat.on('*', function (e) {\n  analytics.track('support_chat_' + e.type, e.payload);\n});`}
                id="events"
                copiedId={copiedId}
                onCopy={copy}
                label={copyLabel}
              />
              <Table
                head={[t('docsPage.table.event'), 'payload', t('docsPage.table.description')]}
                rows={EVENTS.map((e) => [
                  <Mono key="e">{e.name}</Mono>,
                  <code key="p" className="text-[12px] font-mono text-gray-500 dark:text-gray-400">{e.payload}</code>,
                  e[lang]
                ])}
              />
            </section>

            {/* ============================================== IDENTIFY */}
            <section id="identify" className="space-y-5 scroll-mt-24">
              <H2>{t('docsPage.identify.title')}</H2>
              <Prose>{t('docsPage.identify.intro')}</Prose>
              <CodeBlock
                code={`// ${t('docsPage.identify.afterLogin')}\nSupportChat.identify({\n  userId: 'u_1042',\n  name:   'Ayşe Yılmaz',\n  email:  'ayse@ornek.com',\n  avatar: 'https://cdn.ornek.com/a/1042.jpg'\n});\n\n// ${t('docsPage.identify.attrs')}\nSupportChat.setAttributes({\n  plan: 'pro',\n  mrr: 249,\n  signupDate: '2026-01-14'\n});\n\n// ${t('docsPage.identify.afterLogout')}\nSupportChat.logout();`}
                id="identify"
                copiedId={copiedId}
                onCopy={copy}
                label={copyLabel}
              />
              <Callout tone="danger" title={t('docsPage.identify.warnTitle')}>
                {t('docsPage.identify.warnBody')}
              </Callout>
              <Callout tone="warn" title={t('docsPage.identify.logoutTitle')}>
                {t('docsPage.identify.logoutBody')}
              </Callout>
            </section>

            {/* =================================================== SPA */}
            <section id="spa" className="space-y-5 scroll-mt-24">
              <H2>{t('docsPage.spa.title')}</H2>
              <Prose>{t('docsPage.spa.intro')}</Prose>
              <ul className="space-y-2.5">
                {['singleton', 'history', 'cleanup', 'ssr'].map((item) => (
                  <li key={item} className="flex gap-3">
                    <Check className="w-4 h-4 mt-0.5 shrink-0 text-green-600 dark:text-green-500" />
                    <span className="text-[14px] leading-relaxed text-gray-600 dark:text-gray-400 max-w-[62ch]">
                      <strong className="text-gray-900 dark:text-white font-medium">
                        {t(`docsPage.spa.${item}.title`)}
                      </strong>{' '}
                      — {t(`docsPage.spa.${item}.body`)}
                    </span>
                  </li>
                ))}
              </ul>
              <CodeBlock
                code={`// ${t('docsPage.spa.sampleTitle')}\nuseEffect(() => {\n  // ${t('docsPage.spa.sampleNote')}\n  return () => {\n    if (import.meta.env.DEV) return;   // ${t('docsPage.spa.sampleDev')}\n    window.SupportChat?.destroy();\n  };\n}, []);`}
                id="spa"
                copiedId={copiedId}
                onCopy={copy}
                label={copyLabel}
              />
            </section>

            {/* ============================================ FRAMEWORKS */}
            <section id="frameworks" className="space-y-5 scroll-mt-24">
              <H2>{t('docsPage.frameworks.title')}</H2>
              <Prose>{t('docsPage.frameworks.intro')}</Prose>

              <div className="flex flex-wrap gap-1.5">
                {FRAMEWORKS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFramework(f.id)}
                    aria-pressed={framework === f.id}
                    className={`px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition
                      ${framework === f.id
                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <CodeBlock
                code={activeFramework.code(origin, 'YOUR_SITE_KEY')}
                filename={activeFramework.file}
                id={`fw-${activeFramework.id}`}
                copiedId={copiedId}
                onCopy={copy}
                label={copyLabel}
              />
            </section>

            {/* ============================================== BACKEND */}
            <section id="backend" className="space-y-5 scroll-mt-24">
              <H2>{t('docsPage.backend.title')}</H2>
              <Prose>{t('docsPage.backend.intro')}</Prose>
              <Table
                head={[t('docsPage.table.endpoint'), t('docsPage.table.description')]}
                rows={[
                  [<Mono key="1">GET /api/widget/bootstrap?siteKey=…</Mono>, t('docsPage.backend.bootstrap')],
                  [<Mono key="2">POST /api/widget/installed</Mono>, t('docsPage.backend.installed')],
                  [<Mono key="3">POST /api/files/upload</Mono>, t('docsPage.backend.upload')],
                  [<Mono key="4">POST /api/events/track</Mono>, t('docsPage.backend.track')],
                  [<Mono key="5">WS /widget</Mono>, t('docsPage.backend.socket')]
                ]}
              />
              <H3>{t('docsPage.backend.socketEvents')}</H3>
              <Table
                head={[t('docsPage.table.event'), t('docsPage.table.direction'), t('docsPage.table.description')]}
                rows={[
                  [<Mono key="a">join-conversation</Mono>, '→', t('docsPage.backend.join')],
                  [<Mono key="b">send-message</Mono>, '→', t('docsPage.backend.send')],
                  [<Mono key="c">typing</Mono>, '→', t('docsPage.backend.typing')],
                  [<Mono key="d">visitor-page-view</Mono>, '→', t('docsPage.backend.pageview')],
                  [<Mono key="e">conversation-joined</Mono>, '←', t('docsPage.backend.joined')],
                  [<Mono key="f">new-message</Mono>, '←', t('docsPage.backend.newMessage')],
                  [<Mono key="g">agent-typing</Mono>, '←', t('docsPage.backend.agentTyping')],
                  [<Mono key="h">error</Mono>, '←', t('docsPage.backend.error')]
                ]}
              />
            </section>

            {/* ============================================== THEMING */}
            <section id="theming" className="space-y-5 scroll-mt-24">
              <H2>{t('docsPage.theming.title')}</H2>
              <Prose>{t('docsPage.theming.intro')}</Prose>
              <CodeBlock
                code={`SupportChat.setTheme('dark');\nSupportChat.setTheme('auto');   // ${t('docsPage.theming.auto')}\n\n// ${t('docsPage.theming.follow')}\nmatchMedia('(prefers-color-scheme: dark)')\n  .addEventListener('change', function (e) {\n    SupportChat.setTheme(e.matches ? 'dark' : 'light');\n  });`}
                id="theme"
                copiedId={copiedId}
                onCopy={copy}
                label={copyLabel}
              />
              <Callout tone="info" title={t('docsPage.theming.isolationTitle')}>
                {t('docsPage.theming.isolationBody')}
              </Callout>
            </section>

            {/* ========================================= LOCALIZATION */}
            <section id="localization" className="space-y-5 scroll-mt-24">
              <H2>{t('docsPage.localization.title')}</H2>
              <Prose>{t('docsPage.localization.intro')}</Prose>
              <CodeBlock
                code={`<!-- ${t('docsPage.localization.viaAttr')} -->\n<script src="${origin}/widget.js"\n        data-site-key="YOUR_SITE_KEY"\n        data-locale="en" async><\/script>\n\n<!-- ${t('docsPage.localization.viaApi')} -->\n<script>\n  SupportChat.setLocale('tr');\n<\/script>`}
                id="locale"
                copiedId={copiedId}
                onCopy={copy}
                label={copyLabel}
              />
            </section>

            {/* ============================================== SECURITY */}
            <section id="security" className="space-y-5 scroll-mt-24">
              <H2>{t('docsPage.security.title')}</H2>

              <H3>{t('docsPage.security.cspTitle')}</H3>
              <Prose>{t('docsPage.security.cspBody')}</Prose>
              <CodeBlock
                code={`Content-Security-Policy:\n  script-src  'self' ${origin};\n  connect-src 'self' ${origin} ${origin.replace(/^http/, 'ws')};\n  img-src     'self' data: ${origin};\n  style-src   'self' 'unsafe-inline';`}
                filename="CSP"
                id="csp"
                copiedId={copiedId}
                onCopy={copy}
                label={copyLabel}
              />
              <Callout tone="info" title={t('docsPage.security.inlineTitle')}>
                {t('docsPage.security.inlineBody')}
              </Callout>

              <H3>{t('docsPage.security.corsTitle')}</H3>
              <Prose>{t('docsPage.security.corsBody')}</Prose>

              <H3>{t('docsPage.security.keyTitle')}</H3>
              <Prose>{t('docsPage.security.keyBody')}</Prose>

              <H3>{t('docsPage.security.dataTitle')}</H3>
              <Prose>{t('docsPage.security.dataBody')}</Prose>
            </section>

            {/* ======================================= TROUBLESHOOTING */}
            <section id="troubleshooting" className="space-y-5 scroll-mt-24">
              <H2>{t('docsPage.troubleshooting.title')}</H2>
              <Prose>{t('docsPage.troubleshooting.intro')}</Prose>
              <CodeBlock
                code={`SupportChat.debug()\n// → {\n//     version: '3.0.0',\n//     initialized: true,\n//     siteKey: '…',\n//     apiUrl: '${origin}',\n//     connection: 'connected',\n//     availability: 'online',\n//     conversationId: '…',\n//     visitorId: 'v_…',\n//     locale: 'tr',\n//     hidden: false,\n//     fatal: null\n//   }`}
                filename="DevTools console"
                id="debug"
                copiedId={copiedId}
                onCopy={copy}
                label={copyLabel}
              />
              <div className="space-y-3">
                {['notShowing', 'wrongKey', 'csp', 'duplicate', 'styles', 'disconnect'].map((item) => (
                  <details
                    key={item}
                    className="group rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden"
                  >
                    <summary className="px-4 py-3 text-[14px] font-medium text-gray-900 dark:text-white
                      cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60 transition list-none
                      flex items-center justify-between gap-3">
                      {t(`docsPage.troubleshooting.${item}.q`)}
                      <span className="shrink-0 text-gray-400 group-open:rotate-45 transition-transform">+</span>
                    </summary>
                    <div className="px-4 pb-4 pt-1 text-[13.5px] leading-relaxed text-gray-600 dark:text-gray-400
                      border-t border-gray-100 dark:border-gray-800 max-w-[65ch]">
                      {t(`docsPage.troubleshooting.${item}.a`)}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          </main>
        </div>

        <Footer />
      </div>
    </>
  );
};

export default Docs;
