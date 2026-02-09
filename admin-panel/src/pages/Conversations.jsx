import React, { useState, useEffect, useRef } from 'react';
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

  useEffect(() => {
    fetchSites();
    
    // Setup socket connection
    const newSocket = io('http://localhost:3000/admin');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to admin socket');
    });

    newSocket.on('new-message', (data) => {
      setMessages(prev => [...prev, data.message]);
      // Update conversation in list
      setConversations(prev => 
        prev.map(conv => 
          conv._id === data.message.conversationId 
            ? { ...conv, lastMessage: data.message, lastMessageAt: new Date() }
            : conv
        )
      );
    });

    newSocket.on('conversation-update', (data) => {
      fetchConversations(selectedSite?._id);
    });

    return () => newSocket.close();
  }, []);

  useEffect(() => {
    if (selectedSite && socket) {
      socket.emit('join-site', {
        siteId: selectedSite._id,
        userId: user.id
      });
      fetchConversations(selectedSite._id);
    }
  }, [selectedSite, socket]);

  useEffect(() => {
    if (selectedConversation && socket) {
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

    socket.emit('send-message', {
      conversationId: selectedConversation._id,
      content: newMessage,
      senderName: user.name,
      senderId: user.id
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
      open: 'bg-yellow-100 text-yellow-700',
      assigned: 'bg-blue-100 text-blue-700',
      resolved: 'bg-green-100 text-green-700',
      closed: 'bg-gray-100 text-gray-700'
    };
    return colors[status] || colors.open;
  };

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-100px)]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Konuşmalar</h1>
          <p className="text-gray-600 mt-1">Müşterilerinizle gerçek zamanlı sohbet edin</p>
        </div>
        
        {/* Site selector */}
        <select
          value={selectedSite?._id || ''}
          onChange={(e) => {
            const site = sites.find(s => s._id === e.target.value);
            setSelectedSite(site);
            setSelectedConversation(null);
          }}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
        >
          {sites.map(site => (
            <option key={site._id} value={site._id}>{site.name}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex h-[calc(100%-100px)]">
        {/* Conversations List */}
        <div className="w-80 border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Konuşmalarda ara..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>Henüz konuşma yok</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv._id}
                  onClick={() => setSelectedConversation(conv)}
                  className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition ${
                    selectedConversation?._id === conv._id ? 'bg-indigo-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{conv.visitorName}</p>
                        <p className="text-xs text-gray-500">{conv.currentPage}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(conv.status)}`}>
                      {conv.status}
                    </span>
                  </div>
                  {conv.lastMessage && (
                    <p className="text-sm text-gray-600 truncate">{conv.lastMessage.content}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
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
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{selectedConversation.visitorName}</p>
                  <p className="text-sm text-gray-500">{selectedConversation.visitorEmail || 'E-posta yok'}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-3 py-1 text-xs rounded-full ${getStatusColor(selectedConversation.status)}`}>
                  {selectedConversation.status}
                </span>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
              {messages.map((message) => (
                <div
                  key={message._id}
                  className={`flex ${message.senderType === 'visitor' ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`max-w-md ${message.senderType === 'visitor' ? '' : 'order-2'}`}>
                    {message.senderType !== 'visitor' && (
                      <p className="text-xs text-gray-500 mb-1 text-right">{message.senderName}</p>
                    )}
                    <div
                      className={`px-4 py-2 rounded-lg ${
                        message.senderType === 'visitor'
                          ? 'bg-white border border-gray-200'
                          : message.senderType === 'bot'
                          ? 'bg-gray-200 text-gray-800'
                          : 'bg-indigo-600 text-white'
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                    </div>
                    <div className="flex items-center justify-end space-x-1 mt-1">
                      <p className="text-xs text-gray-400">{formatTime(message.createdAt)}</p>
                      {message.senderType === 'agent' && message.isRead && (
                        <CheckCheck className="w-3 h-3 text-indigo-600" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 bg-white">
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Mesajınızı yazın..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <Send className="w-5 h-5" />
                  <span>Gönder</span>
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center text-gray-500">
              <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-lg">Sohbet başlatmak için bir konuşma seçin</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Conversations;
