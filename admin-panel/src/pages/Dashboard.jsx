import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import { MessageSquare, Globe, Users, TrendingUp, RefreshCw } from 'lucide-react';
import { sitesAPI, conversationsAPI, faqsAPI, clearCache } from '../services/api';
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
    faqs: `${langPrefix}/dashboard/faqs`
  };
  const [stats, setStats] = useState({
    totalConversations: 0,
    activeSites: 0,
    totalVisitors: 0,
    responseRate: 0,
    totalFaqs: 0
  });
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    fetchDashboardData();
    
    // Socket.io bağlantısını kur
    const newSocket = io('http://localhost:5000/admin', {
      transports: ['websocket', 'polling']
    });
    
    newSocket.on('connect', () => {
      console.log('✅ Dashboard socket connected!');
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Dashboard socket disconnected');
    });

    // İstatistik güncellemelerini dinle
    newSocket.on('stats-update', (data) => {
      console.log('📊 Stats update received:', data);
      // İstatistikleri yeniden yükle
      fetchDashboardData(true);
    });

    setSocket(newSocket);
    
    // Her 30 saniyede bir otomatik güncelle
    const interval = setInterval(() => {
      fetchDashboardData(true);
    }, 30000);
    
    // Sayfa görünür hale geldiğinde güncelle
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchDashboardData(true);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
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
      
      // Cache'i temizle
      clearCache();
      
      // Sites verilerini çek
      const sitesResponse = await sitesAPI.getAll();
      const sites = sitesResponse.data.sites || [];
      const activeSites = sites.filter(site => site.isActive).length;
      
      // Her site için conversations ve FAQs çek
      let totalConversations = 0;
      let totalFaqs = 0;
      
      for (const site of sites) {
        try {
          const conversationsResponse = await conversationsAPI.getAll(site._id);
          totalConversations += conversationsResponse.data.conversations?.length || 0;
        } catch (error) {
          // Site conversation fetch failed
        }
        
        try {
          const faqsResponse = await faqsAPI.getAll(site._id);
          totalFaqs += faqsResponse.data.faqs?.length || 0;
        } catch (error) {
          // Site FAQ fetch failed
        }
      }
      
      setStats({
        totalConversations,
        activeSites: sites.length,
        totalVisitors: totalConversations, // Şimdilik conversations sayısı
        responseRate: totalConversations > 0 ? 100 : 0,
        totalFaqs
      });
      
    } catch (error) {
      console.error('Dashboard verisi yüklenemedi:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const statsData = [
    {
      label: t('dashboard.totalConversations'),
      value: loading ? '...' : stats.totalConversations.toString(),
      icon: MessageSquare,
      color: 'bg-blue-500',
      change: '+0%'
    },
    {
      label: t('dashboard.activeSites'),
      value: loading ? '...' : stats.activeSites.toString(),
      icon: Globe,
      color: 'bg-green-500',
      change: '+0%'
    },
    {
      label: t('dashboard.totalFaqs'),
      value: loading ? '...' : stats.totalFaqs.toString(),
      icon: Users,
      color: 'bg-purple-500',
      change: '+0%'
    },
    {
      label: t('dashboard.responseRate'),
      value: loading ? '...' : `${stats.responseRate}%`,
      icon: TrendingUp,
      color: 'bg-orange-500',
      change: '+0%'
    }
  ];

  return (
    <>
      <Helmet>
        <title>{t('dashboard.title')} - Support.io Admin</title>
        <meta name="description" content={t('dashboard.subtitle')} />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('dashboard.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">{t('dashboard.subtitle')}</p>
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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statsData.map((stat, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 transition-colors duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-green-600 dark:text-green-400">{stat.change}</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{stat.value}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8 transition-colors duration-200">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{t('dashboard.quickActions')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button 
            onClick={() => navigate(routes.sites)}
            className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition text-left"
          >
            <Globe className="w-8 h-8 text-indigo-600 dark:text-indigo-400 mb-2" />
            <h3 className="font-semibold text-gray-900 dark:text-white">{t('dashboard.newSite')}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('dashboard.newSiteDescription')}</p>
          </button>
          <button 
            onClick={() => navigate(routes.conversations)}
            className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition text-left"
          >
            <MessageSquare className="w-8 h-8 text-indigo-600 dark:text-indigo-400 mb-2" />
            <h3 className="font-semibold text-gray-900 dark:text-white">{t('dashboard.viewConversations')}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('dashboard.viewConversationsDescription')}</p>
          </button>
          <button 
            onClick={() => navigate(routes.faqs)}
            className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition text-left"
          >
            <TrendingUp className="w-8 h-8 text-indigo-600 dark:text-indigo-400 mb-2" />
            <h3 className="font-semibold text-gray-900 dark:text-white">{t('dashboard.createFaq')}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('dashboard.createFaqDescription')}</p>
          </button>
        </div>
      </div>

      {/* Getting Started */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 dark:from-indigo-600 dark:to-purple-700 rounded-xl shadow-sm p-8 text-white transition-colors duration-200">
        <h2 className="text-2xl font-bold mb-4">🚀 {t('dashboard.gettingStarted')}</h2>
        <div className="space-y-3">
          <button
            onClick={() => navigate(routes.sites)}
            className="w-full flex items-start space-x-3 p-3 rounded-lg hover:bg-white hover:bg-opacity-10 transition text-left"
          >
            <div className="w-6 h-6 bg-white bg-opacity-20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-sm font-bold">1</span>
            </div>
            <div>
              <h3 className="font-semibold">{t('dashboard.step1')}</h3>
              <p className="text-indigo-100 dark:text-indigo-200 text-sm">{t('dashboard.step1Description')}</p>
            </div>
          </button>
          <div className="flex items-start space-x-3 p-3">
            <div className="w-6 h-6 bg-white bg-opacity-20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-sm font-bold">2</span>
            </div>
            <div>
              <h3 className="font-semibold">{t('dashboard.step2')}</h3>
              <p className="text-indigo-100 dark:text-indigo-200 text-sm">{t('dashboard.step2Description')}</p>
            </div>
          </div>
          <button
            onClick={() => navigate(routes.conversations)}
            className="w-full flex items-start space-x-3 p-3 rounded-lg hover:bg-white hover:bg-opacity-10 transition text-left"
          >
            <div className="w-6 h-6 bg-white bg-opacity-20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-sm font-bold">3</span>
            </div>
            <div>
              <h3 className="font-semibold">{t('dashboard.step3')}</h3>
              <p className="text-indigo-100 dark:text-indigo-200 text-sm">{t('dashboard.step3Description')}</p>
            </div>
          </button>
        </div>
      </div>
      </div>
    </>
  );
};

export default Dashboard;
