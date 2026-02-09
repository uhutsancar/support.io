import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Globe, Users, TrendingUp } from 'lucide-react';
import { sitesAPI, conversationsAPI, faqsAPI } from '../services/api';

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalConversations: 0,
    activeSites: 0,
    totalVisitors: 0,
    responseRate: 0,
    totalFaqs: 0
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
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
    }
  };

  const statsData = [
    {
      label: 'Toplam Konuşma',
      value: loading ? '...' : stats.totalConversations.toString(),
      icon: MessageSquare,
      color: 'bg-blue-500',
      change: '+0%'
    },
    {
      label: 'Aktif Siteler',
      value: loading ? '...' : stats.activeSites.toString(),
      icon: Globe,
      color: 'bg-green-500',
      change: '+0%'
    },
    {
      label: 'Toplam SSS',
      value: loading ? '...' : stats.totalFaqs.toString(),
      icon: Users,
      color: 'bg-purple-500',
      change: '+0%'
    },
    {
      label: 'Yanıt Oranı',
      value: loading ? '...' : `${stats.responseRate}%`,
      icon: TrendingUp,
      color: 'bg-orange-500',
      change: '+0%'
    }
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Gösterge Paneli</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">DestekChat yönetim panelinize hoş geldiniz</p>
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
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Hızlı İşlemler</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button 
            onClick={() => navigate('/dashboard/sites')}
            className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition text-left"
          >
            <Globe className="w-8 h-8 text-indigo-600 dark:text-indigo-400 mb-2" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Yeni Site Ekle</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Yeni bir web sitesine sohbet widget'i ekleyin</p>
          </button>
          <button 
            onClick={() => navigate('/dashboard/conversations')}
            className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition text-left"
          >
            <MessageSquare className="w-8 h-8 text-indigo-600 dark:text-indigo-400 mb-2" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Konuşmaları Görüntüle</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Müşterilerinizle sohbet edin</p>
          </button>
          <button 
            onClick={() => navigate('/dashboard/faqs')}
            className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition text-left"
          >
            <TrendingUp className="w-8 h-8 text-indigo-600 dark:text-indigo-400 mb-2" />
            <h3 className="font-semibold text-gray-900 dark:text-white">SSS Oluştur</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Otomatik yanıtlar ekleyin</p>
          </button>
        </div>
      </div>

      {/* Getting Started */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 dark:from-indigo-600 dark:to-purple-700 rounded-xl shadow-sm p-8 text-white transition-colors duration-200">
        <h2 className="text-2xl font-bold mb-4">🚀 Başlangıç</h2>
        <div className="space-y-3">
          <button
            onClick={() => navigate('/dashboard/sites')}
            className="w-full flex items-start space-x-3 p-3 rounded-lg hover:bg-white hover:bg-opacity-10 transition text-left"
          >
            <div className="w-6 h-6 bg-white bg-opacity-20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-sm font-bold">1</span>
            </div>
            <div>
              <h3 className="font-semibold">İlk web sitenizi ekleyin</h3>
              <p className="text-indigo-100 dark:text-indigo-200 text-sm">Siteler bölümüne giderek web sitenizi ekleyin ve benzersiz bir site anahtarı alın</p>
            </div>
          </button>
          <div className="flex items-start space-x-3 p-3">
            <div className="w-6 h-6 bg-white bg-opacity-20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-sm font-bold">2</span>
            </div>
            <div>
              <h3 className="font-semibold">Widget'i yükleyin</h3>
              <p className="text-indigo-100 dark:text-indigo-200 text-sm">Widget kodunu kopyalayıp web sitenizin HTML koduna yapıştırın</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/dashboard/conversations')}
            className="w-full flex items-start space-x-3 p-3 rounded-lg hover:bg-white hover:bg-opacity-10 transition text-left"
          >
            <div className="w-6 h-6 bg-white bg-opacity-20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-sm font-bold">3</span>
            </div>
            <div>
              <h3 className="font-semibold">Sohbet etmeye başlayın!</h3>
              <p className="text-indigo-100 dark:text-indigo-200 text-sm">Müşterileriniz artık sohbet widget'ı üzerinden size ulaşabilir</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
