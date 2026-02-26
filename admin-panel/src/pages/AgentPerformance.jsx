import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
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

const AgentPerformance = () => {
    const { t } = useTranslation();
    const { language } = useLanguage();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('7d');
    const [stats, setStats] = useState({
        totalResolved: 0,
        avgResponseTime: 0,
        csatScore: 0,
        slaCompliance: 0,
        activeChats: 0
    });

    const [dailyActivity, setDailyActivity] = useState([]);
    const [responseTrend, setResponseTrend] = useState([]);

    useEffect(() => {
        fetchPerformanceData();
    }, [timeRange]);

    const fetchPerformanceData = async () => {
        try {
            setLoading(true);
            setTimeout(() => {
                setStats({
                    totalResolved: Math.floor(Math.random() * 200) + 50,
                    avgResponseTime: (Math.random() * 5 + 1).toFixed(1),
                    csatScore: (Math.random() * 1 + 4).toFixed(1),
                    slaCompliance: Math.floor(Math.random() * 10 + 90),
                    activeChats: Math.floor(Math.random() * 5)
                });

                const days = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
                const activityData = days.map(day => ({
                    name: day,
                    resolved: Math.floor(Math.random() * 30 + 5),
                    assigned: Math.floor(Math.random() * 40 + 10)
                }));
                setDailyActivity(activityData);

                const trendData = days.map(day => ({
                    name: day,
                    time: (Math.random() * 8 + 2).toFixed(1)
                }));
                setResponseTrend(trendData);

                setLoading(false);
            }, 800);

        } catch (error) {
            console.error('Error fetching performance data:', error);
            setLoading(false);
        }
    };

    const StatCard = ({ title, value, subValue, icon: Icon, color, trend }) => (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 transition-all hover:shadow-md">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{title}</p>
                    <div className="flex items-baseline space-x-2">
                        <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{value}</h3>
                        {subValue && <span className="text-sm text-gray-500 dark:text-gray-400">{subValue}</span>}
                    </div>
                    {trend && (
                        <div className={`flex items-center mt-2 text-sm ${trend > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {trend > 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingUp className="w-4 h-4 mr-1 rotate-180" />}
                            <span>{Math.abs(trend)}% vs last period</span>
                        </div>
                    )}
                </div>
                <div className={`p-3 rounded-lg bg-${color}-50 dark:bg-${color}-900/40 border border-${color}-100 dark:border-${color}-900/60`}>
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
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('sidebar.myPerformance')}</h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Kendi destek metriklerinizi ve başarı oranlarınızı inceleyin.</p>
                    </div>
                    <div className="flex items-center space-x-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1 shadow-sm">
                        {['24h', '7d', '30d'].map((range) => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${timeRange === range
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
                ) : (
                    <div className="space-y-6 animate-fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <StatCard title="Çözülen Talepler" value={stats.totalResolved} icon={CheckCircle2} color="green" trend={12} />
                            <StatCard title="SLA Uyumluluğu" value={`${stats.slaCompliance}%`} icon={Award} color="indigo" trend={2} />
                            <StatCard title="Ort. Yanıt Süresi" value={stats.avgResponseTime} subValue="dk" icon={Zap} color="purple" trend={-15} />
                            <StatCard title="Müşteri Memnuniyeti (CSAT)" value={stats.csatScore} subValue="/ 5.0" icon={MessageSquare} color="yellow" />
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 transition-all hover:shadow-md">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Günlük Aktivite</h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Son {timeRange} içerisindeki atanan ve çözülen talep dengeniz</p>
                                    </div>
                                    <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                        <Calendar className="w-5 h-5 text-gray-400" />
                                    </div>
                                </div>
                                <div className="h-72">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={dailyActivity} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" className="dark:stroke-gray-700/50" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#1F2937', color: '#fff', border: 'none', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                                itemStyle={{ color: '#E5E7EB' }} cursor={{ fill: 'rgba(107, 114, 128, 0.05)' }}
                                            />
                                            <Bar dataKey="assigned" name="Atanan" fill="#818CF8" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                            <Bar dataKey="resolved" name="Çözülen" fill="#34D399" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 transition-all hover:shadow-md">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Yanıt Süresi Trendi (Dk)</h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Zaman içindeki geri dönüş performansınız</p>
                                    </div>
                                    <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                        <Clock className="w-5 h-5 text-gray-400" />
                                    </div>
                                </div>
                                <div className="h-72">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={responseTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" className="dark:stroke-gray-700/50" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#1F2937', color: '#fff', border: 'none', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                                itemStyle={{ color: '#E5E7EB' }}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="time"
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
