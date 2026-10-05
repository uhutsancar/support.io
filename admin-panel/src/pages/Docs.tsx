/**
 * Kurulum rehberi.
 *
 * Eski sayfa on üç bölümlük bir geliştirici dokümantasyonuydu: olay listesi,
 * sunucu tarafı API, tema, yerelleştirme… Okuyanların çoğu tek bir şey
 * istiyordu: kodu alıp sitesine yapıştırmak. Rakiplerin kurulum sayfaları da
 * böyle kısa — üç adım, platform sekmeleri, isteğe bağlı kimlik tanıtma.
 * Bu sayfa da o kadar.
 *
 * Kodlardaki adres sayfanın kendi adresidir; geliştirici makinesinde
 * "localhost" yerine genel adres gösterilir (lib/publicOrigin.ts).
 */

import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { Copy, Check } from 'lucide-react';
import Shell, { PageHero, useMarketingRoutes } from '../components/marketing/Shell';
import {
  Accordion,
  Button,
  Reveal,
  StepNumber,
  TabPanel,
  Tabs,
  asList
} from '../components/marketing/kit';
import { openSiteChat, siteChatAvailable } from '../components/marketing/siteChat';
import { publicOrigin } from '../lib/publicOrigin';
import {
  COMMANDS,
  KEY_PLACEHOLDER,
  OPTIONS,
  PLATFORMS,
  embedSnippet,
  identifySnippet,
  userHashSnippet
} from './docs/content';

const SECTIONS = ['install', 'platforms', 'identify', 'commands', 'help'] as const;

/* ------------------------------------------------------------------ parçalar */

const CodeBlock = ({ code, filename }: { code: string; filename?: string }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Pano izni yoksa sessiz kal: kod zaten ekranda ve seçilebilir.
    }
  };

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-white/[0.08] bg-gray-950">
      <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-white/[0.07]">
        <span className="text-[11.5px] font-mono text-gray-400 truncate">{filename || ''}</span>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11.5px] font-medium
            text-gray-300 hover:text-white hover:bg-white/10 transition"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-green-400" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
          {copied ? t('common.copied') : t('common.copy')}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[12.5px] leading-[1.7] text-gray-200">
        <code>{code}</code>
      </pre>
    </div>
  );
};

const H2 = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <h2
    id={id}
    className="scroll-mt-28 text-[26px] sm:text-[30px] font-bold tracking-[-0.03em] text-gray-950 dark:text-white"
  >
    {children}
  </h2>
);

const Lead = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-3 text-[15.5px] leading-relaxed text-gray-600 dark:text-gray-400 max-w-[64ch]">
    {children}
  </p>
);

const Mono = ({ children }: { children: React.ReactNode }) => (
  <code className="px-1.5 py-0.5 rounded-md text-[12.5px] font-mono bg-gray-100 dark:bg-white/[0.07] text-indigo-700 dark:text-indigo-300">
    {children}
  </code>
);

/* --------------------------------------------------------------------- sayfa */

const Docs = () => {
  const { t, i18n } = useTranslation();
  const routes = useMarketingRoutes();
  const lang = i18n.language === 'en' ? 'en' : 'tr';
  const origin = publicOrigin();
  const key = KEY_PLACEHOLDER[lang];
  const [platform, setPlatform] = useState('html');
  const [active, setActive] = useState<string>('install');

  // Sol menüde görünen bölüm işaretlenir.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: '-96px 0px -65% 0px', threshold: 0 }
    );
    SECTIONS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const steps = asList<{ title: string; body: string }>(
    t('docsPage.install.steps', { returnObjects: true })
  );
  const help = asList<{ q: string; a: string }>(t('docsPage.help.items', { returnObjects: true }));
  const current = PLATFORMS.find((p) => p.id === platform) || PLATFORMS[0];

  return (
    <Shell>
      <Helmet>
        <title>{`${t('docsPage.meta.title')} — Support.io`}</title>
        <meta name="description" content={t('docsPage.meta.description')} />
      </Helmet>

      <PageHero
        eyebrow={t('docsPage.eyebrow')}
        title={t('docsPage.title')}
        description={t('docsPage.description')}
      />

      <div className="px-5 sm:px-8 pb-24">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[200px_minmax(0,1fr)] gap-12">
          {/* ------------------------------------------------- bu sayfada */}
          <nav className="hidden lg:block" aria-label={t('docsPage.onThisPage')}>
            <div className="sticky top-28">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                {t('docsPage.onThisPage')}
              </p>
              <ul className="mt-3 border-l border-gray-200 dark:border-white/10">
                {SECTIONS.map((id) => (
                  <li key={id}>
                    <a
                      href={'#' + id}
                      aria-current={active === id ? 'true' : undefined}
                      className={[
                        '-ml-px block pl-4 py-1.5 border-l-2 text-[13.5px] transition-colors',
                        active === id
                          ? 'border-indigo-600 text-gray-950 dark:text-white font-medium'
                          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      ].join(' ')}
                    >
                      {t('docsPage.nav.' + id)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          <div className="min-w-0 space-y-20">
            {/* --------------------------------------------------- kurulum */}
            <section>
              <H2 id="install">{t('docsPage.install.title')}</H2>
              <ol className="mt-8 grid sm:grid-cols-3 gap-4">
                {steps.map((step, i) => (
                  <Reveal key={i} delay={i * 0.05}>
                    <li className="h-full list-none rounded-2xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] p-5">
                      <StepNumber n={i + 1} />
                      <p className="mt-4 text-[15px] font-semibold text-gray-900 dark:text-white">
                        {step.title}
                      </p>
                      <p className="mt-1.5 text-[13.5px] leading-relaxed text-gray-600 dark:text-gray-400">
                        {step.body}
                      </p>
                    </li>
                  </Reveal>
                ))}
              </ol>

              <div className="mt-8">
                <CodeBlock
                  code={embedSnippet(origin, key)}
                  filename={t('docsPage.install.codeTitle')}
                />
              </div>
              <p className="mt-4 text-[13.5px] leading-relaxed text-gray-500 dark:text-gray-400 max-w-[70ch]">
                {t('docsPage.install.note')}
              </p>
              <div className="mt-6">
                <Button to={routes.register} arrow>
                  {t('docsPage.install.cta')}
                </Button>
              </div>
            </section>

            {/* ------------------------------------------------ platformlar */}
            <section>
              <H2 id="platforms">{t('docsPage.platforms.title')}</H2>
              <Lead>{t('docsPage.platforms.desc')}</Lead>

              <div className="mt-8">
                <Tabs
                  variant="pill"
                  className="!justify-start flex-wrap gap-y-2"
                  items={PLATFORMS.map((p) => ({ id: p.id, label: p.label }))}
                  active={platform}
                  onChange={setPlatform}
                >
                  <TabPanel value={current.id} className="mt-6 focus:outline-none">
                    <ol className="space-y-3">
                      {current.steps.map((step, i) => (
                        <li key={i} className="flex gap-3">
                          <span className="mt-0.5 w-6 h-6 shrink-0 rounded-full bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 text-[12px] font-semibold flex items-center justify-center tabular-nums">
                            {i + 1}
                          </span>
                          <span className="text-[14.5px] leading-relaxed text-gray-700 dark:text-gray-300">
                            {step[lang]}
                          </span>
                        </li>
                      ))}
                    </ol>
                    <div className="mt-6 space-y-4">
                      {current.code ? (
                        <>
                          {/* Kod etiketi framework'te de aynıdır; Next.js ve Nuxt kendi biçimini gösterir. */}
                          {current.id !== 'nextjs' && current.id !== 'html' && (
                            <CodeBlock
                              code={embedSnippet(origin, key)}
                              filename={t('docsPage.install.codeTitle')}
                            />
                          )}
                          <CodeBlock
                            code={current.code(origin, key, lang)}
                            filename={current.file}
                          />
                        </>
                      ) : (
                        <CodeBlock
                          code={embedSnippet(origin, key)}
                          filename={t('docsPage.install.codeTitle')}
                        />
                      )}
                    </div>
                  </TabPanel>
                </Tabs>
              </div>
            </section>

            {/* --------------------------------------------- kimlik tanıtma */}
            <section>
              <H2 id="identify">{t('docsPage.identify.title')}</H2>
              <Lead>{t('docsPage.identify.desc')}</Lead>
              <div className="mt-6">
                <CodeBlock code={identifySnippet()} filename="HTML" />
              </div>
              <h3 className="mt-10 text-[17px] font-semibold text-gray-900 dark:text-white">
                {t('docsPage.identify.verifiedTitle')}
              </h3>
              <Lead>{t('docsPage.identify.verifiedDesc')}</Lead>
              <div className="mt-5">
                <CodeBlock code={userHashSnippet(lang)} filename="server.js" />
              </div>
            </section>

            {/* ------------------------------------------- koddan kontrol */}
            <section>
              <H2 id="commands">{t('docsPage.commands.title')}</H2>
              <Lead>{t('docsPage.commands.desc')}</Lead>
              <div className="mt-6">
                <CodeBlock code={"SupportChat.q.push(['open']);"} filename="JavaScript" />
              </div>
              <div className="mt-6 overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/[0.08]">
                <table className="w-full min-w-[520px] text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-white/[0.03]">
                      <th className="px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-gray-500">
                        {t('docsPage.commands.command')}
                      </th>
                      <th className="px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-gray-500">
                        {t('docsPage.commands.does')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMMANDS.map((c) => (
                      <tr
                        key={c.call}
                        className="border-t border-gray-100 dark:border-white/[0.06]"
                      >
                        <td className="px-4 py-3 align-top">
                          <Mono>{c.call}</Mono>
                        </td>
                        <td className="px-4 py-3 text-[13.5px] text-gray-700 dark:text-gray-300">
                          {c.text[lang]}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3 className="mt-10 text-[17px] font-semibold text-gray-900 dark:text-white">
                {t('docsPage.commands.optionsTitle')}
              </h3>
              <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/[0.08]">
                <table className="w-full min-w-[520px] text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-white/[0.03]">
                      <th className="px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-gray-500">
                        {t('docsPage.commands.option')}
                      </th>
                      <th className="px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-gray-500">
                        {t('docsPage.commands.does')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {OPTIONS.map((o) => (
                      <tr
                        key={o.attr}
                        className="border-t border-gray-100 dark:border-white/[0.06]"
                      >
                        <td className="px-4 py-3 align-top">
                          <Mono>{o.attr}</Mono>
                        </td>
                        <td className="px-4 py-3 text-[13.5px] text-gray-700 dark:text-gray-300">
                          {o.text[lang]}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ------------------------------------------------ sorun giderme */}
            <section>
              <H2 id="help">{t('docsPage.help.title')}</H2>
              <div className="mt-6">
                <Accordion items={help} />
              </div>
              <p className="mt-6 text-[14px] text-gray-600 dark:text-gray-400">
                {siteChatAvailable ? (
                  <button
                    type="button"
                    onClick={() => openSiteChat()}
                    className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    {t('docsPage.help.still')}
                  </button>
                ) : (
                  t('docsPage.help.still')
                )}
              </p>
            </section>
          </div>
        </div>
      </div>
    </Shell>
  );
};

export default Docs;
