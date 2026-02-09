import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams } from 'react-router-dom';
import { sitesAPI, conversationsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { io } from 'socket.io-client';
import { Send, Search, MessageCircle, User, Clock, CheckCheck } from 'lucide-react';

const Conversations = () => {
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState(null);
  const { user } = useAuth();
  const messagesEndRef = useRef(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Setup socket connection
  useEffect(() => {
    fetchSites();
    
    const newSocket = io('http://localhost:5000/admin', {
      transports: ['websocket', 'polling']
    });
    
    newSocket.on('connect', () => {
      console.log('✅ Admin socket connected!');
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Admin socket disconnected');
    });

    setSocket(newSocket);

    return () => {
      console.log('🔌 Closing socket connection');
      newSocket.close();
    };
  }, []);

  // Listen to socket events
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data) => {
      console.log('📨 New message received:', data);
      
      // Add message to current conversation if it's the selected one
      if (selectedConversation && data.message.conversationId === selectedConversation._id) {
        setMessages(prev => {
          // Prevent duplicates
          if (prev.some(msg => msg._id === data.message._id)) {
            return prev;
          }
          return [...prev, data.message];
        });
      }

      // Update conversation in list
      setConversations(prev => 
        prev.map(conv => 
          conv._id === data.message.conversationId 
            ? { ...conv, lastMessage: data.message, lastMessageAt: new Date() }
            : conv
        ).sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))
      );
    };

    const handleConversationUpdate = (data) => {
      console.log('🔄 Conversation update:', data);
      if (selectedSite) {
        fetchConversations(selectedSite._id);
      }
    };

    socket.on('new-message', handleNewMessage);
    socket.on('conversation-update', handleConversationUpdate);

    return () => {
      socket.off('new-message', handleNewMessage);
      socket.off('conversation-update', handleConversationUpdate);
    };
  }, [socket, selectedConversation, selectedSite]);

  // Join site room when site is selected
  useEffect(() => {
    if (selectedSite && socket && user) {
      console.log('🏢 Joining site room:', selectedSite._id);
      socket.emit('join-site', {
        siteId: selectedSite._id,
        userId: user._id
      });
      fetchConversations(selectedSite._id);
    }
  }, [selectedSite, socket, user]);

  // Join conversation room when conversation is selected
  useEffect(() => {
    if (selectedConversation && socket) {
      console.log('💬 Joining conversation room:', selectedConversation._id);
      socket.emit('join-conversation', {
        conversationId: selectedConversation._id
      });
      fetchConversationMessages(selectedConversation._id);
    }
  }, [selectedConversation, socket]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchSites = async () => {
    try {
      const response = await sitesAPI.getAll();
      setSites(response.data.sites);
      if (response.data.sites.length > 0 && !selectedSite) {
        setSelectedSite(response.data.sites[0]);
      }
    } catch (error) {
      console.error('Failed to fetch sites:', error);
    }
  };

  const fetchConversations = async (siteId) => {
    try {
      const response = await conversationsAPI.getAll(siteId);
      setConversations(response.data.conversations);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    }
  };

  const fetchConversationMessages = async (conversationId) => {
    try {
      const response = await conversationsAPI.getOne(selectedSite._id, conversationId);
      setMessages(response.data.messages);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket || !selectedConversation) return;

    console.log('📤 Sending message:', newMessage);
    console.log('👤 User data:', user);

    socket.emit('send-message', {
      conversationId: selectedConversation._id,
      content: newMessage,
      senderName: user?.name || 'Support',
      senderId: user?.id || user?._id || 'support'
    });

    setNewMessage('');
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      open: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
      assigned: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
      resolved: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
      closed: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
    };
    return colors[status] || colors.open;
  };

  return (
    <>
      <Helmet>
        <title>Konuşmalar - Support.io Admin</title>
        <meta name="description" content="Müşterilerinizle gerçek zamanlı sohbet edin. Canlı destek konuşmalarını yönetin ve anında yanıt verin." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="max-w-7xl mx-auto h-[calc(100vh-100px)]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white transition-colors duration-200">Konuşmalar</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1 transition-colors duration-200">Müşterilerinizle gerçek zamanlı sohbet edin</p>
        </div>
        
        {/* Site selector */}
        <select
          value={selectedSite?._id || ''}
          onChange={(e) => {
            const site = sites.find(s => s._id === e.target.value);
            setSelectedSite(site);
            setSelectedConversation(null);
          }}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-colors duration-200"
        >
          {sites.map(site => (
            <option key={site._id} value={site._id}>{site.name}</option>
          ))}
        </select>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex h-[calc(100%-100px)] transition-colors duration-200">
        {/* Conversations List */}
        <div className="w-80 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-colors duration-200">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 transition-colors duration-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500 transition-colors duration-200" />
              <input
                type="text"
                placeholder="Konuşmalarda ara..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400 transition-colors duration-200">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-500 transition-colors duration-200" />
                <p>Henüz konuşma yok</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv._id}
                  onClick={() => setSelectedConversation(conv)}
                  className={`p-4 border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 ${
                    selectedConversation?._id === conv._id ? 'bg-indigo-50 dark:bg-indigo-900' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center transition-colors duration-200">
                        <User className="w-5 h-5 text-indigo-600 dark:text-indigo-400 transition-colors duration-200" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white transition-colors duration-200">{conv.visitorName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 transition-colors duration-200">{conv.currentPage}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(conv.status)}`}>
                      {conv.status}
                    </span>
                  </div>
                  {conv.lastMessage && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 truncate transition-colors duration-200">{conv.lastMessage.content}</p>
                  )}
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 transition-colors duration-200">
                    {formatTime(conv.lastMessageAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        {selectedConversation ? (
          <div className="flex-1 flex flex-col">
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-700 transition-colors duration-200">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center transition-colors duration-200">
                  <User className="w-5 h-5 text-indigo-600 dark:text-indigo-400 transition-colors duration-200" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white transition-colors duration-200">{selectedConversation.visitorName}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 transition-colors duration-200">{selectedConversation.visitorEmail || 'E-posta yok'}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-3 py-1 text-xs rounded-full ${getStatusColor(selectedConversation.status)}`}>
                  {selectedConversation.status}
                </span>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
              {messages.map((message) => (
                <div
                  key={message._id}
                  className={`flex ${message.senderType === 'visitor' ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`max-w-md ${message.senderType === 'visitor' ? '' : 'order-2'}`}>
                    {message.senderType !== 'visitor' && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 text-right transition-colors duration-200">{message.senderName}</p>
                    )}
                    <div
                      className={`px-4 py-2 rounded-lg transition-colors duration-200 ${
                        message.senderType === 'visitor'
                          ? 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white'
                          : message.senderType === 'bot'
                          ? 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                          : 'bg-indigo-600 text-white'
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                    </div>
                    <div className="flex items-center justify-end space-x-1 mt-1">
                      <p className="text-xs text-gray-400 dark:text-gray-500 transition-colors duration-200">{formatTime(message.createdAt)}</p>
                      {message.senderType === 'agent' && message.isRead && (
                        <CheckCheck className="w-3 h-3 text-indigo-600 dark:text-indigo-400 transition-colors duration-200" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 transition-colors duration-200">
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Mesajınızı yazın..."
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <Send className="w-5 h-5" />
                  <span>Gönder</span>
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
            <div className="text-center text-gray-500 dark:text-gray-400 transition-colors duration-200">
              <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-500 transition-colors duration-200" />
              <p className="text-lg">Sohbet başlatmak için bir konuşma seçin</p>
            </div>
          </div>
        )}
      </div>
      </div>
    </>
  );
};

export default Conversations;
