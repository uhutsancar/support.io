// 2026-08-19 -> 19 Ağu
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import {
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Award,
  Zap,
  Calendar
} from 'lucide-react';
import { teamAPI } from '../services/api';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { errorMessage } from '../hooks/useAsync';

const formatDay = (iso: any) => {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
};

const AgentPerformance = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Must stay in step with the ranges the API accepts; anything else is a 400.
  const [timeRange, setTimeRange] = useState('7d');
  // Bumped by the retry button so the effect runs again on the same range.
  const [reloadToken, setReloadToken] = useState(0);
  const [stats, setStats] = useState({
    totalResolved: 0,
    avgResponseTime: null,
    csatScore: null,
    slaCompliance: null,
    activeChats: 0
  });

  const [dailyActivity, setDailyActivity] = useState<any[]>([]);
  const [responseTrend, setResponseTrend] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;

    const fetchPerformanceData = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data } = await teamAPI.getMyPerformance(timeRange);
        if (cancelled) return;

        const p = data.performance as Record<string, any>;
        setStats({
          totalResolved: p.totalResolved,
          avgResponseTime: p.avgResponseTime,
          csatScore: p.csatScore,
          slaCompliance: p.slaCompliance,
          activeChats: p.activeChats
        });
        setDailyActivity(p.dailyActivity.map((d: any) => ({ ...d, label: formatDay(d.day) })));
        setResponseTrend(p.responseTrend.map((d: any) => ({ ...d, label: formatDay(d.day) })));
      } catch (err) {
        if (cancelled) return;
        setError(errorMessage(err, 'Performans verileri yüklenemedi.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchPerformanceData();
    // A range change while a request is in flight must not let the older
    // response overwrite the newer one.
    return () => {
      cancelled = true;
    };
  }, [timeRange, reloadToken]);

  // A metric is null when nothing in the window could produce it (no rated
  // conversation, no reply yet). Showing a dash is honest; showing 0 is not.
  /** Renders a figure, or an em dash when the server had nothing to report. */
  const show = (value: number | null | undefined, suffix = '') =>
    value === null || value === undefined ? '—' : `${value}${suffix}`;
  const hasActivity = dailyActivity.some((d) => d.assigned > 0 || d.resolved > 0);

  const StatCard = ({
    title,
    value,
    subValue,
    icon: Icon,
    color,
    trend
  }: {
    title: string;
    /** Already formatted for display, so a dash is as valid as a number. */
    value: React.ReactNode;
    subValue?: React.ReactNode;
    icon: React.ElementType;
    color: string;
    /** Percentage change against the previous period. */
    trend?: number;
  }) => (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 transition-all hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{title}</p>
          <div className="flex items-baseline space-x-2">
            <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              {value}
            </h3>
            {subValue && (
              <span className="text-sm text-gray-500 dark:text-gray-400">{subValue}</span>
            )}
          </div>
          {trend && (
            <div
              className={`flex items-center mt-2 text-sm ${trend > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
            >
              {trend > 0 ? (
                <TrendingUp className="w-4 h-4 mr-1" />
              ) : (
                <TrendingUp className="w-4 h-4 mr-1 rotate-180" />
              )}
              <span>{Math.abs(trend)}% vs last period</span>
            </div>
          )}
        </div>
        <div
          className={`p-3 rounded-lg bg-${color}-50 dark:bg-${color}-900/40 border border-${color}-100 dark:border-${color}-900/60`}
        >
          <Icon className={`w-6 h-6 text-${color}-600 dark:text-${color}-400`} />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Helmet>
        <title>{t('sidebar.myPerformance')} - Support.io</title>
      </Helmet>

      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('sidebar.myPerformance')}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              Kendi destek metriklerinizi ve başarı oranlarınızı inceleyin.
            </p>
          </div>
          <div className="flex items-center space-x-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1 shadow-sm">
            {['7d', '30d', '90d'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  timeRange === range
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6 text-center">
            <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
            <p className="text-gray-900 dark:text-white font-medium">{error}</p>
            <button
              onClick={() => setReloadToken((n) => n + 1)}
              className="mt-4 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              Tekrar dene
            </button>
          </div>
        ) : (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
              <StatCard
                title="Çözülen Talepler"
                value={stats.totalResolved}
                icon={CheckCircle2}
                color="green"
              />
              <StatCard
                title="SLA Uyumluluğu"
                value={show(stats.slaCompliance, '%')}
                icon={Award}
                color="indigo"
              />
              <StatCard
                title="Ort. Yanıt Süresi"
                value={show(stats.avgResponseTime)}
                subValue="dk"
                icon={Zap}
                color="purple"
              />
              <StatCard
                title="Müşteri Memnuniyeti (CSAT)"
                value={show(stats.csatScore)}
                subValue="/ 5.0"
                icon={MessageSquare}
                color="yellow"
              />

              <StatCard
                title="Açık Sohbetler"
                value={stats.activeChats}
                icon={MessageSquare}
                color="blue"
              />
            </div>

            {!hasActivity && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-8 text-center">
                <MessageSquare className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <h3 className="text-gray-900 dark:text-white font-medium">
                  Bu dönemde size atanmış talep yok
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Size talep atandıkça performans metrikleriniz burada görünecek.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 transition-all hover:shadow-md">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                      Günlük Aktivite
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Son {timeRange} içerisindeki atanan ve çözülen talep dengeniz
                    </p>
                  </div>
                  <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <Calendar className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={dailyActivity}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#E5E7EB"
                        className="dark:stroke-gray-700/50"
                      />
                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#6B7280', fontSize: 12 }}
                        dy={10}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#6B7280', fontSize: 12 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1F2937',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                        }}
                        itemStyle={{ color: '#E5E7EB' }}
                        cursor={{ fill: 'rgba(107, 114, 128, 0.05)' }}
                      />
                      <Bar
                        dataKey="assigned"
                        name="Atanan"
                        fill="#818CF8"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={40}
                      />
                      <Bar
                        dataKey="resolved"
                        name="Çözülen"
                        fill="#34D399"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={40}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 transition-all hover:shadow-md">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                      Yanıt Süresi Trendi (Dk)
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Zaman içindeki geri dönüş performansınız
                    </p>
                  </div>
                  <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <Clock className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={responseTrend}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#E5E7EB"
                        className="dark:stroke-gray-700/50"
                      />
                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#6B7280', fontSize: 12 }}
                        dy={10}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#6B7280', fontSize: 12 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1F2937',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                        }}
                        itemStyle={{ color: '#E5E7EB' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="avgMinutes"
                        name="Ortalama Yanıt"
                        stroke="#A78BFA"
                        strokeWidth={4}
                        dot={{ r: 5, strokeWidth: 2, fill: '#1F2937' }}
                        activeDot={{ r: 7, strokeWidth: 0, fill: '#A78BFA' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default AgentPerformance;
