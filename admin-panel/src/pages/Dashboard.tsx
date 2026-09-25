/**
 * Gösterge paneli.
 *
 * Açılan ilk ekran, "şu an ne yapmalıyım" sorusunu cevaplar: dönem özeti,
 * konuşma akışı, dikkat isteyen işler, son konuşmalar, asistanın durumu ve
 * kurulumun nerede kaldığı.
 *
 * Eski sürümden düzeltilenler:
 *
 *  - Kartlarda "+%20", "+%0" gibi sabit yazılmış artış rozetleri vardı; hiçbir
 *    veriye dayanmıyordu. Önceki dönemle karşılaştırma verisi yok, dolayısıyla
 *    rozet de yok; kartın altında dönem boyunca günlük seyri gösteren küçük
 *    bir çizgi var.
 *  - Başlık "Son 7 gün" diyordu, veri 30 günlük çekiliyordu. Dönem artık
 *    seçilebilir ve başlık seçileni söyler.
 *  - "Şimdi yükselt" düğmesi hiçbir şey yapmıyordu; fiyat sayfasına gider.
 *  - Konuşma satırına tıklamak Konuşmalar sayfasına bir olay gönderiyordu,
 *    ama sayfa henüz yüklenmediği için olayı kimse dinlemiyordu. Artık
 *    `?id=` ile açılır.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Circle,
  Clock,
  Globe,
  Inbox,
  Lock,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Smile,
  Sparkles,
  UserPlus,
  Users
} from 'lucide-react';
import {
  sitesAPI,
  conversationsAPI,
  analyticsAPI,
  aiAPI,
  teamAPI,
  clearCache
} from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useLanguage } from '../contexts/LanguageContext';
import { formatMinutes, formatChatTimestamp } from '../lib/format';
import { conversationStatusBadge, priorityBadge } from '../lib/statusStyles';
import type { AIStatus, Conversation, Site, TeamMember } from '../types/api';

type Range = 'today' | '7days' | '30days';
const RANGES: Range[] = ['today', '7days', '30days'];

interface Summary {
  openTickets: number;
  unassigned: number;
  slaBreaches: number;
  satisfaction: number | null;
  ratedCount: number;
  activeAgents: number;
  totalAgents: number;
  avgFirstResponseMinutes: number | null;
  avgResolutionMinutes: number | null;
  totalConversations: number;
  resolvedToday: number;
  slaComplianceRate: number | null;
}

interface DayPoint {
  date: string;
  tickets: number;
  resolved: number;
  /** Conversations whose first reply met the target that day. */
  sla: number;
}

const EMPTY: Summary = {
  openTickets: 0,
  unassigned: 0,
  slaBreaches: 0,
  satisfaction: null,
  ratedCount: 0,
  activeAgents: 0,
  totalAgents: 0,
  avgFirstResponseMinutes: null,
  avgResolutionMinutes: null,
  totalConversations: 0,
  resolvedToday: 0,
  slaComplianceRate: null
};

/* ------------------------------------------------------------ parçalar */

const Panel = ({
  title,
  action,
  children,
  className = ''
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) => (
  <section
    className={[
      'rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900',
      className
    ].join(' ')}
  >
    {title && (
      <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
        <h2 className="text-[14.5px] font-semibold text-gray-900 dark:text-white">{title}</h2>
        {action}
      </header>
    )}
    {children}
  </section>
);

/** Küçük dönem çizgisi: yalnızca seyri gösterir, ekseni yok. */
const Spark = ({ data, dataKey }: { data: DayPoint[]; dataKey: keyof DayPoint }) =>
  data.length > 1 ? (
    <div className="viz h-9 -mx-1 mt-3" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke="var(--viz-s1)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  ) : (
    <div className="h-9 mt-3" />
  );

const Kpi = ({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  spark
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone: string;
  spark?: React.ReactNode;
}) => (
  <Panel className="p-5">
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12.5px] font-medium text-gray-500 dark:text-gray-400">{label}</span>
      <span className={['w-8 h-8 rounded-lg flex items-center justify-center', tone].join(' ')}>
        <Icon className="w-4 h-4" />
      </span>
    </div>
    <p className="mt-2 text-[28px] font-semibold tracking-tight text-gray-900 dark:text-white tabular-nums">
      {value}
    </p>
    {hint && <p className="text-[12px] text-gray-500 dark:text-gray-400">{hint}</p>}
    {spark}
  </Panel>
);

/* ---------------------------------------------------------------- sayfa */

const Dashboard = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { user } = useAuth();
  const { socket } = useSocket();
  const langPrefix = language === 'en' ? '/en' : '';
  const base = `${langPrefix}/dashboard`;
  const role = user?.role || 'agent';
  const isAgent = role === 'agent';
  const canManage = ['owner', 'admin'].includes(role);
  const plan = user?.organization?.planType || 'FREE';
  const reportsLocked = plan === 'FREE';

  const [range, setRange] = useState<Range>('7days');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [summary, setSummary] = useState<Summary>(EMPTY);
  const [daily, setDaily] = useState<DayPoint[]>([]);
  const [recent, setRecent] = useState<Conversation[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [ai, setAi] = useState<AIStatus | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setFailed(false);
      try {
        clearCache();
        const siteList = (await sitesAPI.getAll()).data.sites || [];
        setSites(siteList);

        // Asistan durumu ve ekip kritik değil; biri düşerse sayfa yine açılır.
        aiAPI.status().then((r) => setAi(r.data)).catch(() => setAi(null));
        if (canManage)
          teamAPI.getAll().then((r) => setTeam(Array.isArray(r.data) ? r.data : [])).catch(() => setTeam([]));

        if (isAgent) {
          // Temsilci kendi kuyruğunu görür; organizasyon raporu yetkisi yok.
          const assigned = (await conversationsAPI.getAssigned()).data as unknown;
          const list: Conversation[] = Array.isArray(assigned)
            ? assigned
            : ((assigned as { conversations?: Conversation[] })?.conversations ?? []);
          setSummary({
            ...EMPTY,
            openTickets: list.filter((c) => ['open', 'assigned', 'pending'].includes(c.status)).length,
            totalConversations: list.length
          });
          setDaily([]);
          setRecent(
            [...list]
              .sort((a, b) => +new Date(b.lastMessageAt) - +new Date(a.lastMessageAt))
              .slice(0, 6)
          );
          return;
        }

        const [overview, pages] = await Promise.all([
          analyticsAPI.getOverview(range),
          Promise.all(
            siteList.map((site) =>
              conversationsAPI
                .getAll(site._id, { limit: 6 })
                .then((r) => r.data.conversations || [])
                .catch(() => [] as Conversation[])
            )
          )
        ]);
        setSummary({ ...EMPTY, ...(overview.data.stats as unknown as Partial<Summary>) });
        setDaily((overview.data.dailyTickets as unknown as DayPoint[]) || []);
        setRecent(
          pages
            .flat()
            .sort((a, b) => +new Date(b.lastMessageAt) - +new Date(a.lastMessageAt))
            .slice(0, 6)
        );
      } catch (error) {
        console.error('[dashboard] request failed', error);
        setFailed(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [range, isAgent, canManage]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Canlı güncelleme: olaylar arka arkaya gelir (bir mesaj hem new-message hem
  // conversation-update tetikler), bu yüzden yenileme bir saniye toplanır.
  useEffect(() => {
    if (!socket) return undefined;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => load(true), 1000);
    };
    const events = [
      'new-conversation',
      'conversation-assigned',
      'new-message',
      'conversation-update',
      'conversation-resolved',
      'sla-breach'
    ];
    events.forEach((e) => socket.on(e, refresh));
    return () => {
      if (timer) clearTimeout(timer);
      events.forEach((e) => socket.off(e, refresh));
    };
  }, [socket, load]);

  const locale = language === 'tr' ? 'tr-TR' : 'en-US';
  const chartData = useMemo(
    () =>
      daily.map((d) => ({
        ...d,
        label: new Date(d.date).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
      })),
    [daily, locale]
  );

  const hour = new Date().getHours();
  const greeting = t(
    'dash.greeting.' + (hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening')
  );
  const firstName = (user?.name || '').split(' ')[0];

  /* ------------------------------------------------------- kurulum listesi */

  const installed = sites.some((s) => s.installation?.verifiedAt || s.installation?.lastSeenAt);
  const aiModeSet = sites.some((s) => s.aiSettings?.mode && s.aiSettings.mode !== 'off');
  const checklist = [
    { key: 'site', done: sites.length > 0, to: `${base}/sites` },
    { key: 'install', done: installed, to: `${base}/sites` },
    { key: 'team', done: team.length > 1, to: `${base}/team` },
    { key: 'ai', done: aiModeSet, to: `${base}/sites` }
  ];
  const doneCount = checklist.filter((i) => i.done).length;

  /* ------------------------------------------------------------- dikkat */

  const onlineAgents = team.filter((m) => m.status === 'online').length;
  const attention = [
    summary.unassigned > 0 && {
      key: 'unassigned',
      icon: Inbox,
      tone: 'text-amber-600 dark:text-amber-400',
      text: t('dash.attention.unassigned', { count: summary.unassigned }),
      to: `${base}/conversations`
    },
    summary.slaBreaches > 0 && {
      key: 'sla',
      icon: AlertTriangle,
      tone: 'text-rose-600 dark:text-rose-400',
      text: t('dash.attention.sla', { count: summary.slaBreaches }),
      to: `${base}/conversations`
    },
    canManage &&
      team.length > 0 &&
      onlineAgents === 0 && {
        key: 'offline',
        icon: Users,
        tone: 'text-gray-500 dark:text-gray-400',
        text: t('dash.attention.noneOnline'),
        to: `${base}/team`
      }
  ].filter(Boolean) as Array<{ key: string; icon: React.ElementType; tone: string; text: string; to: string }>;

  /* --------------------------------------------------------------- AI */

  const aiState = ai?.state || 'disabled';
  const aiStateTone: Record<string, string> = {
    ready: 'bg-emerald-500',
    warming_up: 'bg-amber-500',
    unavailable: 'bg-rose-500',
    disabled: 'bg-gray-400'
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto animate-pulse" aria-busy="true">
        <div className="h-8 w-64 rounded-lg bg-gray-200 dark:bg-gray-800" />
        <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-36 rounded-2xl bg-gray-200/70 dark:bg-gray-800/70" />
          ))}
        </div>
        <div className="mt-4 h-80 rounded-2xl bg-gray-200/70 dark:bg-gray-800/70" />
      </div>
    );
  }

  const rangeLabel = t('dash.range.' + range);

  return (
    <>
      <Helmet>
        <title>{t('dashboard.title') + ' — Support.io'}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* `viz`: grafik renkleri (index.css) lejantta da aynı değişkenden okunur. */}
      <div className="viz max-w-7xl mx-auto">
        {/* ------------------------------------------------------------ başlık */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[13px] text-gray-500 dark:text-gray-400">
              {new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1 className="mt-1 text-[26px] font-semibold tracking-tight text-gray-900 dark:text-white">
              {greeting}
              {firstName ? `, ${firstName}` : ''}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {!isAgent && (
              <div
                role="radiogroup"
                aria-label={t('dash.range.label')}
                className="inline-flex p-1 rounded-xl bg-gray-100 dark:bg-gray-800"
              >
                {RANGES.map((r) => (
                  <button
                    key={r}
                    role="radio"
                    aria-checked={range === r}
                    onClick={() => setRange(r)}
                    className={[
                      'px-3 py-1.5 rounded-lg text-[12.5px] font-medium whitespace-nowrap transition',
                      range === r
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    ].join(' ')}
                  >
                    {t('dash.range.' + r)}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-50"
              aria-label={t('dashboard.refresh')}
              title={t('dashboard.refresh')}
            >
              <RefreshCw className={['w-4 h-4', refreshing ? 'animate-spin' : ''].join(' ')} />
            </button>
            <Link
              to={`${base}/conversations`}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-medium transition"
            >
              <MessageSquare className="w-4 h-4" />
              {t('dash.openInbox')}
            </Link>
          </div>
        </div>

        {failed && (
          <div
            role="alert"
            className="mt-6 flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-[13px] text-rose-700 dark:text-rose-300"
          >
            {t('dash.failed')}
            <button onClick={() => load()} className="font-semibold underline">
              {t('dash.retry')}
            </button>
          </div>
        )}

        {/* ------------------------------------------------------------ kartlar */}
        <div className="mt-7 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi
            icon={MessageSquare}
            label={t('dashboard.openTickets')}
            value={summary.openTickets}
            hint={isAgent ? t('dash.hint.mine') : t('dash.hint.of', { count: summary.totalConversations, range: rangeLabel })}
            tone="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
            spark={<Spark data={daily} dataKey="tickets" />}
          />
          <Kpi
            icon={Clock}
            label={t('dashboard.avgFirstResponse')}
            value={summary.avgFirstResponseMinutes == null ? '—' : formatMinutes(summary.avgFirstResponseMinutes)}
            hint={
              summary.slaComplianceRate == null
                ? t('dash.hint.noSla')
                : t('dash.hint.sla', { rate: summary.slaComplianceRate })
            }
            tone="bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400"
            spark={<Spark data={daily} dataKey="sla" />}
          />
          <Kpi
            icon={CheckCircle2}
            label={t('dashboard.resolvedToday')}
            value={summary.resolvedToday}
            hint={
              summary.avgResolutionMinutes == null
                ? t('dash.hint.noResolution')
                : t('dash.hint.resolution', { time: formatMinutes(summary.avgResolutionMinutes) })
            }
            tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
            spark={<Spark data={daily} dataKey="resolved" />}
          />
          <Kpi
            icon={Smile}
            label={t('dashboard.customerSatisfaction')}
            value={summary.satisfaction == null ? '—' : t('dash.percent', { value: summary.satisfaction })}
            hint={t('dash.hint.rated', { count: summary.ratedCount })}
            tone="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
          />
        </div>

        {/* ------------------------------------------------ grafik + dikkat */}
        <div className="mt-4 grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4">
          <Panel
            title={t('dash.flow.title')}
            action={
              !reportsLocked && chartData.length > 0 ? (
                <ul className="flex items-center gap-4 text-[12px] text-gray-600 dark:text-gray-400">
                  <li className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--viz-s1)' }} />
                    {t('dash.flow.incoming')}
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--viz-s2)' }} />
                    {t('dash.flow.resolved')}
                  </li>
                </ul>
              ) : undefined
            }
          >
            {reportsLocked ? (
              <div className="mx-5 mb-5 h-[260px] rounded-xl border border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center text-center px-6">
                <Lock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <p className="mt-3 text-[14px] font-semibold text-gray-900 dark:text-white">
                  {t('dash.locked.title')}
                </p>
                <p className="mt-1 max-w-[42ch] text-[13px] text-gray-500 dark:text-gray-400">
                  {t('dash.locked.body')}
                </p>
                <Link
                  to={language === 'en' ? '/en/pricing' : '/fiyatlandirma'}
                  className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[12.5px] font-medium"
                >
                  {t('dash.locked.cta')} <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : chartData.length === 0 ? (
              <p className="px-5 pb-10 pt-6 text-center text-[13px] text-gray-500">{t('dash.flow.empty')}</p>
            ) : (
              <div className="viz h-[260px] px-2 pb-3" role="img" aria-label={t('dash.flow.alt', { range: rangeLabel })}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dash-in" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--viz-s1)" stopOpacity={0.18} />
                        <stop offset="100%" stopColor="var(--viz-s1)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="0" className="stroke-gray-100 dark:stroke-gray-800" />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      minTickGap={18}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      width={40}
                    />
                    <Tooltip
                      cursor={{ stroke: '#9ca3af', strokeDasharray: '3 3' }}
                      contentStyle={{
                        borderRadius: 10,
                        border: '1px solid rgba(148,163,184,.3)',
                        background: 'var(--toast-bg)',
                        color: 'var(--toast-color)',
                        fontSize: 12
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="tickets"
                      name={t('dash.flow.incoming')}
                      stroke="var(--viz-s1)"
                      strokeWidth={2}
                      fill="url(#dash-in)"
                      activeDot={{ r: 4, strokeWidth: 2 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="resolved"
                      name={t('dash.flow.resolved')}
                      stroke="var(--viz-s2)"
                      strokeWidth={2}
                      fill="transparent"
                      activeDot={{ r: 4, strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>

          <Panel title={t('dash.attention.title')}>
            <div className="px-5 pb-5">
              {attention.length === 0 ? (
                <div className="flex items-center gap-3 py-4">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <p className="text-[13.5px] text-gray-600 dark:text-gray-400">{t('dash.attention.clear')}</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {attention.map((a) => (
                    <li key={a.key}>
                      <Link
                        to={a.to}
                        className="group flex items-center gap-3 px-3 py-3 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition"
                      >
                        <a.icon className={['w-4 h-4 shrink-0', a.tone].join(' ')} />
                        <span className="flex-1 text-[13.5px] text-gray-800 dark:text-gray-200">{a.text}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-gray-400 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              {canManage && team.length > 0 && (
                <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">
                    {t('dash.team.online', { online: onlineAgents, total: team.length })}
                  </p>
                  <div className="mt-2.5 flex -space-x-2">
                    {team.slice(0, 7).map((m) => (
                      <span
                        key={m._id}
                        title={`${m.name} · ${t('status.' + (m.status || 'offline'))}`}
                        className="relative w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 ring-2 ring-white dark:ring-gray-900 flex items-center justify-center text-[11px] font-semibold"
                      >
                        {(m.name || '?').charAt(0).toUpperCase()}
                        <span
                          className={[
                            'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-gray-900',
                            m.status === 'online' ? 'bg-emerald-500' : m.status === 'away' ? 'bg-amber-500' : m.status === 'busy' ? 'bg-rose-500' : 'bg-gray-400'
                          ].join(' ')}
                        />
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Panel>
        </div>

        {/* ---------------------------------------- son konuşmalar + yan sütun */}
        <div className="mt-4 grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4">
          <Panel
            title={t('dash.recent.title')}
            action={
              <Link
                to={`${base}/conversations`}
                className="text-[12.5px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {t('dashboard.viewAll')}
              </Link>
            }
          >
            {recent.length === 0 ? (
              <div className="px-5 pb-10 pt-4 text-center">
                <Inbox className="w-6 h-6 mx-auto text-gray-300 dark:text-gray-600" />
                <p className="mt-2 text-[13px] text-gray-500 dark:text-gray-400">{t('dashboard.noTickets')}</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {recent.map((c) => (
                  <li key={c._id}>
                    <Link
                      to={`${base}/conversations?id=${c._id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition"
                    >
                      <span className="w-9 h-9 shrink-0 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[12px] font-semibold text-gray-600 dark:text-gray-300">
                        {(c.visitorName || 'Z').charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="text-[13.5px] font-medium text-gray-900 dark:text-white truncate">
                            {c.visitorName || t('dashboard.visitor')}
                          </span>
                          <span className="text-[11.5px] text-gray-400 tabular-nums">
                            {c.ticketId || (c.ticketNumber ? `#${c.ticketNumber}` : '')}
                          </span>
                          {c.responseOwner === 'ai' && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-[1px] rounded text-[10.5px] font-medium bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
                              <Bot className="w-3 h-3" /> {t('dash.recent.ai')}
                            </span>
                          )}
                        </span>
                        <span className="block text-[12.5px] text-gray-500 dark:text-gray-400 truncate">
                          {c.lastMessage?.content || t('dash.recent.noPreview')}
                        </span>
                      </span>
                      <span className="hidden sm:flex items-center gap-1.5 shrink-0">
                        <span className={['px-2 py-0.5 rounded-full text-[11px] font-medium', priorityBadge(c.priority)].join(' ')}>
                          {t('dashboard.' + (c.priority === 'normal' ? 'medium' : c.priority))}
                        </span>
                        <span className={['px-2 py-0.5 rounded-full text-[11px] font-medium', conversationStatusBadge(c.status)].join(' ')}>
                          {t('dashboard.' + (c.status === 'unassigned' ? 'open' : c.status))}
                        </span>
                      </span>
                      <span className="w-14 text-right text-[11.5px] text-gray-400 tabular-nums shrink-0">
                        {formatChatTimestamp(c.lastMessageAt, t('dash.recent.yesterday'))}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <div className="space-y-4">
            {/* ---- asistan ---- */}
            <Panel
              title={
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  {t('dash.ai.title')}
                </span>
              }
            >
              <div className="px-5 pb-5">
                <p className="flex items-center gap-2 text-[13px] text-gray-700 dark:text-gray-300">
                  <span className={['w-2 h-2 rounded-full', aiStateTone[aiState] || 'bg-gray-400'].join(' ')} />
                  {t('dash.ai.state.' + aiState)}
                  {ai?.model && aiState === 'ready' && (
                    <span className="text-[11.5px] text-gray-400 truncate">· {ai.model}</span>
                  )}
                </p>
                <p className="mt-2 text-[12.5px] leading-relaxed text-gray-500 dark:text-gray-400">
                  {t('dash.ai.body.' + aiState)}
                </p>
                {sites.length > 0 && (
                  <ul className="mt-4 space-y-1.5">
                    {sites.slice(0, 4).map((s) => (
                      <li key={s._id} className="flex items-center justify-between gap-2 text-[12.5px]">
                        <span className="flex items-center gap-1.5 min-w-0 text-gray-700 dark:text-gray-300">
                          <Globe className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="truncate">{s.name}</span>
                        </span>
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                          {t('dash.ai.mode.' + (s.aiSettings?.mode || 'off'))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {canManage && (
                  <Link
                    to={`${base}/sites`}
                    className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    {t('dash.ai.manage')} <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            </Panel>

            {/* ---- kurulum ---- */}
            {canManage && doneCount < checklist.length && (
              <Panel
                title={t('dash.setup.title')}
                action={
                  <span className="text-[12px] text-gray-500 tabular-nums">
                    {doneCount}/{checklist.length}
                  </span>
                }
              >
                <div className="px-5">
                  <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-600 transition-all"
                      style={{ width: `${(doneCount / checklist.length) * 100}%` }}
                    />
                  </div>
                </div>
                <ul className="px-3 py-3">
                  {checklist.map((item) => (
                    <li key={item.key}>
                      <Link
                        to={item.to}
                        className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition"
                      >
                        {item.done ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0" />
                        )}
                        <span
                          className={[
                            'text-[13px]',
                            item.done ? 'text-gray-400 line-through' : 'text-gray-800 dark:text-gray-200'
                          ].join(' ')}
                        >
                          {t('dash.setup.' + item.key)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}

            {canManage && doneCount === checklist.length && (
              <Panel className="p-5">
                <Link to={`${base}/team`} className="flex items-center gap-3 group">
                  <UserPlus className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <span className="flex-1 text-[13.5px] font-medium text-gray-900 dark:text-white">
                    {t('dash.invite')}
                  </span>
                  <ArrowRight className="w-4 h-4 text-gray-400 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Panel>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
