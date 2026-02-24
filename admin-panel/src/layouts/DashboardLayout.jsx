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
  MessagesSquare
} from 'lucide-react';
import { conversationsAPI } from '../services/api';
import { io } from 'socket.io-client';
import logo from '../public/support.io_logo.webp';

const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [socket, setSocket] = useState(null);
  const [notifications, setNotifications] = useState([]);
  
  const langPrefix = language === 'en' ? '/en' : '';
  const routes = {
    home: langPrefix || '/',
    login: `${langPrefix}/login`,
    dashboard: `${langPrefix}/dashboard`
  };

  useEffect(() => {
    console.log('🌍 Current language:', i18n.language);
    console.log('📝 Sidebar translations:', {
      dashboard: t('sidebar.dashboard'),
      departments: t('sidebar.departments'),
      team: t('sidebar.team'),
    });
  }, [i18n.language, t]);

  const handleLogout = async () => {
    await logout();
    navigate(routes.login);
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
      console.log('✅ Dashboard layout socket connected!');
      // NOTE: Do not emit `join-site` from layout. Pages (e.g. Conversations) emit join-site with a specific siteId.
    });

    newSocket.on('notification', (notification) => {
      console.log('🔔 Notification received:', notification);
      setNotifications(prev => [notification, ...prev.slice(0, 9)]);
      fetchUnreadCount();
    });

    newSocket.on('messages-read', () => {
      fetchUnreadCount();
    });

    // conversation assignment events
    newSocket.on('conversation-assigned', (payload) => {
      console.log('📥 conversation-assigned event:', payload);
      try {
        window.dispatchEvent(new CustomEvent('socket:conversation-assigned', { detail: payload }));
      } catch (e) {
        setNotifications(prev => [{ type: 'assigned', ...payload }, ...prev.slice(0, 9)]);
      }
      fetchUnreadCount();
    });

    newSocket.on('conversation-claimed', (payload) => {
      console.log('📥 conversation-claimed event:', payload);
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
        // ignore
      }
      fetchUnreadCount();
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  // Pages must call `socket.emit('join-site', { siteId, userId })` when they know the siteId.

  const fetchUnreadCount = async () => {
    try {
      const response = await conversationsAPI.getUnreadCount();
      setUnreadCount(response.data.totalUnreadCount || 0);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  // Build navigation dynamically based on role and plan
  const buildNav = () => {
    const role = user?.role || 'agent';
    const plan = user?.organization?.planType || 'FREE';
    const items = [];

    const add = (p) => items.push(p);

    // Owner and Admin see dashboard
    if (['owner', 'admin'].includes(role)) {
      add({ path: `${langPrefix}/dashboard`, icon: LayoutDashboard, label: t('sidebar.dashboard') });
      add({ path: `${langPrefix}/dashboard/sites`, icon: Globe, label: t('sidebar.sites') });
      add({ path: `${langPrefix}/dashboard/conversations`, icon: MessageCircle, label: t('sidebar.conversations') });
    // Analytics should be visible to owner/admin regardless of plan
    add({ path: `${langPrefix}/dashboard/analytics`, icon: BarChart3, label: t('sidebar.analytics') });
      add({ path: `${langPrefix}/dashboard/departments`, icon: Folder, label: t('sidebar.departments') });
      add({ path: `${langPrefix}/dashboard/team`, icon: Users, label: t('sidebar.team') });
      add({ path: `${langPrefix}/dashboard/audit-logs`, icon: Bell, label: t('sidebar.auditLogs') });
      add({ path: `${langPrefix}/dashboard/team-chat`, icon: MessagesSquare, label: t('sidebar.teamChat') });
      add({ path: `${langPrefix}/dashboard/faqs`, icon: HelpCircle, label: t('sidebar.faqs') });
      add({ path: `${langPrefix}/dashboard/settings`, icon: Settings, label: t('sidebar.settings') });
      // integrations and automation may be separate routes; show them in settings or add if route exists
      if (plan === 'ENTERPRISE') {
        add({ path: `${langPrefix}/dashboard/integrations`, icon: Settings, label: t('sidebar.integrations') });
      }
    } else if (role === 'agent') {
      // Agents have a minimal menu
      add({ path: `${langPrefix}/dashboard/conversations`, icon: MessageCircle, label: t('sidebar.inbox') });
      // dedicated assigned page
      add({ path: `${langPrefix}/dashboard/assigned`, icon: MessagesSquare, label: t('sidebar.assignedTickets') });
      add({ path: `${langPrefix}/dashboard/team-chat`, icon: MessagesSquare, label: t('sidebar.teamChat') });
      add({ path: `${langPrefix}/dashboard/my-performance`, icon: BarChart3, label: t('sidebar.myPerformance') });
    } else if (role === 'viewer') {
      add({ path: `${langPrefix}/dashboard`, icon: LayoutDashboard, label: t('sidebar.dashboard') });
      add({ path: `${langPrefix}/dashboard/conversations`, icon: MessageCircle, label: t('sidebar.conversations') });
      add({ path: `${langPrefix}/dashboard/analytics`, icon: BarChart3, label: t('sidebar.analytics') });
    } else {
      // fallback
      add({ path: `${langPrefix}/dashboard`, icon: LayoutDashboard, label: t('sidebar.dashboard') });
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
              <img src={logo} alt="Support.io" style={{ height: '9rem', width: 'auto', maxWidth: '100%' }} />
            </Link>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-500 dark:text-gray-400">
              <X className="w-6 h-6" />
            </button>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isAssignedLink = item.path && item.path.includes('tab=assigned');
              if (isAssignedLink) {
                return (
                  <button
                    key={item.path}
                    onClick={() => {
                      // Open Conversations page and set assigned tab without changing URL
                      navigate(`${langPrefix}/dashboard/conversations`);
                      try {
                        window.dispatchEvent(new CustomEvent('navigate:set-tab', { detail: { tab: 'assigned' } }));
                      } catch (e) {}
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
                    `flex items-center justify-between px-4 py-3 rounded-lg transition ${
                      isActive
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
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/40 rounded-full flex items-center justify-center">
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                    {user?.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
              <span>{t('sidebar.logout')}</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 lg:ml-64">
        <header className="lg:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-700 dark:text-gray-300">
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center">
            <img src={logo} alt="Support.io" style={{ height: '9rem', width: 'auto', maxWidth: '100%' }} />
          </div>
          <div className="w-6" />
        </header>

        <main className="p-6 overflow-y-auto h-full bg-gray-50 dark:bg-gray-900">
          <Outlet />
        </main>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default DashboardLayout;
