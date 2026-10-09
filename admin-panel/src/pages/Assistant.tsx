// The AI assistant, in one place: whether it can run, how much of this
// month's allowance is left, every site's switch with the FAQ it answers
// from, what it did in the last 30 days and why conversations went to a
// person. The same switches are also on each site card (SiteAssistant).
//
// Customers see "the AI assistant", never the provider or the model.

import { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Sparkles,
  MessageSquare,
  UserRound,
  MessagesSquare,
  Globe,
  ShieldCheck,
  ArrowRight,
  HelpCircle,
  AlertTriangle
} from 'lucide-react';
import { assistantAPI, sitesAPI } from '../services/api';
import { errorMessage, useAsync } from '../hooks/useAsync';
import { useLanguage } from '../contexts/LanguageContext';
import { Toggle } from '../components/sites/SiteAssistant';
import AssistantConsent from '../components/sites/AssistantConsent';
import type { AssistantOverview, AssistantSiteOverview } from '../types/api';

const number = (value: number, locale: string) => new Intl.NumberFormat(locale).format(value);

const StatCard = ({
  icon: Icon,
  label,
  value,
  tone
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone: string;
}) => (
  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${tone}`}>
      <Icon className="w-[18px] h-[18px]" />
    </div>
    <p className="mt-3 text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{value}</p>
    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{label}</p>
  </div>
);

const Assistant = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const locale = language === 'en' ? 'en-US' : 'tr-TR';
  const base = `${language === 'en' ? '/en' : ''}/dashboard`;
  const [busy, setBusy] = useState<string | null>(null);
  // The site waiting for the owner's confirmation before switching on (AI-04).
  const [asking, setAsking] = useState<AssistantSiteOverview | null>(null);

  const overview = useAsync<AssistantOverview | null>(
    () => assistantAPI.overview().then((r) => r.data),
    [],
    { initial: null, fallbackMessage: t('common.loadError', 'Yüklenemedi') }
  );
  const data = overview.data;

  const totals = useMemo(() => {
    const sites = data?.sites ?? [];
    return {
      answered: sites.reduce((n, s) => n + s.answered, 0),
      handedOver: sites.reduce((n, s) => n + s.handedOver, 0),
      conversations: sites.reduce((n, s) => n + s.conversations, 0),
      on: sites.filter((s) => s.assistantEnabled).length,
      all: sites.length
    };
  }, [data]);

  const update = async (
    site: AssistantSiteOverview,
    fields: Partial<Pick<AssistantSiteOverview, 'assistantEnabled' | 'faqAutoReply'>> & {
      assistantConsent?: boolean;
    }
  ) => {
    setBusy(site._id);
    try {
      await sitesAPI.update(site._id, fields);
      overview.setData((current) =>
        current
          ? {
              ...current,
              sites: current.sites.map((s) =>
                s._id === site._id
                  ? {
                      ...s,
                      ...(fields.assistantEnabled !== undefined
                        ? { assistantEnabled: fields.assistantEnabled }
                        : {}),
                      ...(fields.faqAutoReply !== undefined
                        ? { faqAutoReply: fields.faqAutoReply }
                        : {})
                    }
                  : s
              )
            }
          : current
      );
      toast.success(t('assistant.settings.saved'));
    } catch (error) {
      toast.error(errorMessage(error, t('assistant.settings.saveError')));
    } finally {
      setBusy(null);
    }
  };

  const usage = data?.usage;
  const share = usage && usage.limit > 0 ? Math.min(1, usage.used / usage.limit) : 0;
  const reasons = Object.entries(data?.reasons ?? {}).sort((a, b) => b[1] - a[1]);
  const how = t('assistant.page.how', { returnObjects: true }) as string[];

  return (
    <>
      <Helmet>
        <title>{`${t('assistant.page.title')} — Support.io`}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ------------------------------------------------------- başlık */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
          <div className="max-w-3xl">
            <h1 className="flex items-center gap-2.5 text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              <span className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-500/15 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              </span>
              {t('assistant.page.title')}
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">{t('assistant.page.subtitle')}</p>
          </div>
          {data && (
            <span
              className={`self-start lg:self-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                data.available
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${data.available ? 'bg-emerald-500' : 'bg-gray-400'}`}
              />
              {data.available ? t('assistant.page.connected') : t('assistant.page.notConnected')}
            </span>
          )}
        </div>

        {overview.error && (
          <p className="mb-6 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {overview.error}
          </p>
        )}
        {data && !data.available && (
          <p className="mb-6 flex gap-2.5 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            {t('assistant.page.unavailable')}
          </p>
        )}

        {overview.loading && !data ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-pulse motion-reduce:animate-none">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-xl bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
        ) : data ? (
          <>
            {/* -------------------------------------------- bu ayın hakkı */}
            {usage && (
              <div className="mb-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {t('assistant.page.usageTitle')}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {t('assistant.page.usagePlan', {
                        plan: t('pricingPage.plans.' + data.plan.toLowerCase() + '.name'),
                        per: usage.repliesPerConversation
                      })}
                    </p>
                  </div>
                  <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
                    {t('assistant.page.usageOf', {
                      used: number(usage.used, locale),
                      limit: number(usage.limit, locale)
                    })}
                  </p>
                </div>
                <div
                  className="mt-3 h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden"
                  role="progressbar"
                  aria-label={t('a11y.usage')}
                  aria-valuemin={0}
                  aria-valuemax={usage.limit}
                  aria-valuenow={usage.used}
                >
                  <div
                    className={`h-full rounded-full transition-all ${share >= 1 ? 'bg-red-500' : share >= 0.8 ? 'bg-amber-500' : 'bg-violet-500'}`}
                    style={{ width: `${Math.max(share * 100, usage.used ? 2 : 0)}%` }}
                  />
                </div>
                {(share >= 0.8 || data.plan !== 'ENTERPRISE') && (
                  <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {share >= 1
                        ? t('assistant.page.usageFull')
                        : share >= 0.8
                          ? t('assistant.page.usageNear')
                          : ''}
                    </p>
                    {data.plan !== 'ENTERPRISE' && (
                      <Link
                        to={`${base}/billing`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        {t('assistant.page.upgrade')} <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* -------------------------------------------- son 30 gün */}
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
              {t('assistant.page.window', { days: data.days })}
            </p>
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-8">
              <StatCard
                icon={MessageSquare}
                label={t('assistant.page.stats.answered')}
                value={number(totals.answered, locale)}
                tone="bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300"
              />
              <StatCard
                icon={UserRound}
                label={t('assistant.page.stats.handedOver')}
                value={number(totals.handedOver, locale)}
                tone="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
              />
              <StatCard
                icon={MessagesSquare}
                label={t('assistant.page.stats.conversations')}
                value={number(totals.conversations, locale)}
                tone="bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300"
              />
              <StatCard
                icon={Globe}
                label={t('assistant.page.stats.sitesOn')}
                value={`${totals.on} / ${totals.all}`}
                tone="bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              {/* ------------------------------------------------ siteler */}
              <section className="min-w-0">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t('assistant.page.sitesTitle')}
                </h2>
                <p className="mt-1 mb-4 text-sm text-gray-500 dark:text-gray-400">
                  {t('assistant.page.sitesHelp')}
                </p>
                {data.sites.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    {t('assistant.page.noSites')}{' '}
                    <Link
                      to={`${base}/sites`}
                      className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      {t('sidebar.sites')}
                    </Link>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {data.sites.map((site) => (
                      <li
                        key={site._id}
                        className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-gray-900 dark:text-white truncate">
                              {site.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {site.domain}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                              {site.faqCount > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                  <HelpCircle className="w-3 h-3" />
                                  {t('assistant.page.faqCount', { count: site.faqCount })}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                                  <AlertTriangle className="w-3 h-3" />
                                  {t('assistant.page.noFaq')}
                                </span>
                              )}
                              <span className="text-gray-500 dark:text-gray-400">
                                {t('assistant.page.answeredShort', { count: site.answered })} ·{' '}
                                {t('assistant.page.handedShort', { count: site.handedOver })}
                              </span>
                              <Link
                                to={`${base}/faqs`}
                                className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                              >
                                {site.faqCount > 0
                                  ? t('assistant.page.faqLink')
                                  : t('assistant.page.addFaq')}
                              </Link>
                            </div>
                          </div>
                          <div className="sm:w-60 shrink-0 space-y-3">
                            <Toggle
                              id={`assistant-${site._id}`}
                              checked={site.assistantEnabled}
                              disabled={
                                busy === site._id || (!data.available && !site.assistantEnabled)
                              }
                              onChange={(value) =>
                                value ? setAsking(site) : update(site, { assistantEnabled: false })
                              }
                              label={t('assistant.page.assistantSwitch')}
                              help={t('assistant.page.assistantHelp')}
                            />
                            <Toggle
                              id={`keyword-${site._id}`}
                              checked={site.faqAutoReply}
                              disabled={busy === site._id || site.assistantEnabled}
                              onChange={(value) => update(site, { faqAutoReply: value })}
                              label={t('assistant.page.keywordSwitch')}
                              help={t('assistant.page.keywordHelp')}
                            />
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {/* --------------------------------- neden ekibe aktarıldı */}
                <h2 className="mt-8 text-lg font-semibold text-gray-900 dark:text-white">
                  {t('assistant.page.reasonsTitle')}
                </h2>
                {reasons.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    {t('assistant.page.reasonsEmpty')}
                  </p>
                ) : (
                  <ul className="mt-3 divide-y divide-gray-100 dark:divide-gray-700 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                    {reasons.map(([reason, count]) => (
                      <li key={reason} className="px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm text-gray-800 dark:text-gray-200">
                            {t('assistant.reasons.' + reason, reason)}
                          </span>
                          <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                            {number(count, locale)}
                          </span>
                        </div>
                        {t('assistant.page.reasonHints.' + reason, { defaultValue: '' }) && (
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {t('assistant.page.reasonHints.' + reason)}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* ------------------------------------------ sağ sütun */}
              <aside className="space-y-4 min-w-0">
                {/* Ziyaretçinin gördüğü — balonun içindeki satırlarla aynı biçim. */}
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                  <p className="px-4 pt-4 text-sm font-semibold text-gray-900 dark:text-white">
                    {t('assistant.page.previewTitle')}
                  </p>
                  <div className="m-4 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="px-3 py-2 bg-indigo-600 text-white text-xs font-medium">
                      {t('assistant.page.previewHeader')}
                    </div>
                    <div className="p-3 space-y-2 bg-gray-50 dark:bg-gray-900">
                      <div className="ml-auto w-fit max-w-[85%] px-3 py-2 rounded-2xl rounded-br-md bg-indigo-600 text-white text-xs">
                        {t('assistant.page.previewQuestion')}
                      </div>
                      <div className="max-w-[90%]">
                        <span className="mb-1 flex items-center gap-1 text-[10px] font-medium text-violet-600 dark:text-violet-300">
                          <Sparkles className="w-3 h-3" /> {t('assistant.label')}
                        </span>
                        <div className="px-3 py-2 rounded-2xl rounded-bl-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-800 dark:text-gray-100">
                          {t('assistant.page.previewAnswer')}
                        </div>
                        <span className="mt-1 block text-[10px] text-gray-600 dark:text-gray-400">
                          {t('assistant.page.previewSource')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {t('assistant.page.howTitle')}
                  </p>
                  <ol className="mt-3 space-y-3">
                    {(Array.isArray(how) ? how : []).map((step, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="w-6 h-6 shrink-0 rounded-full bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 text-xs font-semibold flex items-center justify-center">
                          {i + 1}
                        </span>
                        <span className="text-sm text-gray-600 dark:text-gray-300">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    {t('assistant.page.privacyTitle')}
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                    {['rule1', 'rule2', 'rule3'].map((rule) => (
                      <li key={rule} className="flex gap-2">
                        <span className="mt-2 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <span>{t('assistant.settings.' + rule)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </aside>
            </div>
          </>
        ) : null}
      </div>
      {asking && (
        <AssistantConsent
          siteName={asking.name}
          onCancel={() => setAsking(null)}
          onConfirm={() => {
            const site = asking;
            setAsking(null);
            void update(site, { assistantEnabled: true, assistantConsent: true });
          }}
        />
      )}
    </>
  );
};

export default Assistant;
