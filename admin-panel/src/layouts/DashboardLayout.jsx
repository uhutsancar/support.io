import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  MessageSquare,
  LayoutDashboard,
  Globe,
  MessageCircle,
  HelpCircle,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  Users,
  Folder,
  BarChart3,
  MessagesSquare,
  UserX,
  CircleDot,
  Eye,
  Briefcase,
  Shield
} from 'lucide-react';
import { conversationsAPI, authAPI } from '../services/api';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import logo from '../public/support.io_logo.webp';
import ConfirmDialog from '../components/ConfirmDialog';

const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [socket, setSocket] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const langPrefix = language === 'en' ? '/en' : '';
  const routes = {
    home: langPrefix || '/',
    login: `${langPrefix}/login`,
    dashboard: `${langPrefix}/dashboard`
  };
  useEffect(() => {
  }, [i18n.language, t]);
  const handleLogout = async () => {
    await logout();
    navigate(routes.login);
  };
  const handleStatusChange = async (newStatus) => {
    if (user?.status === newStatus) return;
    try {
      await authAPI.updateStatus({ status: newStatus });
      const updatedUser = { ...user, status: newStatus };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      window.location.reload();
    } catch (e) {
      toast.error('Statü güncellenemedi');
    }
  };
  const handleDeleteAccountClick = () => {
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDeleteAccount = async () => {
    try {
      await authAPI.deleteAccount();
      await logout();
      navigate(routes.login);
    } catch (e) {
      toast.error('Hesap silinemedi');
    }
    setDeleteConfirmOpen(false);
  };
  useEffect(() => {
    fetchUnreadCount();
    const socketUrl = import.meta.env.VITE_API_URL + '/admin';
    const token = localStorage.getItem('token');
    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      auth: {
        token: token || undefined
      }
    });
    newSocket.on('connect', () => {
    });
    newSocket.on('notification', (notification) => {
      setNotifications(prev => [notification, ...prev.slice(0, 9)]);
      fetchUnreadCount();
    });
    newSocket.on('messages-read', () => {
      fetchUnreadCount();
    });
    newSocket.on('conversation-assigned', (payload) => {
      try {
        window.dispatchEvent(new CustomEvent('socket:conversation-assigned', { detail: payload }));
      } catch (e) {
        setNotifications(prev => [{ type: 'assigned', ...payload }, ...prev.slice(0, 9)]);
      }
      fetchUnreadCount();
    });
    newSocket.on('conversation-claimed', (payload) => {
      try {
        window.dispatchEvent(new CustomEvent('socket:conversation-claimed', { detail: payload }));
      } catch (e) {
        setNotifications(prev => [{ type: 'claimed', ...payload }, ...prev.slice(0, 9)]);
      }
      fetchUnreadCount();
    });
    newSocket.on('new-message', (payload) => {
      try {
        window.dispatchEvent(new CustomEvent('socket:new-message', { detail: payload }));
      } catch (e) {
      }
      fetchUnreadCount();
    });
    setSocket(newSocket);
    return () => {
      newSocket.close();
    };
  }, []);
  const fetchUnreadCount = async () => {
    try {
      const response = await conversationsAPI.getUnreadCount();
      setUnreadCount(response.data.totalUnreadCount || 0);
    } catch (error) {
    }
  };
  const buildNav = () => {
    const role = user?.role || 'agent';
    const plan = user?.organization?.planType || 'FREE';
    const items = [];
    const add = (p) => items.push(p);
    if (['owner', 'admin'].includes(role)) {
      add({ path: `${langPrefix}/dashboard`, icon: LayoutDashboard, label: t('sidebar.dashboard') });
      add({ path: `${langPrefix}/dashboard/sites`, icon: Globe, label: t('sidebar.sites') });
      add({ path: `${langPrefix}/dashboard/conversations`, icon: MessageCircle, label: t('sidebar.conversations') });
      add({ path: `${langPrefix}/dashboard/analytics`, icon: BarChart3, label: t('sidebar.analytics') });
      add({ path: `${langPrefix}/dashboard/team`, icon: Users, label: t('sidebar.team') });
      add({ path: `${langPrefix}/dashboard/departments`, icon: Folder, label: t('sidebar.departments') });
      if (plan === 'PRO' || plan === 'ENTERPRISE') {
        add({ path: `${langPrefix}/dashboard/visitors`, icon: Eye, label: 'Ziyaretçiler' });
        add({ path: `${langPrefix}/dashboard/crm`, icon: Briefcase, label: 'CRM' });
      }
      if (plan === 'ENTERPRISE') {
        add({ path: `${langPrefix}/dashboard/audit-logs`, icon: Shield, label: t('sidebar.auditLogs') });
      }
      add({ path: `${langPrefix}/dashboard/assigned`, icon: MessagesSquare, label: t('sidebar.assignedTickets') });
      add({ path: `${langPrefix}/dashboard/team-chat`, icon: MessagesSquare, label: t('sidebar.teamChat') });
      add({ path: `${langPrefix}/dashboard/my-performance`, icon: BarChart3, label: t('sidebar.myPerformance') });
    } else if (role === 'viewer') {
      add({ path: `${langPrefix}/dashboard`, icon: LayoutDashboard, label: t('sidebar.dashboard') });
      add({ path: `${langPrefix}/dashboard/conversations`, icon: MessageCircle, label: t('sidebar.conversations') });
      add({ path: `${langPrefix}/dashboard/analytics`, icon: BarChart3, label: t('sidebar.analytics') });
    } else { // agent
      add({ path: `${langPrefix}/dashboard`, icon: LayoutDashboard, label: t('sidebar.dashboard') });
      add({ path: `${langPrefix}/dashboard/conversations`, icon: MessageCircle, label: t('sidebar.conversations') });
      add({ path: `${langPrefix}/dashboard/assigned`, icon: MessagesSquare, label: t('sidebar.assignedTickets') });
      add({ path: `${langPrefix}/dashboard/team-chat`, icon: MessagesSquare, label: t('sidebar.teamChat') });
      add({ path: `${langPrefix}/dashboard/my-performance`, icon: BarChart3, label: t('sidebar.myPerformance') });
    }
    return items;
  };

  const navItems = buildNav();
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-200 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <Link to={routes.dashboard} className="flex items-center cursor-pointer">
              <img src={logo} alt="Support.io" className="h-10 w-auto dark:invert-0" />
            </Link>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-500 dark:text-gray-400">
              <X className="w-6 h-6" />
            </button>
          </div>
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto modal-scrollbar">
            {navItems.map((item) => {
              const isAssignedLink = item.path && item.path.includes('tab=assigned');
              if (isAssignedLink) {
                return (
                  <button
                    key={item.path}
                    onClick={() => {
                      navigate(`${langPrefix}/dashboard/conversations`);
                      try {
                        window.dispatchEvent(new CustomEvent('navigate:set-tab', { detail: { tab: 'assigned' } }));
                      } catch (e) { }
                      setSidebarOpen(false);
                    }}
                    className={`w-full text-left flex items-center justify-between px-4 py-3 rounded-lg transition text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50`}
                  >
                    <div className="flex items-center space-x-3">
                      <item.icon className="w-5 h-5" />
                      <span className="font-medium">{item.label}</span>
                    </div>
                  </button>
                );
              }
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === `${langPrefix}/dashboard`}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-4 py-3 rounded-lg transition ${isActive
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`
                  }
                  onClick={() => setSidebarOpen(false)}
                >
                  <div className="flex items-center space-x-3">
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </div>
                  {item.path === '/dashboard/conversations' && unreadCount > 0 && (
                    <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[20px] h-5 flex items-center justify-center animate-pulse">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3 w-full">
                <div className="relative">
                  <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/40 rounded-full flex items-center justify-center">
                    <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                      {user?.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${user?.status === 'online' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                </div>
              </div>
            </div>
            { }
            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 mb-4 select-none text-xs w-full">
              <button
                onClick={() => handleStatusChange('online')}
                className={`flex-1 py-1.5 flex justify-center items-center gap-1.5 rounded-md transition-all ${user?.status === 'online'
                  ? 'bg-white dark:bg-gray-700 shadow-sm text-green-600 dark:text-green-400 font-medium'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
              >
                <CircleDot className="w-3 h-3" /> Online
              </button>
              <button
                onClick={() => handleStatusChange('offline')}
                className={`flex-1 py-1.5 flex justify-center items-center gap-1.5 rounded-md transition-all ${user?.status === 'offline' || !user?.status
                  ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-700 dark:text-gray-300 font-medium'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
              >
                <CircleDot className="w-3 h-3" /> Offline
              </button>
            </div>
            <div className="space-y-1">
              <button
                onClick={handleLogout}
                className="w-full flex items-center space-x-3 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg transition"
              >
                <LogOut className="w-4 h-4 text-gray-500" />
                <span>{t('sidebar.logout')}</span>
              </button>
              <button
                onClick={handleDeleteAccountClick}
                className="w-full flex items-center space-x-3 px-3 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
              >
                <UserX className="w-4 h-4" />
                <span>Hesabı Sil</span>
              </button>
            </div>
          </div>
        </div>
      </aside>
      <div className="flex-1 lg:ml-64 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="lg:hidden shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-700 dark:text-gray-300">
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center">
            <img src={logo} alt="Support.io" className="h-10 w-auto dark:invert-0" />
          </div>
          <div className="w-6" />
        </header>
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <Outlet />
        </main>
      </div>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDeleteAccount}
        title={t('common.deleteAccount', 'Hesabı Sil')}
        message={t('common.confirmDelete', 'Hesabınızı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')}
        confirmText={t('common.delete', 'Sil')}
        cancelText={t('common.cancel', 'İptal')}
        type="danger"
      />
    </div>
  );
};
export default DashboardLayout;
