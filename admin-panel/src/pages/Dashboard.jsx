import React, { useState, useEffect } from 'react';
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
  Activity
} from 'lucide-react';
import { sitesAPI, conversationsAPI, teamAPI, clearCache } from '../services/api';
import { io } from 'socket.io-client';

const Dashboard = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Dile göre URL prefix
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
    customerSatisfaction: 96,
    activeAgents: 4,
    totalAgents: 5,
    avgFirstResponseTime: 0,
    avgResolutionTime: 0,
    totalConversations: 0,
    activeSites: 0,
    resolvedToday: 0,
    slaComplianceRate: 0
  });
  
  const [recentTickets, setRecentTickets] = useState([]);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    fetchDashboardData();
    
    // Socket.io bağlantısını kur
    const token = localStorage.getItem('token');
    const newSocket = io('http://localhost:5000/admin', {
      auth: { token },
      transports: ['websocket', 'polling']
    });
    
    newSocket.on('connect', () => {
      console.log('✅ Dashboard socket connected!');
    });

    // Yeni ticket geldiğinde
    newSocket.on('new-conversation', (data) =>  {
      console.log('💬 New ticket received:', data);
      fetchDashboardData(true);
    });

    // SLA ihlali olduğunda
    newSocket.on('sla-breach', (data) => {
      console.log('🚨 SLA breach:', data);
      setStats(prev => ({
        ...prev,
        slaBreaches: prev.slaBreaches + 1
      }));
      
      // Bildirim göster
      if (Notification.permission === 'granted') {
        new Notification('SLA İhlali!', {
          body: `Talep #${data.ticketNumber} - ${data.type === 'first-response' ? 'İlk yanıt' : 'Çözüm'} süresi aşıldı`,
          icon: '/favicon.ico',
          tag: 'sla-breach'
        });
      }
    });

    // Ticket çözüldüğünde
    newSocket.on('conversation-resolved', () => {
      fetchDashboardData(true);
    });

    setSocket(newSocket);
    
    // Her 1 dakikada bir otomatik güncelle
    const interval = setInterval(() => {
      fetchDashboardData(true);
    }, 60000);
    
    // Sayfa görünür hale geldiğinde güncelle
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchDashboardData(true);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Bildirim izni iste
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      newSocket.close();
    };
  }, []);

  const fetchDashboardData = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      
      clearCache();
      
      // Sites verilerini çek
      const sitesResponse = await sitesAPI.getAll();
      const sites = sitesResponse.data.sites || [];
      const activeSites = sites.filter(site => site.isActive).length;
      
      // Tüm conversations'ları topla
      let allConversations = [];
      
      for (const site of sites) {
        try {
          const conversationsResponse = await conversationsAPI.getAll(site._id);
          const conversations = conversationsResponse.data.conversations || [];
          allConversations = [...allConversations, ...conversations];
        } catch (error) {
          console.error('Site conversations fetch failed:', error);
        }
      }
      
      // İstatistikleri hesapla
      const openTickets = allConversations.filter(c => 
        c.status === 'open' || c.status === 'assigned' || c.status === 'pending'
      ).length;
      
      const unassignedTickets = allConversations.filter(c => 
        c.status === 'open' && !c.assignedAgent
      ).length;
      
      const slaBreaches = allConversations.filter(c => 
        c.sla?.firstResponseStatus === 'breached' || c.sla?.resolutionStatus === 'breached'
      ).length;
      
      // Bugün çözülen ticketlar
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const resolvedToday = allConversations.filter(c => {
        if (c.resolvedAt) {
          const resolvedDate = new Date(c.resolvedAt);
          return resolvedDate >= today;
        }
        return false;
      }).length;
      
      // Ortalama yanıt süreleri (dakika)
      const conversationsWithResponse = allConversations.filter(c => c.responseTime);
      const avgFirstResponseTime = conversationsWithResponse.length > 0
        ? Math.round(conversationsWithResponse.reduce((sum, c) => sum + (c.responseTime || 0), 0) / conversationsWithResponse.length)
        : 0;
      
      const conversationsWithResolution = allConversations.filter(c => c.resolutionTime);
      const avgResolutionTime = conversationsWithResolution.length > 0
        ? Math.round(conversationsWithResolution.reduce((sum, c) => sum + (c.resolutionTime || 0), 0) / conversationsWithResolution.length)
        : 0;
      
      // SLA uyum oranı
      const conversationsWithSLA = allConversations.filter(c => c.sla);
      const slaMet = conversationsWithSLA.filter(c => 
        c.sla.firstResponseStatus === 'met' || c.sla.resolutionStatus === 'met'
      ).length;
      const slaComplianceRate = conversationsWithSLA.length > 0
        ? Math.round((slaMet / conversationsWithSLA.length) * 100)
        : 0;
      
      // Team verilerini çek (aktif agent sayısı için)
      let activeAgents = 0;
      let totalAgents = 0;
      try {
        for (const site of sites) {
          const teamResponse = await teamAPI.getAll(site._id);
          const teamMembers = teamResponse.data || [];
          totalAgents += teamMembers.length;
          activeAgents += teamMembers.filter(member => member.status === 'online' || member.status === 'available').length;
        }
      } catch (error) {
        console.error('Team data fetch failed:', error);
      }
      
      // Müşteri memnuniyeti hesapla
      const ratedConversations = allConversations.filter(c => c.rating?.score);
      const avgSatisfaction = ratedConversations.length > 0
        ? Math.round((ratedConversations.reduce((sum, c) => sum + c.rating.score, 0) / ratedConversations.length) * 20)
        : 0;
      
      // Son ticketlar (en yeni 5)
      const recent = allConversations
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);
      
      setStats({
        openTickets,
        slaBreaches,
        unassignedTickets,
        customerSatisfaction: avgSatisfaction,
        activeAgents,
        totalAgents,
        avgFirstResponseTime,
        avgResolutionTime,
        totalConversations: allConversations.length,
        activeSites,
        resolvedToday,
        slaComplianceRate
      });
      
      setRecentTickets(recent);
      
    } catch (error) {
      console.error('Dashboard data fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Zaman formatı - Türkiye 24 saat formatı  
  const formatTime = (date) => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleTimeString('tr-TR', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const formatDate = (date) => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Dakikayı saat ve dakika formatına çevir
  const formatMinutes = (minutes) => {
    if (!minutes || minutes === 0) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}s ${mins}dk`;
    }
    return `${mins}dk`;
  };

  const getPriorityBadge = (priority) => {
    const badges = {
      urgent: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      normal: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      low: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
    };
    return badges[priority] || badges.normal;
  };

  const getStatusBadge = (status) => {
    const badges = {
      open: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      assigned: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      pending: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      resolved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      closed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
    };
    return badges[status] || badges.open;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Ana metrik kartları
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

  // İkincil metrikler
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
        <title>Hoş geldiniz - Support.io Admin</title>
        <meta name="description" content="Destek Talebi Yönetim Sistemi" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {t('dashboard.welcome')}, Uhut
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

        {/* Ana Metrikler */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {mainStats.map((stat, index) => (
            <div 
              key={index} 
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 transition-colors duration-200"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center`}>
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

        {/* İkincil Metrikler */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {secondaryStats.map((stat, index) => (
            <div 
              key={index}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex items-center space-x-4"
            >
              <div className={`w-10 h-10 ${stat.bgColor} rounded-lg flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Son Talepler Tablosu */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('dashboard.recentTickets')}</h2>
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
                    <td colSpan="4" className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                      {t('dashboard.noTickets')}
                    </td>
                  </tr>
                ) : (
                  recentTickets.map((ticket) => (
                    <tr 
                      key={ticket._id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition"
                      onClick={() => navigate(`${routes.conversations}?id=${ticket._id}`)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0 w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                              {(ticket.visitorName || 'V').charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {ticket.ticketId || `#${ticket.ticketNumber}`}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {ticket.visitorName || t('dashboard.visitor')}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 inline-flex text-xs font-semibold rounded-full ${getPriorityBadge(ticket.priority)}`}>
                          {ticket.priority === 'urgent' ? t('dashboard.urgent') 
                            : ticket.priority === 'high' ? t('dashboard.high') 
                            : ticket.priority === 'normal' ? t('dashboard.medium') 
                            : t('dashboard.low')
                          }
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 inline-flex text-xs font-semibold rounded-full ${getStatusBadge(ticket.status)}`}>
                          {ticket.status === 'open' ? t('dashboard.open')
                            : ticket.status === 'assigned' ? t('dashboard.assigned')
                            : ticket.status === 'pending' ? t('dashboard.pending')
                            : ticket.status === 'resolved' ? t('dashboard.resolved')
                            : t('dashboard.closed')
                          }
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

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{t('dashboard.quickActions')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button 
              onClick={() => navigate(routes.conversations)}
              className="p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition text-left"
            >
              <MessageSquare className="w-8 h-8 text-indigo-600 dark:text-indigo-400 mb-2" />
              <h3 className="font-semibold text-gray-900 dark:text-white">{t('dashboard.tickets')}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('dashboard.ticketsDesc')}</p>
            </button>
            <button 
              onClick={() => navigate(routes.team)}
              className="p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition text-left"
            >
              <Users className="w-8 h-8 text-indigo-600 dark:text-indigo-400 mb-2" />
              <h3 className="font-semibold text-gray-900 dark:text-white">{t('dashboard.team')}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('dashboard.teamDesc')}</p>
            </button>
            <button 
              onClick={() => navigate(routes.sites)}
              className="p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition text-left"
            >
              <Globe className="w-8 h-8 text-indigo-600 dark:text-indigo-400 mb-2" />
              <h3 className="font-semibold text-gray-900 dark:text-white">{t('dashboard.sites')}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('dashboard.sitesDesc')}</p>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
