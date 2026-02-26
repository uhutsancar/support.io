import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { sitesAPI, visitorsAPI } from '../services/api';
import { io } from 'socket.io-client';
import { Users, Clock, Globe, Laptop, Smartphone, Monitor } from 'lucide-react';
import toast from 'react-hot-toast';
const Visitors = () => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [sites, setSites] = useState([]);
    const [activeSite, setActiveSite] = useState(null);
    const [visitors, setVisitors] = useState([]);
    const [loading, setLoading] = useState(true);
    const startTimes = React.useRef(new Map());
    const [, setTick] = useState(0);
    useEffect(() => {
        fetchSites();
    }, []);
    useEffect(() => {
        if (activeSite) {
            loadVisitors();
            setupSocket();
        }
    }, [activeSite]);
    useEffect(() => {
        const timer = setInterval(() => {
            setTick(t => t + 1);
        }, 1000);
        return () => clearInterval(timer);
    }, []);
    const fetchSites = async () => {
        try {
            const response = await sitesAPI.getAll();
            const siteData = response.data.sites || [];
            setSites(siteData);
            if (siteData.length > 0) {
                setActiveSite(siteData[0]._id);
            } else {
                setLoading(false);
            }
        } catch (error) {
            toast.error(t('visitors.fetchError', 'Siteler yüklenirken hata oluştu'));
            setLoading(false);
        }
    };
    const loadVisitors = async () => {
        try {
            setLoading(true);
            const response = await visitorsAPI.getAll(activeSite, true);
            const activeVisitors = response.data || [];
            activeVisitors.forEach(v => {
                if (!startTimes.current.has(v.visitorId)) {
                    startTimes.current.set(v.visitorId, new Date(v.lastActiveAt).getTime());
                }
            });
            setVisitors(activeVisitors);
        } catch (error) {
        } finally {
            setLoading(false);
        }
    };
    const setupSocket = () => {
        const token = localStorage.getItem('token');
        const socket = io(`${import.meta.env.VITE_API_URL}/admin`, {
            auth: { token },
            transports: ['websocket', 'polling']
        });
        socket.emit('join-site', { siteId: activeSite, userId: user._id });
        socket.on('visitor-updated', (doc) => {
            setVisitors(prev => {
                const index = prev.findIndex(v => v.visitorId === doc.visitorId);
                if (doc.isActive && (!startTimes.current.has(doc.visitorId) || index === -1)) {
                    startTimes.current.set(doc.visitorId, new Date().getTime());
                } else if (!doc.isActive) {
                    startTimes.current.delete(doc.visitorId);
                }
                let nextState = [...prev];
                if (index > -1) {
                    if (!doc.isActive) {
                        nextState.splice(index, 1);
                    } else {
                        nextState[index] = doc;
                    }
                } else if (doc.isActive) {
                    nextState.unshift(doc);
                }
                return nextState;
            });
        });
        return () => socket.disconnect();
    };
    const formatDuration = (visitorId) => {
        const start = startTimes.current.get(visitorId);
        if (!start) return '00:00';
        const diffInSeconds = Math.floor((Date.now() - start) / 1000);
        const m = Math.floor((diffInSeconds % 3600) / 60).toString().padStart(2, '0');
        const s = (diffInSeconds % 60).toString().padStart(2, '0');
        const h = Math.floor(diffInSeconds / 3600);
        return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
    };
    const getDeviceIcon = (os, browser) => {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(os || browser || '');
        if (isMobile) return <Smartphone className="w-4 h-4 text-gray-400" />;
        return <Monitor className="w-4 h-4 text-gray-400" />;
    };
    const getFormattedName = (visitorId) => {
        return visitorId ? visitorId.substring(0, 8).toUpperCase() : t('visitors.unknown', 'BİLİNMEYEN');
    };
    return (
        <>
            <Helmet>
                <title>{t('sidebar.visitors', 'Ziyaretçiler')} - Support.io</title>
            </Helmet>
            <div className="max-w-7xl mx-auto flex flex-col h-full bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 min-h-[calc(100vh-8rem)]">
                { }
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-100 dark:bg-indigo-900/40 p-2 rounded-lg text-indigo-600 dark:text-indigo-400">
                            <Users className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                                {t('sidebar.visitors', 'Ziyaretçiler')}
                            </h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {t('visitors.subtitle', 'Sitenizdeki aktif ziyaretçileri anlık görüntüleyin.')}
                            </p>
                        </div>
                    </div>
                    <div className="w-full sm:w-auto">
                        <select
                            value={activeSite || ''}
                            onChange={(e) => setActiveSite(e.target.value)}
                            className="w-full sm:w-48 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 dark:bg-gray-800 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-indigo-500 dark:focus:border-indigo-500"
                        >
                            {sites.map(site => (
                                <option key={site._id} value={site._id}>{site.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
                { }
                <div className="flex-1 overflow-x-auto relative">
                    {loading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-gray-900/50 z-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : visitors.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-fade-in my-10">
                            <div className="mb-6 relative">
                                <div className="w-48 h-48 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto overflow-hidden shadow-inner">
                                    <Users className="w-20 h-20 text-gray-300 dark:text-gray-600" />
                                    { }
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full border-4 border-indigo-50 dark:border-indigo-900/10 rounded-full animate-ping opacity-20"></div>
                                </div>
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                                {t('visitors.emptyTitle', 'Henüz aktif ziyaretçi yok')}
                            </h3>
                            <p className="text-gray-500 dark:text-gray-400 max-w-md">
                                {t('visitors.emptyDesc', 'Bu kısımda sitenizde bulunan ziyaretçileri göstereceğiz. Pencereyi açık bırakarak anlık trafiği test edebilirsiniz.')}
                            </p>
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-800 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                                <tr>
                                    <th scope="col" className="px-6 py-4">{t('visitors.timeOnSite', 'Sitede Geçen Süre')}</th>
                                    <th scope="col" className="px-6 py-4">{t('visitors.visitorColumn', 'Ziyaretçi')}</th>
                                    <th scope="col" className="px-6 py-4 hidden md:table-cell">{t('visitors.currentPage', 'Geçerli Sayfa')}</th>
                                    <th scope="col" className="px-6 py-4 hidden sm:table-cell">{t('visitors.locationIp', 'Konum / IP')}</th>
                                    <th scope="col" className="px-6 py-4 hidden lg:table-cell">{t('visitors.system', 'Sistem')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visitors.map((visitor) => (
                                    <tr key={visitor._id} className="bg-white dark:bg-gray-900 border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors animate-fade-in">
                                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                                <span className="font-mono text-indigo-600 dark:text-indigo-400">{formatDuration(visitor.visitorId)}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                                                    <span className="text-indigo-600 dark:text-indigo-400 font-bold text-xs">{getFormattedName(visitor.visitorId).charAt(0)}</span>
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-gray-900 dark:text-white">{t('visitors.idPrefix', 'Kimlik:')} {getFormattedName(visitor.visitorId)}</div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">{visitor.ip || t('visitors.unknown', 'Bilinmiyor')}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 hidden md:table-cell">
                                            <div className="flex items-center gap-2 max-w-[200px]">
                                                <Globe className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                                <span className="truncate" title={visitor.currentPage}>{visitor.currentPage}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 hidden sm:table-cell">
                                            <div className="flex flex-col">
                                                <span className="text-gray-900 dark:text-gray-300">{visitor.country || t('visitors.unknown', 'Bilinmiyor')}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 hidden lg:table-cell">
                                            <div className="flex items-center gap-2">
                                                {getDeviceIcon(visitor.os, visitor.browser)}
                                                <span className="capitalize">{visitor.os || visitor.browser || t('visitors.unknown', 'Bilinmiyor')}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </>
    );
};
export default Visitors;
