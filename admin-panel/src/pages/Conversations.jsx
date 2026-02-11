import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { sitesAPI, conversationsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { io } from 'socket.io-client';
import { Send, Search, MessageCircle, User, Clock, CheckCheck, Trash2, Paperclip, X, File, Image, FileText } from 'lucide-react';

const Conversations = () => {
  const { t } = useTranslation();
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [socket, setSocket] = useState(null);
  const { user } = useAuth();
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
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

  const deleteConversation = async (conversationId) => {
    if (!window.confirm('Bu konuşmayı ve tüm mesajları silmek istediğinizden emin misiniz?')) {
      return;
    }

    try {
      await conversationsAPI.delete(selectedSite._id, conversationId);
      
      // Silinenen conversation'ı listeden kaldır
      setConversations(prev => prev.filter(conv => conv._id !== conversationId));
      
      // Eğer silinen conversation seçili ise, seçimi kaldır
      if (selectedConversation?._id === conversationId) {
        setSelectedConversation(null);
        setMessages([]);
      }

      console.log('✅ Conversation deleted successfully');
    } catch (error) {
      console.error('❌ Failed to delete conversation:', error);
      alert('Konuşma silinirken hata oluştu: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedFile) || !socket || !selectedConversation) return;

    if (selectedFile) {
      await uploadAndSendFile();
    } else {
      console.log('📤 Sending message:', newMessage);
      console.log('👤 User data:', user);

      socket.emit('send-message', {
        conversationId: selectedConversation._id,
        content: newMessage,
        senderName: user?.name || 'Support',
        senderId: user?.id || user?._id || 'support'
      });

      setNewMessage('');
    }
  };

  const uploadAndSendFile = async () => {
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('http://localhost:5000/api/files/upload', {
        method: 'POST',
        headers: {
          'X-Site-Key': selectedSite.siteKey,
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('File upload failed');
      }

      const data = await response.json();
      const messageType = selectedFile.type.startsWith('image/') ? 'image' : 'file';

      socket.emit('send-message', {
        conversationId: selectedConversation._id,
        content: newMessage.trim() || 'File attachment',
        senderName: user?.name || 'Support',
        senderId: user?.id || user?._id || 'support',
        messageType,
        fileData: data.file
      });

      setNewMessage('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      console.error('File upload error:', error);
      alert('Dosya yüklenemedi. Lütfen tekrar deneyin.');
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      alert('Dosya çok büyük. Maksimum 10MB yükleyebilirsiniz.');
      return;
    }

    setSelectedFile(file);
  };

  const clearFileSelection = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType) => {
    if (mimeType?.includes('image')) return <Image className="w-4 h-4" />;
    if (mimeType?.includes('pdf')) return <FileText className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
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
        <title>{t('conversations.title')} - Support.io Admin</title>
        <meta name="description" content={t('conversations.subtitle')} />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="w-full h-full max-w-full overflow-hidden">
        <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 xl:px-8 h-screen max-h-screen overflow-hidden flex flex-col py-2 sm:py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 mb-2 sm:mb-3 lg:mb-4 flex-shrink-0">
          <div className="min-w-0 flex-shrink-1">
            <h1 className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-gray-900 dark:text-white transition-colors duration-200 truncate">{t('conversations.title')}</h1>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-0.5 sm:mt-1 transition-colors duration-200 truncate">{t('conversations.subtitle')}</p>
          </div>
        
          {/* Site selector */}
          <select
            value={selectedSite?._id || ''}
            onChange={(e) => {
              const site = sites.find(s => s._id === e.target.value);
              setSelectedSite(site);
              setSelectedConversation(null);
            }}
            className="px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-colors duration-200 w-full sm:w-auto flex-shrink-0"
          >
            {sites.map(site => (
              <option key={site._id} value={site._id}>{site.name}</option>
            ))}
          </select>
        </div>

      <div className="w-full max-w-full bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex-1 flex flex-col lg:flex-row transition-colors duration-200 min-h-0">
        {/* Conversations List */}
        <div className={`${selectedConversation ? 'hidden lg:flex' : 'flex'} w-full lg:w-80 xl:w-96 lg:max-w-md border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700 flex-col transition-colors duration-200 overflow-hidden`}>
          <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 transition-colors duration-200 flex-shrink-0">
            <div className="relative w-full">
              <Search className="absolute left-2.5 sm:left-3 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 dark:text-gray-500 transition-colors duration-200" />
              <input
                type="text"
                placeholder={t('conversations.searchPlaceholder')}
                className="w-full pl-8 sm:pl-9 pr-2 sm:pr-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
            {conversations.length === 0 ? (
              <div className="p-4 sm:p-6 text-center text-gray-500 dark:text-gray-400 transition-colors duration-200">
                <MessageCircle className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2 text-gray-400 dark:text-gray-500 transition-colors duration-200" />
                <p className="text-xs sm:text-sm">{t('conversations.noConversations')}</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv._id}
                  onClick={() => setSelectedConversation(conv)}
                  className={`p-2 sm:p-3 lg:p-4 border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 ${
                    selectedConversation?._id === conv._id ? 'bg-indigo-50 dark:bg-indigo-900' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-1.5 sm:mb-2 gap-2">
                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center transition-colors duration-200 flex-shrink-0">
                        <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-indigo-600 dark:text-indigo-400 transition-colors duration-200" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-xs sm:text-sm lg:text-base text-gray-900 dark:text-white transition-colors duration-200 truncate">{conv.visitorName}</p>
                        <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 transition-colors duration-200 truncate">{conv.currentPage}</p>
                      </div>
                    </div>
                    <span className={`px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs rounded-full flex-shrink-0 whitespace-nowrap ${getStatusColor(conv.status)}`}>
                      {conv.status}
                    </span>
                  </div>
                  {conv.lastMessage && (
                    <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-300 truncate transition-colors duration-200">{conv.lastMessage.content}</p>
                  )}
                  <p className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 mt-0.5 sm:mt-1 transition-colors duration-200">
                    {formatTime(conv.lastMessageAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        {selectedConversation ? (
          <div className="flex flex-1 flex-col w-full min-w-0 overflow-hidden min-h-0">
            {/* Chat Header */}
            <div className="p-2 sm:p-2.5 lg:p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-700 transition-colors duration-200 flex-shrink-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0 overflow-hidden">
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="lg:hidden p-1.5 sm:p-2 -ml-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors flex-shrink-0"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-200">
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-indigo-400 transition-colors duration-200" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white transition-colors duration-200 truncate">{selectedConversation.visitorName}</p>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 transition-colors duration-200 truncate">{selectedConversation.visitorEmail || 'E-posta yok'}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 ml-1.5 sm:ml-2">
                <button
                  onClick={() => deleteConversation(selectedConversation._id)}
                  className="p-1.5 sm:p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors duration-200"
                  title="Konuşmayı Sil"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <span className={`px-1.5 sm:px-2 lg:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs rounded-full whitespace-nowrap ${getStatusColor(selectedConversation.status)}`}>
                  {selectedConversation.status}
                </span>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-2.5 lg:p-3 xl:p-4 space-y-2 sm:space-y-2.5 lg:space-y-3 bg-gray-50 dark:bg-gray-900 transition-colors duration-200 min-h-0">
              {messages.map((message) => (
                <div
                  key={message._id}
                  className={`flex ${message.senderType === 'visitor' ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`max-w-[90%] sm:max-w-[80%] md:max-w-md lg:max-w-lg ${message.senderType === 'visitor' ? '' : 'order-2'}`}>
                    {message.senderType !== 'visitor' && (
                      <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mb-0.5 sm:mb-1 text-right transition-colors duration-200 truncate">{message.senderName}</p>
                    )}
                    <div
                      className={`px-2 sm:px-2.5 lg:px-3 py-1.5 sm:py-2 rounded-lg transition-colors duration-200 break-words overflow-wrap-anywhere ${
                        message.senderType === 'visitor'
                          ? 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white'
                          : message.senderType === 'bot'
                          ? 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                          : 'bg-indigo-600 text-white'
                      }`}
                    >
                      <p className="text-xs sm:text-sm">{message.content}</p>
                      
                      {/* File Attachment Display */}
                      {message.fileData && (message.messageType === 'file' || message.messageType === 'image') && (
                        <div className="mt-2">
                          {message.messageType === 'image' ? (
                            <img 
                              src={`http://localhost:5000${message.fileData.url}`}
                              alt={message.fileData.originalName}
                              className="max-w-full max-h-48 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => window.open(`http://localhost:5000${message.fileData.url}`, '_blank')}
                            />
                          ) : (
                            <div 
                              className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:opacity-90 transition-opacity ${
                                message.senderType === 'visitor' 
                                  ? 'bg-gray-100 dark:bg-gray-700' 
                                  : 'bg-white/20'
                              }`}
                              onClick={() => window.open(`http://localhost:5000${message.fileData.url}`, '_blank')}
                            >
                              <div className={`p-2 rounded ${
                                message.senderType === 'visitor'
                                  ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400'
                                  : 'bg-white/30 text-white'
                              }`}>
                                {getFileIcon(message.fileData.mimeType)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{message.fileData.originalName}</p>
                                <p className="text-[10px] opacity-75">{formatFileSize(message.fileData.size)}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
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
            <form onSubmit={handleSendMessage} className="p-2 sm:p-2.5 lg:p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 transition-colors duration-200 flex-shrink-0">
              {/* File Preview */}
              {selectedFile && (
                <div className="mb-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center gap-2">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 rounded">
                    {getFileIcon(selectedFile.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{selectedFile.name}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">{formatFileSize(selectedFile.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={clearFileSelection}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>
              )}
              
              <div className="flex gap-1.5 sm:gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2 py-1.5 sm:py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Dosya Ekle"
                >
                  <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={t('conversations.messagePlaceholder')}
                  className="flex-1 min-w-0 px-2 sm:px-2.5 lg:px-3 py-1.5 sm:py-2 lg:py-2.5 text-xs sm:text-sm lg:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() && !selectedFile}
                  className="px-2.5 sm:px-3 lg:px-4 py-1.5 sm:py-2 lg:py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 sm:gap-1.5 flex-shrink-0"
                >
                  <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5" />
                  <span className="hidden sm:inline text-xs sm:text-sm lg:text-base">{t('conversations.send')}</span>
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="hidden lg:flex flex-1 items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors duration-200 min-h-0">
            <div className="text-center text-gray-500 dark:text-gray-400 transition-colors duration-200 p-4">
              <MessageCircle className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 mx-auto mb-3 sm:mb-4 text-gray-400 dark:text-gray-500 transition-colors duration-200" />
              <p className="text-base sm:text-lg">{t('conversations.selectConversation')}</p>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
    </>
  );
};

export default Conversations;
