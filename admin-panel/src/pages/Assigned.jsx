import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { conversationsAPI } from '../services/api';

const Assigned = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAssigned = async () => {
    try {
      setLoading(true);
      const resp = await conversationsAPI.getAssigned();
      if (resp?.data?.conversations) {
        setConversations(resp.data.conversations);
      } else {
        setConversations([]);
      }
    } catch (err) {
      console.error('Failed to fetch assigned conversations:', err);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssigned();
    const onAssigned = (e) => {
      const payload = e.detail || e;
      // If assignment affects current user, refresh
      if (String(payload.agentId) === String(user?._id)) fetchAssigned();
    };

    window.addEventListener('socket:conversation-assigned', onAssigned);

    return () => {
      window.removeEventListener('socket:conversation-assigned', onAssigned);
    };
  }, [user]);

  const openConversation = (conv) => {
    try {
      window.dispatchEvent(new CustomEvent('navigate:open-conversation', { detail: { conversationId: conv._id, siteId: conv.siteId || conv.site?._id } }));
    } catch (e) {}
  };

  return (
    <div className="w-full">
      <Helmet>
        <title>{t('assigned.title') || 'Atanan Talepler'} - Support.io</title>
      </Helmet>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('assigned.title') || 'Atanan Talepler'}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('dashboard.ticket')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('dashboard.priority')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('dashboard.status')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('dashboard.time')}</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">{t('dashboard.refreshing')}</td>
                </tr>
              ) : conversations.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">{t('dashboard.noTickets')}</td>
                </tr>
              ) : (
                conversations.map((ticket) => (
                  <tr 
                    key={ticket._id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition"
                    onClick={() => openConversation(ticket)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{(ticket.visitorName || 'V').charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{ticket.ticketId || `#${ticket.ticketNumber}`}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{ticket.visitorName || t('dashboard.visitor')}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 inline-flex text-xs font-semibold rounded-full ${ticket.priority === 'urgent' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' : ticket.priority === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' : ticket.priority === 'normal' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'}`}>
                        {ticket.priority === 'urgent' ? t('dashboard.urgent') 
                          : ticket.priority === 'high' ? t('dashboard.high') 
                          : ticket.priority === 'normal' ? t('dashboard.medium') 
                          : t('dashboard.low')
                        }
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 inline-flex text-xs font-semibold rounded-full ${ticket.status === 'open' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' : ticket.status === 'assigned' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' : ticket.status === 'pending' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' : ticket.status === 'resolved' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'}`}>
                        {ticket.status === 'open' ? t('dashboard.open')
                          : ticket.status === 'assigned' ? t('dashboard.assigned')
                          : ticket.status === 'pending' ? t('dashboard.pending')
                          : ticket.status === 'resolved' ? t('dashboard.resolved')
                          : t('dashboard.closed')
                        }
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{new Date(ticket.createdAt).toLocaleTimeString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Assigned;
