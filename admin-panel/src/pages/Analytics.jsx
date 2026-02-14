import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  Users,
  AlertCircle,
  CheckCircle2,
  BarChart3,
  PieChart as PieChartIcon,
  Calendar,
  Filter
} from 'lucide-react';
import { sitesAPI, conversationsAPI, clearCache } from '../services/api';

const Analytics = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7days'); // 7days, 30days, 90days
  const [selectedMetric, setSelectedMetric] = useState('all');

  const [stats, setStats] = useState({
    openTickets: 0,
    slaBreaches: 0,
    unassigned: 0,
    satisfaction: 0,
    activeAgents: 0,
    totalAgents: 0
  });

  const [dailyTickets, setDailyTickets] = useState([]);
  const [responseTimeData, setResponseTimeData] = useState([]);
  const [departmentStats, setDepartmentStats] = useState([]);
  const [agentPerformance, setAgentPerformance] = useState([]);
  const [channelDistribution, setChannelDistribution] = useState([]);
  const [slaCompliance, setSlaCompliance] = useState([]);

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      clearCache();

      // Sites verilerini çek
      const sitesResponse = await sitesAPI.getAll();
      const sites = sitesResponse.data.sites || [];

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

      console.log('Total conversations:', allConversations.length);

      // İstatistikleri hesapla
      const openTickets = allConversations.filter(c =>
        c.status === 'open' || c.status === 'assigned' || c.status === 'pending'
      ).length;

      const unassigned = allConversations.filter(c =>
        c.status === 'open' && !c.assignedAgent
      ).length;

      const slaBreaches = allConversations.filter(c =>
        c.sla?.firstResponseStatus === 'breached' || c.sla?.resolutionStatus === 'breached'
      ).length;

      // Memnuniyet oranı
      const ratedConversations = allConversations.filter(c => c.rating?.score);
      const avgSatisfaction = ratedConversations.length > 0
        ? Math.round((ratedConversations.reduce((sum, c) => sum + c.rating.score, 0) / ratedConversations.length) * 20)
        : 0;

      setStats({
        openTickets,
        slaBreaches,
        unassigned,
        satisfaction: avgSatisfaction,
        activeAgents: 4,
        totalAgents: 5
      });

      // 1. Günlük trend hesapla (son 7 gün)
      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);

        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const dayTickets = allConversations.filter(c => {
          const createdAt = new Date(c.createdAt);
          return createdAt >= date && createdAt < nextDate;
        });

        const resolved = dayTickets.filter(c => c.status === 'resolved' || c.status === 'closed').length;
        const slaMet = dayTickets.filter(c =>
          c.sla?.firstResponseStatus === 'met' || c.sla?.resolutionStatus === 'met'
        ).length;

        last7Days.push({
          date: date.toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', { day: '2-digit', month: 'short' }),
          tickets: dayTickets.length,
          resolved,
          sla: slaMet
        });
      }
      setDailyTickets(last7Days);

      // 2. Saatlik yanıt süresi analizi
      const hourly = {};
      allConversations.forEach(c => {
        if (c.firstResponseAt && c.createdAt) {
          const hour = new Date(c.createdAt).getHours();
          const responseTime = Math.floor((new Date(c.firstResponseAt) - new Date(c.createdAt)) / 1000 / 60);
          
          if (!hourly[hour]) {
            hourly[hour] = { times: [], count: 0 };
          }
          hourly[hour].times.push(responseTime);
          hourly[hour].count++;
        }
      });

      const hourlyData = [];
      for (let h = 0; h < 24; h += 4) {
        const avg = hourly[h] 
          ? Math.round(hourly[h].times.reduce((a, b) => a + b, 0) / hourly[h].times.length)
          : 0;
        hourlyData.push({
          hour: `${h.toString().padStart(2, '0')}:00`,
          avgTime: avg,
          target: 15
        });
      }
      setResponseTimeData(hourlyData);

      // 3. Kanal dağılımı
      const channels = {
        'web-chat': { name: 'Web Chat', value: 0, color: '#8B5CF6' },
        'email': { name: 'Email', value: 0, color: '#3B82F6' },
        'whatsapp': { name: 'WhatsApp', value: 0, color: '#10B981' },
        'phone': { name: 'Telefon', value: 0, color: '#F59E0B' }
      };
      
      allConversations.forEach(c => {
        const channel = c.channel || 'web-chat';
        if (channels[channel]) {
          channels[channel].value++;
        }
      });

      setChannelDistribution(Object.values(channels).filter(c => c.value > 0));

      // 4. SLA Uyum Analizi
      const firstResponseMet = allConversations.filter(c => c.sla?.firstResponseStatus === 'met').length;
      const firstResponseBreached = allConversations.filter(c => c.sla?.firstResponseStatus === 'breached').length;
      const resolutionMet = allConversations.filter(c => c.sla?.resolutionStatus === 'met').length;
      const resolutionBreached = allConversations.filter(c => c.sla?.resolutionStatus === 'breached').length;

      setSlaCompliance([
        { 
          category: language === 'tr' ? 'İlk Yanıt' : 'First Response', 
          met: firstResponseMet, 
          breached: firstResponseBreached 
        },
        { 
          category: language === 'tr' ? 'Çözüm' : 'Resolution', 
          met: resolutionMet, 
          breached: resolutionBreached 
        }
      ]);

      // 5. Departman performansı (populate edilen departman bilgisiyle)
      const deptMap = {};
      allConversations.forEach(c => {
        if (c.department) {
          const deptName = c.department.name || 'Genel';
          if (!deptMap[deptName]) {
            deptMap[deptName] = {
              name: deptName,
              tickets: 0,
              resolved: 0,
              slaMet: 0,
              responseTimes: []
            };
          }
          deptMap[deptName].tickets++;
          if (c.status === 'resolved' || c.status === 'closed') {
            deptMap[deptName].resolved++;
          }
          if (c.sla?.firstResponseStatus === 'met') {
            deptMap[deptName].slaMet++;
          }
          if (c.firstResponseAt && c.createdAt) {
            const responseTime = Math.floor((new Date(c.firstResponseAt) - new Date(c.createdAt)) / 1000 / 60);
            deptMap[deptName].responseTimes.push(responseTime);
          }
        }
      });

      const deptStats = Object.values(deptMap).map(dept => ({
        name: dept.name,
        tickets: dept.tickets,
        resolved: dept.resolved,
        sla: dept.tickets > 0 ? ((dept.slaMet / dept.tickets) * 100).toFixed(1) : 0,
        avgTime: dept.responseTimes.length > 0 
          ? Math.round(dept.responseTimes.reduce((a, b) => a + b, 0) / dept.responseTimes.length)
          : 0
      })).sort((a, b) => b.tickets - a.tickets);

      setDepartmentStats(deptStats);

      // 6. Temsilci performansı (populate edilen agent bilgisiyle)
      const agentMap = {};
      allConversations.forEach(c => {
        if (c.assignedAgent) {
          const agentName = c.assignedAgent.name || 'Agent';
          if (!agentMap[agentName]) {
            agentMap[agentName] = {
              name: agentName,
              resolved: 0,
              responseTimes: [],
              ratings: []
            };
          }
          if (c.status === 'resolved' || c.status === 'closed') {
            agentMap[agentName].resolved++;
          }
          if (c.firstResponseAt && c.createdAt) {
            const responseTime = Math.floor((new Date(c.firstResponseAt) - new Date(c.createdAt)) / 1000 / 60);
            agentMap[agentName].responseTimes.push(responseTime);
          }
          if (c.rating?.score) {
            agentMap[agentName].ratings.push(c.rating.score);
          }
        }
      });

      const agentStats = Object.values(agentMap).map(agent => ({
        name: agent.name,
        resolved: agent.resolved,
        avgTime: agent.responseTimes.length > 0 
          ? Math.round(agent.responseTimes.reduce((a, b) => a + b, 0) / agent.responseTimes.length)
          : 0,
        satisfaction: agent.ratings.length > 0
          ? Math.round((agent.ratings.reduce((a, b) => a + b, 0) / agent.ratings.length) * 20)
          : 0
      })).sort((a, b) => b.resolved - a.resolved);

      setAgentPerformance(agentStats);

    } catch (error) {
      console.error('Analytics fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatMinutes = (minutes) => {
    if (!minutes) return '0dk';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}s ${mins}dk`;
    }
    return `${mins}dk`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-xs" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <Helmet>
        <title>{t('analytics.title')} - Support.io Admin</title>
        <meta name="description" content={t('analytics.subtitle')} />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {t('analytics.title')}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              {t('analytics.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white"
            >
              <option value="7days">{t('analytics.last7days')}</option>
              <option value="30days">{t('analytics.last30days')}</option>
              <option value="90days">{t('analytics.last90days')}</option>
            </select>
          </div>
        </div>

        {/* Metrik Kartları */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-green-600 dark:text-green-400 flex items-center">
                <TrendingUp className="w-4 h-4 mr-1" />
                +12%
              </span>
            </div>
            <h3 className="text-3xl font-bold text-gray-900 dark:text-white">{stats.openTickets}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('analytics.openTickets')}</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-white" />
              </div>
              {stats.slaBreaches > 0 && (
                <span className="text-sm font-medium text-red-600 dark:text-red-400">
                  {stats.slaBreaches}
                </span>
              )}
            </div>
            <h3 className="text-3xl font-bold text-gray-900 dark:text-white">{stats.slaBreaches}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('analytics.slaBreaches')}</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-orange-600 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-white" />
              </div>
            </div>
            <h3 className="text-3xl font-bold text-gray-900 dark:text-white">{stats.unassigned}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('analytics.unassignedTickets')}</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-green-600 dark:text-green-400 flex items-center">
                <TrendingUp className="w-4 h-4 mr-1" />
                +3%
              </span>
            </div>
            <h3 className="text-3xl font-bold text-gray-900 dark:text-white">{stats.satisfaction}%</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('analytics.satisfaction')}</p>
          </div>
        </div>

        {/* Grafikler - İlk Satır */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Günlük Talep Trendi */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              {t('analytics.dailyTrend')}
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dailyTickets}>
                <defs>
                  <linearGradient id="colorTickets" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                <XAxis
                  dataKey="date"
                  stroke="#9CA3AF"
                  style={{ fontSize: '12px' }}
                />
                <YAxis stroke="#9CA3AF" style={{ fontSize: '12px' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="tickets"
                  name={language === 'tr' ? 'Gelen Talepler' : 'Incoming Tickets'}
                  stroke="#8B5CF6"
                  fillOpacity={1}
                  fill="url(#colorTickets)"
                />
                <Area
                  type="monotone"
                  dataKey="resolved"
                  name={language === 'tr' ? 'Çözülen' : 'Resolved'}
                  stroke="#10B981"
                  fillOpacity={1}
                  fill="url(#colorResolved)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Yanıt Süresi Analizi */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              {t('analytics.responseTime')}
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={responseTimeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                <XAxis
                  dataKey="hour"
                  stroke="#9CA3AF"
                  style={{ fontSize: '12px' }}
                />
                <YAxis stroke="#9CA3AF" style={{ fontSize: '12px' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="avgTime"
                  name={language === 'tr' ? 'Ortalama Süre (dk)' : 'Average Time (min)'}
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ fill: '#3B82F6', r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="target"
                  name={language === 'tr' ? 'Hedef (dk)' : 'Target (min)'}
                  stroke="#EF4444"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Grafikler - İkinci Satır */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Kanal Dağılımı */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              {t('analytics.channelDistribution')}
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={channelDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {channelDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* SLA Uyum Oranları */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 lg:col-span-2">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              {t('analytics.slaCompliance')}
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={slaCompliance} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                <XAxis type="number" stroke="#9CA3AF" style={{ fontSize: '12px' }} />
                <YAxis type="category" dataKey="category" stroke="#9CA3AF" style={{ fontSize: '12px' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="met" name={language === 'tr' ? 'SLA Karşılandı' : 'SLA Met'} fill="#10B981" stackId="a" />
                <Bar dataKey="breached" name={language === 'tr' ? 'SLA İhlal Edildi' : 'SLA Breached'} fill="#EF4444" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Departman Performansı Tablosu */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 mb-6">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {t('analytics.departmentPerformance')}
            </h3>
          </div>
          <div className="overflow-x-auto">
            {departmentStats.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                {language === 'tr' ? 'Henüz veri yok' : 'No data yet'}
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      {language === 'tr' ? 'Departman' : 'Department'}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      {language === 'tr' ? 'Talepler' : 'Tickets'}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      {language === 'tr' ? 'Çözülen' : 'Resolved'}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      SLA %
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      {language === 'tr' ? 'Ort. Süre' : 'Avg. Time'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {departmentStats.map((dept, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4">
                        <span className="font-medium text-gray-900 dark:text-white">{dept.name}</span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{dept.tickets}</td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{dept.resolved}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          dept.sla >= 95 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                          dept.sla >= 90 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                          'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {dept.sla}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{formatMinutes(dept.avgTime)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Temsilci Performansı */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            {t('analytics.agentPerformance')}
          </h3>
          {agentPerformance.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-gray-500 dark:text-gray-400">
              {language === 'tr' ? 'Henüz veri yok' : 'No data yet'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={agentPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                <XAxis dataKey="name" stroke="#9CA3AF" style={{ fontSize: '12px' }} />
                <YAxis stroke="#9CA3AF" style={{ fontSize: '12px' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="resolved" name={language === 'tr' ? 'Çözülen Talepler' : 'Resolved Tickets'} fill="#8B5CF6" />
                <Line
                  type="monotone"
                  dataKey="satisfaction"
                  name={language === 'tr' ? 'Memnuniyet %' : 'Satisfaction %'}
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ fill: '#10B981', r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </>
  );
};

export default Analytics;
