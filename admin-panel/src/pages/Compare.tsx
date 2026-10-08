/**
 * Karşılaştırma sayfası (`/karsilastirma/:slug`, `/en/compare/:slug`; plan v10
 * MKT-04): Support.io ve bir rakip, fiyat modeli ve yapay zekâ yan yana.
 *
 * Dürüstlük kuralı: rakip sütunu yalnızca o firmanın herkese açık fiyat
 * sayfasında yazanı söyler, kaynağı ve kontrol tarihiyle; Support.io sütunu
 * sunucunun uyguladığı plan tablosundan (GET /api/plans) gelir. Rakibin daha
 * uygun olduğu durumlar ve Support.io'da olmayanlar da sayfada yazar.
 */

import { Helmet } from 'react-helmet-async';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, ExternalLink, Minus } from 'lucide-react';
import Shell, { PageHero, useMarketingRoutes } from '../components/marketing/Shell';
import { Button, Card, Reveal, Section, SectionHead, asList } from '../components/marketing/kit';
import { COMPARISONS, COMPARISONS_PUBLISHED } from './marketing/features';
import { usePlans } from '../hooks/usePlans';

const ROWS = ['model', 'start', 'free', 'ai'] as const;

const Compare = () => {
  const { slug = '' } = useParams<{ slug: string }>();
  const { t, i18n } = useTranslation();
  const routes = useMarketingRoutes();
  const { plans, failed } = usePlans();
  const rival = COMPARISONS.find((c) => c.id === slug);

  if (!rival) return <Navigate to={routes.pricing} replace />;

  const key = (suffix: string) => 'compare.items.' + rival.id + '.' + suffix;
  const name = t(key('name'));
  const locale = i18n.language === 'en' ? 'en-US' : 'tr-TR';
  const number = new Intl.NumberFormat(locale);
  const money = (amount: number, currency: string) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(
      amount
    );
  const lowerFirst = (text: string) => text.charAt(0).toLocaleLowerCase(locale) + text.slice(1);

  // Support.io'nun sütunu: sunucunun plan tablosundan, elle yazılmış sayı yok.
  const free = plans?.find((p) => p.type === 'FREE');
  const pro = plans?.find((p) => p.type === 'PRO');
  const ours: Record<(typeof ROWS)[number], string> = {
    model: t('compare.us.model'),
    start:
      pro && pro.price.monthly !== null
        ? t('compare.us.start', {
            price: money(pro.price.monthly, pro.price.currency),
            agents: t('pricingPage.units.agents', { count: pro.agents }),
            sites: t('pricingPage.units.sites', { count: pro.sites })
          })
        : '',
    free: free
      ? t('compare.us.free', {
          limits: [
            t('pricingPage.units.sites', { count: free.sites }),
            t('pricingPage.units.agents', { count: free.agents }),
            lowerFirst(
              t('pricingPage.units.conversations', { n: number.format(free.monthlyConversations) })
            )
          ].join(', ')
        })
      : '',
    ai:
      free && pro
        ? t('compare.us.ai', {
            free: number.format(free.assistant.monthlyReplies),
            pro: number.format(pro.assistant.monthlyReplies)
          })
        : ''
  };
  // Tablo gelmediyse sayı uydurmak yerine fiyat sayfasına yönlendirir.
  const ourCell = (row: (typeof ROWS)[number]) =>
    ours[row] || (failed ? t('compare.us.seePricing') : '…');

  const us = asList<string>(t(key('us'), { returnObjects: true }));
  const them = asList<string>(t(key('them'), { returnObjects: true }));
  const gaps = asList<string>(t('compare.gaps', { returnObjects: true }));
  const others = COMPARISONS.filter((c) => c.id !== rival.id);
  const compareRoute = (id: string) => routes.compare + '/' + id;

  return (
    <Shell>
      <Helmet>
        <title>{t('compare.metaTitle', { name }) + ' — Support.io'}</title>
        <meta name="description" content={t(key('summary'))} />
        {!COMPARISONS_PUBLISHED && <meta name="robots" content="noindex, nofollow" />}
      </Helmet>

      <PageHero
        eyebrow={t('compare.eyebrow')}
        title={t('compare.title', { name })}
        description={t(key('summary'))}
      >
        <div className="mt-9 flex flex-wrap gap-3">
          <Button to={routes.register} size="lg" arrow>
            {t('landing.home.btnStart')}
          </Button>
          <Button to={routes.pricing} variant="secondary" size="lg">
            {t('landing.home.ctaBtn2')}
          </Button>
        </div>
      </PageHero>

      {/* ------------------------------------------------------ kim için */}
      <Section tone="plain">
        <SectionHead eyebrow={t('compare.whoEyebrow')} title={t('compare.whoTitle')} />
        <div className="mt-10 grid md:grid-cols-2 gap-4">
          <Reveal>
            <Card className="p-7 h-full">
              <h3 className="text-[17px] font-semibold text-gray-950 dark:text-white">
                {t('compare.chooseUs')}
              </h3>
              <ul className="mt-4 space-y-3">
                {us.map((line) => (
                  <li key={line} className="flex gap-2.5">
                    <Check className="w-4 h-4 mt-1 shrink-0 text-indigo-700 dark:text-indigo-300" />
                    <span className="text-[14.5px] leading-relaxed text-gray-700 dark:text-gray-300">
                      {line}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
          <Reveal delay={0.06}>
            <Card className="p-7 h-full">
              <h3 className="text-[17px] font-semibold text-gray-950 dark:text-white">
                {t('compare.chooseThem', { name })}
              </h3>
              <ul className="mt-4 space-y-3">
                {them.map((line) => (
                  <li key={line} className="flex gap-2.5">
                    <Check className="w-4 h-4 mt-1 shrink-0 text-gray-500 dark:text-gray-400" />
                    <span className="text-[14.5px] leading-relaxed text-gray-700 dark:text-gray-300">
                      {line}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
        </div>
      </Section>

      {/* ---------------------------------------------------- yan yana */}
      <Section tone="mist">
        <SectionHead
          eyebrow={t('compare.tableEyebrow')}
          title={t('compare.tableTitle')}
          description={t('compare.tableDesc')}
        />
        <Reveal className="mt-10">
          <Card className="overflow-hidden">
            {/* Geniş ekranda tablo; telefonda her satır kendi kartında. */}
            <table className="hidden md:table w-full text-left">
              <caption className="sr-only">{t('compare.title', { name })}</caption>
              <thead>
                <tr className="border-b border-gray-200/80 dark:border-white/[0.08]">
                  <th scope="col" className="w-[22%] px-6 py-4">
                    <span className="sr-only">{t('compare.rowLabel')}</span>
                  </th>
                  <th
                    scope="col"
                    className="w-[39%] px-6 py-4 text-[14px] font-semibold text-indigo-700 dark:text-indigo-300"
                  >
                    Support.io
                  </th>
                  <th
                    scope="col"
                    className="w-[39%] px-6 py-4 text-[14px] font-semibold text-gray-900 dark:text-white"
                  >
                    {name}
                  </th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr
                    key={row}
                    className="border-b last:border-b-0 border-gray-200/70 dark:border-white/[0.06] align-top"
                  >
                    <th
                      scope="row"
                      className="px-6 py-5 text-[13.5px] font-semibold text-gray-900 dark:text-white"
                    >
                      {t('compare.rows.' + row)}
                    </th>
                    <td className="px-6 py-5 text-[14.5px] leading-relaxed text-gray-800 dark:text-gray-200">
                      {ourCell(row)}
                    </td>
                    <td className="px-6 py-5 text-[14.5px] leading-relaxed text-gray-600 dark:text-gray-400">
                      {t(key('rows.' + row))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="md:hidden divide-y divide-gray-200/70 dark:divide-white/[0.06]">
              {ROWS.map((row) => (
                <div key={row} className="p-5">
                  <dt className="text-[13.5px] font-semibold text-gray-900 dark:text-white">
                    {t('compare.rows.' + row)}
                  </dt>
                  <dd className="mt-3 text-[14px] leading-relaxed text-gray-800 dark:text-gray-200">
                    <span className="block text-[11.5px] font-semibold uppercase tracking-[0.08em] text-indigo-700 dark:text-indigo-300">
                      Support.io
                    </span>
                    {ourCell(row)}
                  </dd>
                  <dd className="mt-3 text-[14px] leading-relaxed text-gray-600 dark:text-gray-400">
                    <span className="block text-[11.5px] font-semibold uppercase tracking-[0.08em] text-gray-600 dark:text-gray-400">
                      {name}
                    </span>
                    {t(key('rows.' + row))}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        </Reveal>
        <div className="mt-6 space-y-2 text-[13px] leading-relaxed text-gray-600 dark:text-gray-400">
          <p>
            {t('compare.note', { name, date: t('compare.checked') })}{' '}
            <a
              href={rival.source}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-indigo-700 dark:text-indigo-300 underline underline-offset-2"
            >
              {t('compare.source', { name })}
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          </p>
          <p>{t('compare.trademark', { name })}</p>
        </div>
      </Section>

      {/* --------------------------------------------- bugün olmayanlar */}
      <Section tone="plain">
        <SectionHead
          eyebrow={t('compare.gapsEyebrow')}
          title={t('compare.gapsTitle')}
          description={t('compare.gapsDesc')}
        />
        <ul className="mt-8 grid md:grid-cols-3 gap-4">
          {gaps.map((gap) => (
            <li key={gap}>
              <Card className="p-6 h-full flex gap-3">
                <Minus className="w-4 h-4 mt-1 shrink-0 text-gray-500 dark:text-gray-400" />
                <span className="text-[14.5px] leading-relaxed text-gray-700 dark:text-gray-300">
                  {gap}
                </span>
              </Card>
            </li>
          ))}
        </ul>
      </Section>

      {/* ------------------------------------------------------- diğerleri */}
      <Section tone="cream" size="sm">
        <h2 className="text-[20px] font-semibold text-gray-950 dark:text-white">
          {t('compare.othersTitle')}
        </h2>
        <ul className="mt-5 flex flex-wrap gap-3">
          {others.map((other) => (
            <li key={other.id}>
              <Link
                to={compareRoute(other.id)}
                className="inline-flex px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] text-[14px] font-medium text-gray-800 dark:text-gray-200 hover:border-gray-300 dark:hover:border-white/20 transition"
              >
                {t('compare.title', { name: t('compare.items.' + other.id + '.name') })}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-12">
          <h2 className="text-[26px] sm:text-[32px] font-bold tracking-[-0.03em] text-gray-950 dark:text-white">
            {t('compare.ctaTitle')}
          </h2>
          <p className="mt-3 text-[16px] leading-relaxed text-gray-600 dark:text-gray-400 max-w-[56ch]">
            {t('compare.ctaDesc')}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button to={routes.register} size="lg" arrow>
              {t('landing.home.btnStart')}
            </Button>
            <Button to={routes.pricing} variant="secondary" size="lg">
              {t('landing.home.ctaBtn2')}
            </Button>
          </div>
        </div>
      </Section>
    </Shell>
  );
};

export default Compare;
