import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, NavLink, useNavigate, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import {
  LayoutDashboard, Globe, MessageCircle, Settings, LogOut, Menu, X, Bell,
  Users, Folder, BarChart3, MessagesSquare, UserX, Eye, Briefcase, Shield,
  Zap, Send, HelpCircle, Sun, Moon, Languages, Check, ChevronDown, WifiOff,
  Loader2
} from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { conversationsAPI, authAPI } from '../services/api';
import ConfirmDialog from '../components/ConfirmDialog';
import Logo, { LogoMark } from '../components/Logo';

/**
 * Panel kabuğu.
 *
 * Düzeltilen davranışlar:
 *
 *  - Tema ve dil anahtarları YALNIZCA pazarlama sayfalarının header'ındaydı.
 *    Panele giren biri koyu temaya geçmek için çıkıp ana sayfaya dönmek
 *    zorundaydı. İkisi de artık üst çubukta.
 *
 *  - Durum değiştirme `window.location.reload()` yapıyordu: tüm uygulama
 *    yeniden yükleniyor, açık konuşma ve soket bağlantısı kopuyordu. Artık
 *    iyimser güncelleme + hata durumunda geri alma.
 *
 *  - Durum yalnızca online/offline sunuyordu; oysa hem veritabanı hem Ekip
 *    ekranı dört durum tanıyor (online, away, busy, offline). Widget'ın
 *    "çevrimiçiyiz" göstergesi de bu alanı okuduğu için eksik seçenekler
 *    ziyaretçiye yanlış bilgi veriyordu.
 *
 *  - Okunmamış rozeti `item.path === '/dashboard/conversations'` ile
 *    karşılaştırılıyordu; /en altında yol `/en/dashboard/conversations` olduğu
 *    için rozet hiç görünmüyordu.
 *
 *  - `notifications` state'i doluyor ama HİÇBİR YERDE gösterilmiyordu; Bell
 *    ikonu da import edilip kullanılmıyordu. Artık gerçek bir bildirim menüsü.
 *
 *  - Ayarlar ve SSS sayfalarının rotası vardı ama menüde girişi yoktu:
 *    erişilemez sayfalardı.
 */

const STATUSES = ['online', 'away', 'busy', 'offline'];
const STATUS_COLOR = {
  online: 'bg-green-500',
  away: 'bg-amber-500',
  busy: 'bg-red-500',
  offline: 'bg-gray-400'
};

const DashboardLayout = () => {
  const { user, logout, patchUser } = useAuth();
  const { t } = useTranslation();
  const { language, toggleLanguage } = useLanguage();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [connection, setConnection] = useState('connecting');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const socketRef = useRef(null);
  const notifRef = useRef(null);
  const statusRef = useRef(null);

  const langPrefix = language === 'en' ? '/en' : '';
  const routes = useMemo(
    () => ({ login: `${langPrefix}/login`, dashboard: `${langPrefix}/dashboard` }),
    [langPrefix]
  );

  /* ------------------------------------------------------------- okunmamış */

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await conversationsAPI.getUnreadCount();
      setUnreadCount(response.data.totalUnreadCount || 0);
    } catch (error) {
      // Sayaç kritik değil; hata bildirimi göstermek gürültü olur.
    }
  }, []);

  /* ---------------------------------------------------------------- soket */

  useEffect(() => {
    fetchUnreadCount();

    const token = localStorage.getItem('token');
    const socket = io(`${import.meta.env.VITE_API_URL}/admin`, {
      transports: ['websocket', 'polling'],
      auth: { token: token || undefined },
      reconnection: true,
      reconnectionDelay: 800,
      reconnectionDelayMax: 8000
    });
    socketRef.current = socket;

    const relay = (event) => (payload) => {
      window.dispatchEvent(new CustomEvent(`socket:${event}`, { detail: payload }));
    };

    socket.on('connect', () => setConnection('connected'));
    socket.on('disconnect', (reason) => {
      // Kendi kapattığımız bağlantı bir arıza değildir.
      if (reason !== 'io client disconnect') setConnection('disconnected');
    });
    socket.io.on('reconnect_attempt', () => setConnection('reconnecting'));
    socket.io.on('reconnect', () => {
      setConnection('connected');
      // Bağlantı yokken kaçırılan olaylar için sayaç tazelenir.
      fetchUnreadCount();
    });

    socket.on('notification', (notification) => {
      setNotifications((prev) => [{ ...notification, receivedAt: Date.now() }, ...prev].slice(0, 12));
      fetchUnreadCount();
    });
    socket.on('messages-read', fetchUnreadCount);
    socket.on('new-message', (payload) => { relay('new-message')(payload); fetchUnreadCount(); });
    socket.on('conversation-assigned', (payload) => {
      relay('conversation-assigned')(payload);
      setNotifications((prev) => [{ type: 'assigned', ...payload, receivedAt: Date.now() }, ...prev].slice(0, 12));
      fetchUnreadCount();
    });
    socket.on('conversation-claimed', (payload) => { relay('conversation-claimed')(payload); fetchUnreadCount(); });
    socket.on('agent-status-changed', relay('agent-status-changed'));

    return () => {
      socket.removeAllListeners();
      socket.close();
      socketRef.current = null;
    };
  }, [fetchUnreadCount]);

  /* --------------------------------------------------- dışarı tıkla-kapat */

  useEffect(() => {
    const onDown = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (statusRef.current && !statusRef.current.contains(e.target)) setStatusOpen(false);
    };
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      setNotifOpen(false);
      setStatusOpen(false);
      setSidebarOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  // Rota değişince mobil kenar çubuğu kapanır; aksi halde gezindikten sonra
  // içeriğin üstünde açık kalıyordu.
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  /* --------------------------------------------------------------- eylem */

  const handleLogout = async () => {
    await logout();
    navigate(routes.login);
  };

  const handleStatusChange = async (next) => {
    setStatusOpen(false);
    if (user?.status === next) return;
    const previous = user?.status;
    setStatusSaving(true);
    patchUser({ status: next });                    // iyimser
    try {
      await authAPI.updateStatus({ status: next });
      // Diğer sekmeler ve ekip listesi anında görsün.
      socketRef.current?.emit('update-status', { status: next });
      toast.success(t(`status.changedTo.${next}`));
    } catch (error) {
      patchUser({ status: previous });              // geri al
      toast.error(t('status.updateFailed'));
    } finally {
      setStatusSaving(false);
    }
  };

  const handleConfirmDeleteAccount = async () => {
    setDeleteConfirmOpen(false);
    try {
      await authAPI.deleteAccount();
      await logout();
      navigate(routes.login);
    } catch (error) {
      toast.error(t('account.deleteFailed'));
    }
  };

  /* -------------------------------------------------------------- menüler */

  const navGroups = useMemo(() => {
    const role = user?.role || 'agent';
    const plan = user?.organization?.planType || 'FREE';
    const p = (path) => `${langPrefix}/dashboard${path}`;

    const inbox = { label: t('sidebar.groups.inbox'), items: [] };
    const workspace = { label: t('sidebar.groups.workspace'), items: [] };
    const insights = { label: t('sidebar.groups.insights'), items: [] };
    const account = { label: t('sidebar.groups.account'), items: [] };

    inbox.items.push({ path: p(''), icon: LayoutDashboard, label: t('sidebar.dashboard'), end: true });
    inbox.items.push({ path: p('/conversations'), icon: MessageCircle, label: t('sidebar.conversations'), badge: 'unread' });

    if (role !== 'viewer') {
      inbox.items.push({ path: p('/assigned'), icon: MessagesSquare, label: t('sidebar.assignedTickets') });
      inbox.items.push({ path: p('/team-chat'), icon: Send, label: t('sidebar.teamChat') });
    }

    if (['owner', 'admin'].includes(role)) {
      workspace.items.push({ path: p('/sites'), icon: Globe, label: t('sidebar.sites') });
      workspace.items.push({ path: p('/team'), icon: Users, label: t('sidebar.team') });
      workspace.items.push({ path: p('/departments'), icon: Folder, label: t('sidebar.departments') });
      workspace.items.push({ path: p('/faqs'), icon: HelpCircle, label: t('sidebar.faqs') });
      workspace.items.push({ path: p('/automation-rules'), icon: Zap, label: t('sidebar.automationRules') });
      workspace.items.push({ path: p('/proactive-rules'), icon: Send, label: t('sidebar.proactiveRules') });
      if (plan === 'PRO' || plan === 'ENTERPRISE') {
        workspace.items.push({ path: p('/visitors'), icon: Eye, label: t('sidebar.visitors') });
        workspace.items.push({ path: p('/crm'), icon: Briefcase, label: t('sidebar.crm') });
      }
    }

    if (['owner', 'admin', 'viewer'].includes(role)) {
      insights.items.push({ path: p('/analytics'), icon: BarChart3, label: t('sidebar.analytics') });
    }
    if (role !== 'viewer') {
      insights.items.push({ path: p('/my-performance'), icon: BarChart3, label: t('sidebar.myPerformance') });
    }
    if (['owner', 'admin'].includes(role) && plan === 'ENTERPRISE') {
      insights.items.push({ path: p('/audit-logs'), icon: Shield, label: t('sidebar.auditLogs') });
    }

    // Ayarlar sayfasının rotası vardı ama menüde girişi YOKTU; adresi elle
    // yazmadan ulaşılamıyordu.
    account.items.push({ path: p('/settings'), icon: Settings, label: t('sidebar.settings') });

    return [inbox, workspace, insights, account].filter((group) => group.items.length > 0);
  }, [user, langPrefix, t]);

  const status = user?.status || 'offline';
  const initial = (user?.name || '?').charAt(0).toUpperCase();

  const navLinkClass = ({ isActive }) =>
    `group flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-[13.5px] transition-colors
     focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1
     dark:focus-visible:ring-offset-gray-900
     ${isActive
        ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-medium'
        : 'text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'}`;

  const sidebar = (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-between h-14 px-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
        <Link to={routes.dashboard} className="flex items-center" aria-label="Support.io">
          <Logo size={26} />
        </Link>
        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden p-1.5 -mr-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label={t('common.close')}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto modal-scrollbar px-3 py-4 space-y-5">
        {navGroups.map((group) => (
          <div key={group.label}>
            <h2 className="px-3 mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              {group.label}
            </h2>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink key={item.path} to={item.path} end={item.end} className={navLinkClass}>
                  <span className="flex items-center gap-2.5 min-w-0">
                    <item.icon className="w-[18px] h-[18px] shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.badge === 'unread' && unreadCount > 0 && (
                    <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white
                      text-[11px] font-semibold leading-5 text-center">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* --------------------------------------------------------- kullanıcı */}
      <div className="shrink-0 border-t border-gray-200 dark:border-gray-800 p-3 space-y-2">
        <div className="relative" ref={statusRef}>
          <button
            onClick={() => setStatusOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={statusOpen}
            className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <span className="relative shrink-0">
              <span className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-500/15 flex items-center
                justify-center text-[13px] font-semibold text-indigo-700 dark:text-indigo-300">
                {initial}
              </span>
              <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2
                ring-white dark:ring-gray-900 ${STATUS_COLOR[status]}`} />
            </span>
            <span className="flex-1 min-w-0 text-left">
              <span className="block text-[13px] font-medium text-gray-900 dark:text-white truncate">
                {user?.name}
              </span>
              <span className="block text-[11.5px] text-gray-500 dark:text-gray-400 truncate">
                {statusSaving ? t('common.loading') : t(`status.${status}`)}
              </span>
            </span>
            {statusSaving
              ? <Loader2 className="w-3.5 h-3.5 shrink-0 text-gray-400 animate-spin" />
              : <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-gray-400 transition-transform ${statusOpen ? 'rotate-180' : ''}`} />}
          </button>

          {statusOpen && (
            <div
              role="listbox"
              className="absolute bottom-full left-0 right-0 mb-1 p-1 rounded-xl border border-gray-200
                dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl z-30"
            >
              {STATUSES.map((option) => (
                <button
                  key={option}
                  role="option"
                  aria-selected={status === option}
                  onClick={() => handleStatusChange(option)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px]
                    text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLOR[option]}`} />
                  <span className="flex-1 text-left">{t(`status.${option}`)}</span>
                  {status === option && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px]
            text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
        >
          <LogOut className="w-[18px] h-[18px] text-gray-400" />
          {t('sidebar.logout')}
        </button>
        <button
          onClick={() => setDeleteConfirmOpen(true)}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px]
            text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
        >
          <UserX className="w-[18px] h-[18px]" />
          {t('account.delete')}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      {/* masaüstü kenar çubuğu */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 z-40">{sidebar}</aside>

      {/* mobil çekmece */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 w-[17rem] max-w-[85vw] z-50 transform transition-transform
          duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        aria-hidden={!sidebarOpen}
      >
        {sidebar}
      </aside>
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-gray-900/50 z-40"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="flex-1 lg:ml-64 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* ------------------------------------------------------- üst çubuk */}
        <header className="shrink-0 h-14 flex items-center gap-2 px-3 sm:px-5
          bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 -ml-1 rounded-lg text-gray-600 dark:text-gray-400
              hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label={t('sidebar.openMenu')}
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link to={routes.dashboard} className="lg:hidden flex items-center" aria-label="Support.io">
            <LogoMark size={26} />
          </Link>

          <div className="flex-1" />

          {/* bağlantı durumu — yalnızca sorun varken görünür */}
          {connection !== 'connected' && (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-medium
                bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
              role="status"
            >
              {connection === 'reconnecting'
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <WifiOff className="w-3 h-3" />}
              <span className="hidden sm:inline">{t(`connection.${connection}`)}</span>
            </span>
          )}

          {/* bildirimler */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setNotifOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={notifOpen}
              aria-label={t('notifications.title')}
              className="relative p-2 rounded-lg text-gray-600 dark:text-gray-400
                hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              <Bell className="w-[18px] h-[18px]" />
              {notifications.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-900" />
              )}
            </button>

            {notifOpen && (
              <div
                role="menu"
                className="absolute right-0 top-12 w-80 max-w-[calc(100vw-1.5rem)] rounded-xl border
                  border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl z-50 overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-[13px] font-semibold text-gray-900 dark:text-white">
                    {t('notifications.title')}
                  </span>
                  {notifications.length > 0 && (
                    <button
                      onClick={() => setNotifications([])}
                      className="text-[11.5px] text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"
                    >
                      {t('notifications.clear')}
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto modal-scrollbar">
                  {notifications.length === 0 ? (
                    <p className="px-4 py-8 text-center text-[13px] text-gray-500 dark:text-gray-400">
                      {t('notifications.empty')}
                    </p>
                  ) : (
                    notifications.map((notification, index) => (
                      <button
                        key={`${notification.receivedAt}-${index}`}
                        onClick={() => {
                          setNotifOpen(false);
                          navigate(`${langPrefix}/dashboard/conversations`);
                        }}
                        className="w-full text-left px-4 py-3 border-b border-gray-50 dark:border-gray-700/60
                          hover:bg-gray-50 dark:hover:bg-gray-700/40 transition"
                      >
                        <span className="block text-[13px] text-gray-900 dark:text-gray-100 line-clamp-2">
                          {notification.message || notification.title || t(`notifications.types.${notification.type}`, notification.type)}
                        </span>
                        <span className="block mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                          {new Date(notification.receivedAt).toLocaleTimeString(language === 'tr' ? 'tr-TR' : 'en-US', {
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* dil */}
          <button
            onClick={toggleLanguage}
            className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[12.5px] font-medium
              text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            aria-label={t('header.switchLanguage')}
          >
            <Languages className="w-[18px] h-[18px]" />
            <span className="uppercase">{language === 'tr' ? 'EN' : 'TR'}</span>
          </button>

          {/* tema */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-gray-600 dark:text-gray-400
              hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            aria-label={isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
            title={isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
          >
            {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>

      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDeleteAccount}
        title={t('account.delete')}
        message={t('account.deleteConfirm')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        type="danger"
      />
    </div>
  );
};

export default DashboardLayout;
