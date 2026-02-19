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
  }, []);

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

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-lg font-semibold mb-4">{t('assigned.title') || 'Atanan Talepler'}</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Yükleniyor...</p>
        ) : conversations.length === 0 ? (
          <p className="text-sm text-gray-500">Atanmış talep yok</p>
        ) : (
          <div className="space-y-3">
            {conversations.map(conv => (
              <div key={conv._id} className="p-3 border rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer" onClick={() => openConversation(conv)}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{conv.ticketId || `#${conv.ticketNumber}`}</div>
                    <div className="text-xs text-gray-500">{conv.visitorName || 'Visitor'}</div>
                  </div>
                  <div className="text-right text-xs text-gray-500">{new Date(conv.createdAt).toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'})}</div>
                </div>
                <div className="text-sm text-gray-700 dark:text-gray-300 mt-2 truncate">{conv.lastMessage?.content || conv.lastMessage?.text || '-'}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Assigned;
