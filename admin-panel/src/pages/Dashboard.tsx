import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import {
  MessageSquare,
  Globe,
  Users,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  UserCheck,
  TrendingDown,
  Activity,
  Lock
} from 'lucide-react';
import { sitesAPI, conversationsAPI, analyticsAPI, clearCache } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { formatDate, formatMinutes, formatTime } from '../lib/format';
import {
  conversationStatusBadge as getStatusBadge,
  priorityBadge as getPriorityBadge
} from '../lib/statusStyles';

const sortByNewest = (conversations: any) =>
  [...conversations].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

// Yalnizca temsilci panosu icin: kendisine atanmis, sinirli sayidaki konusma
// uzerinden ozet. Organizasyon geneli rakamlar icin kullanilmaz, cunku bir
// sayfa veriden organizasyon toplami cikarilamaz.
const statsFromConversations = (conversations: any, activeSites: any) => {
  const open = conversations.filter((c: any) =>
    ['open', 'unassigned', 'assigned', 'pending'].includes(c.status)
  ).length;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const rated = conversations.filter((c: any) => c.rating?.score);
  const measured = conversations.filter((c: any) =>
    ['met', 'breached'].includes(c.sla?.firstResponseStatus)
  );
  const met = measured.filter((c: any) => c.sla.firstResponseStatus === 'met').length;
  const withResponse = conversations.filter((c: any) => c.responseTime);
  const withResolution = conversations.filter((c: any) => c.resolutionTime);
  const average = (rows: any, pick: any) =>
    rows.length
      ? Math.round(rows.reduce((sum: number, row: any) => sum + (pick(row) || 0), 0) / rows.length)
      : 0;

  return {
    openTickets: open,
    slaBreaches: conversations.filter(
      (c: any) =>
        c.sla?.firstResponseStatus === 'breached' || c.sla?.resolutionStatus === 'breached'
    ).length,
    unassignedTickets: conversations.filter(
      (c: any) => ['open', 'unassigned'].includes(c.status) && !c.assignedAgent
    ).length,
    customerSatisfaction: rated.length
      ? Math.round(
          (rated.reduce((sum: number, c: any) => sum + c.rating.score, 0) / rated.length) * 20
        )
      : 0,
    activeAgents: 0,
    totalAgents: 0,
    avgFirstResponseTime: average(withResponse, (c: any) => c.responseTime),
    avgResolutionTime: average(withResolution, (c: any) => c.resolutionTime),
    totalConversations: conversations.length,
    activeSites,
    resolvedToday: conversations.filter(
      (c: any) => c.resolvedAt && new Date(c.resolvedAt) >= startOfToday
    ).length,
    slaComplianceRate: measured.length ? Math.round((met / measured.length) * 100) : 0
  };
};

const Dashboard = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const langPrefix = language === 'en' ? '/en' : '';
  const routes = {
    sites: `${langPrefix}/dashboard/sites`,
    conversations: `${langPrefix}/dashboard/conversations`,
    team: `${langPrefix}/dashboard/team`
  };
  const [stats, setStats] = useState({
    openTickets: 0,
    slaBreaches: 0,
    unassignedTickets: 0,
    customerSatisfaction: 0,
    activeAgents: 0,
    totalAgents: 0,
    avgFirstResponseTime: 0,
    avgResolutionTime: 0,
    totalConversations: 0,
    activeSites: 0,
    resolvedToday: 0,
    slaComplianceRate: 0
  });
  const [recentTickets, setRecentTickets] = useState<any[]>([]);
  const { socket } = useSocket();
  const { user } = useAuth();
  const plan = user?.organization?.planType || 'FREE';
  useEffect(() => {
    fetchDashboardData();
    const refresh = () => fetchDashboardData(true);
    const onSlaBreach = (data: any) => {
      setStats((prev) => ({
        ...prev,
        slaBreaches: prev.slaBreaches + 1
      }));
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('SLA İhlali!', {
          body: `Talep #${data.ticketNumber} - ${data.type === 'first-response' ? 'İlk yanıt' : 'Çözüm'} süresi aşıldı`,
          icon: '/favicon.ico',
          tag: 'sla-breach'
        });
      }
      fetchDashboardData(true);
    };
    if (socket) {
      socket.on('new-conversation', refresh);
      socket.on('conversation-assigned', refresh);
      socket.on('new-message', refresh);
      socket.on('conversation-update', refresh);
      socket.on('sla-breach', onSlaBreach);
      socket.on('conversation-resolved', refresh);
    }
    const interval = setInterval(() => {
      fetchDashboardData(true);
    }, 60000);
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchDashboardData(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (socket) {
        socket.off('new-conversation', refresh);
        socket.off('conversation-assigned', refresh);
        socket.off('new-message', refresh);
        socket.off('conversation-update', refresh);
        socket.off('sla-breach', onSlaBreach);
        socket.off('conversation-resolved', refresh);
      }
    };
  }, [socket]);
  const fetchDashboardData = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      clearCache();
      const sitesResponse = await sitesAPI.getAll();
      const sites = sitesResponse.data.sites || [];
      const activeSites = sites.filter((site) => site.isActive).length;

      if (user?.role === 'agent') {
        // Temsilci panosu kendi kuyrugunu ozetler; bu kume zaten sinirlidir.
        let assigned: any[] = [];
        try {
          const assignedResp = await conversationsAPI.getAssigned();
          assigned = assignedResp.data.conversations || assignedResp.data || [];
        } catch (error) {
          // Reported rather than discarded: a silent failure here leaves the
          // page showing stale data with nothing to say why.
          console.error('[dashboard] request failed', error);
        }
        setStats(statsFromConversations(assigned, activeSites));
        setRecentTickets(sortByNewest(assigned).slice(0, 5));
        return;
      }

      // Ozet rakamlar sunucuda, TUM kayitlar uzerinde hesaplanir.
      //
      // Onceki hali her site icin liste ucundan bir sayfa cekip tarayicida
      // topluyordu. Sayfa basina sinir oldugu icin bir sayfadan fazla gecmisi
      // olan her kiracida acik talep, SLA ihlali ve memnuniyet rakamlari
      // oldugundan dusuk cikiyordu ve bunun ekranda hicbir isareti yoktu.
      // Ustelik siteler ve ekipler sirayla cekiliyordu: 20 siteli bir kiracida
      // pano acilisi 40 ardisik istek demekti.
      const overview = await analyticsAPI.getOverview('30days');
      const summary = (overview.data.stats || {}) as Record<string, any>;

      // Son talepler gercek satirlar ister; her siteden yalnizca en yeni
      // birkacini paralel cekip birlestirmek yeterlidir.
      const recentPages = await Promise.all(
        sites.map((site) =>
          conversationsAPI
            .getAll(site._id, { limit: 5 })
            .then((response) => response.data.conversations || [])
            .catch(() => [])
        )
      );

      setStats({
        openTickets: summary.openTickets ?? 0,
        slaBreaches: summary.slaBreaches ?? 0,
        unassignedTickets: summary.unassigned ?? 0,
        customerSatisfaction: summary.satisfaction ?? 0,
        activeAgents: summary.activeAgents ?? 0,
        totalAgents: summary.totalAgents ?? 0,
        avgFirstResponseTime: Math.round(summary.avgFirstResponseMinutes ?? 0),
        avgResolutionTime: Math.round(summary.avgResolutionMinutes ?? 0),
        totalConversations: summary.totalConversations ?? 0,
        activeSites,
        resolvedToday: summary.resolvedToday ?? 0,
        slaComplianceRate: summary.slaComplianceRate ?? 0
      });
      setRecentTickets(sortByNewest(recentPages.flat()).slice(0, 5));
    } catch (error) {
      // Reported rather than discarded: a silent failure here leaves the
      // page showing stale data with nothing to say why.
      console.error('[dashboard] request failed', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }
  const mainStats = [
    {
      icon: MessageSquare,
      label: t('dashboard.openTickets'),
      value: stats.openTickets,
      color: 'bg-purple-600',
      change: '+0%',
      trend: 'up'
    },
    {
      icon: AlertCircle,
      label: t('dashboard.slaBreaches'),
      value: stats.slaBreaches,
      color: 'bg-red-600',
      change: stats.slaBreaches > 0 ? `${stats.slaBreaches}` : '0',
      trend: stats.slaBreaches > 0 ? 'down' : 'neutral'
    },
    {
      icon: Clock,
      label: t('dashboard.unassignedTickets'),
      value: stats.unassignedTickets,
      color: 'bg-green-600',
      change: stats.unassignedTickets > 0 ? t('dashboard.waiting') : t('dashboard.none'),
      trend: stats.unassignedTickets > 0 ? 'down' : 'up'
    },
    {
      icon: CheckCircle2,
      label: t('dashboard.customerSatisfaction'),
      value: `${stats.customerSatisfaction}%`,
      color: 'bg-blue-600',
      change: `+20%`,
      trend: 'up'
    }
  ];
  const secondaryStats = [
    {
      icon: UserCheck,
      label: t('dashboard.activeAgents'),
      value: `${stats.activeAgents} / ${stats.totalAgents}`,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50 dark:bg-indigo-900/20'
    },
    {
      icon: Clock,
      label: t('dashboard.avgFirstResponse'),
      value: formatMinutes(stats.avgFirstResponseTime),
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20'
    },
    {
      icon: Activity,
      label: t('dashboard.avgResolutionTime'),
      value: formatMinutes(stats.avgResolutionTime),
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20'
    },
    {
      icon: CheckCircle2,
      label: t('dashboard.resolvedToday'),
      value: stats.resolvedToday,
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-900/20'
    }
  ];
  return (
    <>
      <Helmet>
        <title>{t('dashboard.welcomeTitle', 'Hoş geldiniz - Support.io Admin')}</title>
        <meta
          name="description"
          content={t('dashboard.ticketsDesc', 'Destek Talebi Yönetim Sistemi')}
        />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {t('dashboard.welcome')}, {user?.name || ''}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              {formatDate(new Date())} - {t('dashboard.last7Days')}
            </p>
          </div>
          <button
            onClick={() => fetchDashboardData()}
            disabled={loading || refreshing}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? t('dashboard.refreshing') : t('dashboard.refresh')}</span>
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {mainStats.map((stat, index) => (
            <div
              key={index}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 transition-colors duration-200"
            >
              <div className="flex items-center justify-between mb-4">
                <div
                  className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center`}
                >
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
                {stat.trend === 'up' && (
                  <span className="text-sm font-medium text-green-600 dark:text-green-400 flex items-center">
                    <TrendingUp className="w-4 h-4 mr-1" />
                    {stat.change}
                  </span>
                )}
                {stat.trend === 'down' && (
                  <span className="text-sm font-medium text-red-600 dark:text-red-400 flex items-center">
                    <TrendingDown className="w-4 h-4 mr-1" />
                  </span>
                )}
              </div>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                {stat.value}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</p>
            </div>
          ))}
        </div>
        {plan === 'FREE' && (
          <div className="bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800 rounded-xl p-6 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center shrink-0">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {t('dashboard.advancedReportsLocked', 'Gelişmiş Raporlar Kilitli')}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {t(
                    'dashboard.advancedReportsDesc',
                    'Puanlama, ortalama yanıt süreleri ve ziyaretçi trafiğini görebilmek için organizasyonunuzu yükseltin.'
                  )}
                </p>
              </div>
            </div>
            <button className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm whitespace-nowrap shrink-0">
              {t('dashboard.upgradeNow', 'Şimdi Yükselt')}
            </button>
          </div>
        )}
        <div
          className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 relative ${plan === 'FREE' ? 'group' : ''}`}
        >
          {plan === 'FREE' && (
            <div className="absolute inset-0 z-10 bg-white/50 dark:bg-gray-900/50 backdrop-blur-[2px] rounded-xl cursor-not-allowed"></div>
          )}
          {secondaryStats.map((stat, index) => (
            <div
              key={index}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex items-center space-x-4"
            >
              <div
                className={`w-10 h-10 ${stat.bgColor} rounded-lg flex items-center justify-center`}
              >
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {t('dashboard.recentTickets')}
            </h2>
            <button
              onClick={() => navigate(routes.conversations)}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium flex items-center"
            >
              {t('dashboard.viewAll')} →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {t('dashboard.ticket')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {t('dashboard.priority')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {t('dashboard.status')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {t('dashboard.time')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {recentTickets.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-8 text-center text-gray-500 dark:text-gray-400"
                    >
                      {t('dashboard.noTickets')}
                    </td>
                  </tr>
                ) : (
                  recentTickets.map((ticket) => (
                    <tr
                      key={ticket._id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition"
                      onClick={() => {
                        navigate(routes.conversations);
                        try {
                          window.dispatchEvent(
                            new CustomEvent('navigate:open-conversation', {
                              detail: {
                                conversationId: ticket._id,
                                siteId: ticket.siteId || ticket.site?._id
                              }
                            })
                          );
                        } catch (error) {
                          // Reported rather than discarded: a silent failure here leaves the
                          // page showing stale data with nothing to say why.
                          console.error('[dashboard] request failed', error);
                        }
                      }}
                    >
                      <td className="px-6 py-4 max-w-[150px] sm:max-w-xs xl:max-w-md">
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="flex-shrink-0 w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                              {(ticket.visitorName || 'V').charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {ticket.ticketId || `#${ticket.ticketNumber}`}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {ticket.visitorName || t('dashboard.visitor')}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 inline-flex text-xs font-semibold rounded-full ${getPriorityBadge(ticket.priority)}`}
                        >
                          {ticket.priority === 'urgent'
                            ? t('dashboard.urgent')
                            : ticket.priority === 'high'
                              ? t('dashboard.high')
                              : ticket.priority === 'normal'
                                ? t('dashboard.medium')
                                : t('dashboard.low')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 inline-flex text-xs font-semibold rounded-full ${getStatusBadge(ticket.status)}`}
                        >
                          {ticket.status === 'open'
                            ? t('dashboard.open')
                            : ticket.status === 'assigned'
                              ? t('dashboard.assigned')
                              : ticket.status === 'pending'
                                ? t('dashboard.pending')
                                : ticket.status === 'resolved'
                                  ? t('dashboard.resolved')
                                  : t('dashboard.closed')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {formatTime(ticket.createdAt)} →
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            {t('dashboard.quickActions')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => navigate(routes.conversations)}
              className="p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition text-left"
            >
              <MessageSquare className="w-8 h-8 text-indigo-600 dark:text-indigo-400 mb-2" />
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {t('dashboard.tickets')}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {t('dashboard.ticketsDesc')}
              </p>
            </button>
            <button
              onClick={() => navigate(routes.team)}
              className="p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition text-left"
            >
              <Users className="w-8 h-8 text-indigo-600 dark:text-indigo-400 mb-2" />
              <h3 className="font-semibold text-gray-900 dark:text-white">{t('dashboard.team')}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {t('dashboard.teamDesc')}
              </p>
            </button>
            <button
              onClick={() => navigate(routes.sites)}
              className="p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition text-left"
            >
              <Globe className="w-8 h-8 text-indigo-600 dark:text-indigo-400 mb-2" />
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {t('dashboard.sites')}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {t('dashboard.sitesDesc')}
              </p>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
export default Dashboard;
