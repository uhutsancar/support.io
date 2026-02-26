
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { teamChatAPI } from '../services/api';
import { io } from 'socket.io-client';
import {
  Send, Search, Users, MessageSquare, Plus,
  Hash, User, Circle, X, UserPlus, ChevronLeft, Trash2
} from 'lucide-react';
import ConfirmDialog from '../components/ConfirmDialog';
const TeamChatPage = () => {
  const loadChats = async () => {
    try {
      const res = await teamChatAPI.getChats();
      setChats(res.data);
    } catch (err) {
    }
  };
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, messageId: null });
  const handleDeleteMessage = async () => {
    if (!confirmDialog.messageId) return;
    try {
      await teamChatAPI.deleteMessage(confirmDialog.messageId);
      setMessages(prev => prev.filter(m => m._id !== confirmDialog.messageId));
    } catch (err) {
    }
    setConfirmDialog({ isOpen: false, messageId: null });
  };
  const { t } = useTranslation();
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [chats, setChats] = useState([]);
  const [members, setMembers] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [search, setSearch] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [typingUser, setTypingUser] = useState(null);
  const [mobileView, setMobileView] = useState('list');
  const messagesEndRef = useRef(null);
  const typingTimeout = useRef(null);
  useEffect(() => {
    const socketUrl = import.meta.env.VITE_API_URL + '/admin';
    const newSocket = io(socketUrl, {
      auth: { token: localStorage.getItem('token') },
      transports: ['websocket', 'polling']
    });
    newSocket.on('connect', () => {
      if (user?._id) {
        newSocket.emit('join-site', { userId: user._id });
      }
    });
    if (user?._id) {
      newSocket.emit('join-site', { userId: user._id });
    } else if (user?.id) {
      newSocket.emit('join-site', { userId: user.id });
    }
    newSocket.on('team-chat-message', (data) => {
      setMessages(prev => {
        if (prev.some(m => m._id === data.message._id)) return prev;
        return [...prev, data.message];
      });
      setChats(prev => prev.map(c =>
        c.chatId === data.message.chatId
          ? { ...c, lastMessage: { content: data.message.content, senderName: data.message.senderName, createdAt: data.message.createdAt } }
          : c
      ).sort((a, b) => new Date(b.lastMessage?.createdAt || b.updatedAt) - new Date(a.lastMessage?.createdAt || a.updatedAt)));
    });
    newSocket.on('team-chat-user-typing', (data) => {
      setTypingUser(data.userName);
      setTimeout(() => setTypingUser(null), 2000);
    });
    setSocket(newSocket);
    return () => newSocket.close();
  }, [user]);
  useEffect(() => {
    loadChats();
    loadMembers();
  }, []);
  const loadMembers = async () => {
    try {
      const res = await teamChatAPI.getMembers();
      setMembers(res.data);
    } catch (err) {
    }
  };
  const loadMessages = async (chatId) => {
    try {
      const res = await teamChatAPI.getMessages(chatId);
      setMessages(res.data);
    } catch (err) {
    }
  };
  const startDirectChat = async (targetUser) => {
    try {
      const res = await teamChatAPI.createDirect(targetUser._id || targetUser.id);
      const chat = res.data;
      setChats(prev => {
        if (prev.some(c => c.chatId === chat.chatId)) return prev;
        return [chat, ...prev];
      });
      setActiveChat(chat);
      setShowNewChat(false);
      setMobileView('chat');
    } catch (err) {
    }
  };
  const createGroupChat = async () => {
    if (!groupName.trim() || selectedMembers.length === 0) return;
    try {
      const res = await teamChatAPI.createGroup(groupName, selectedMembers);
      setChats(prev => [res.data, ...prev]);
      setActiveChat(res.data);
      setShowNewGroup(false);
      setGroupName('');
      setSelectedMembers([]);
      setMobileView('chat');
    } catch (err) {
    }
  };
  const sendMessage = () => {
    if (!newMessage.trim() || !socket || !activeChat) return;
    socket.emit('team-chat-send', {
      chatId: activeChat.chatId,
      content: newMessage.trim(),
      chatType: activeChat.chatType
    });
    setNewMessage('');
  };
  useEffect(() => {
    if (!socket) return;
    let prevChatId = null;
    if (activeChat?.chatId) {
      const chatId = activeChat.chatId;
      if (prevChatId && prevChatId !== chatId) {
        socket.emit('team-chat-leave', { chatId: prevChatId });
      }
      socket.emit('team-chat-join', { chatId });
      prevChatId = chatId;
      loadMessages(chatId);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    }
    return () => {
      if (activeChat?.chatId) socket.emit('team-chat-leave', { chatId: activeChat.chatId });
    };
  }, [activeChat, socket]);
  const handleTyping = () => {
    if (!socket || !activeChat) return;
    socket.emit('team-chat-typing', { chatId: activeChat.chatId, userName: user?.name });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => { }, 2000);
  };
  const getChatName = (chat) => {
    if (!chat) return '';
    if (chat.chatType === 'group') return chat.groupName || 'Group';
    const currentUserId = user?._id || user?.id;
    const other = chat.participants?.find(p => p && p._id !== currentUserId);
    return other?.name || (chat.name || 'Unknown');
  };
  const getChatStatus = (chat) => {
    if (chat.chatType === 'group') return null;
    const currentUserId = user?._id || user?.id;
    const other = chat.participants?.find(p => p && p._id !== currentUserId);
    return other?.status;
  };
  const getChatAvatar = (chat) => {
    if (chat.chatType === 'group') return null;
    const currentUserId = user?._id || user?.id;
    const other = chat.participants?.find(p => p && p._id !== currentUserId);
    return other?.name?.charAt(0).toUpperCase() || '?';
  };
  const filteredChats = useMemo(() => {
    if (!search) return chats || [];
    const q = search.toLowerCase();
    return (chats || []).filter(c => getChatName(c).toLowerCase().includes(q));
  }, [chats, search]);
  const otherMembers = useMemo(() => {
    const currentUserId = user?._id || user?.id;
    return (members || []).filter(m => m && m._id !== currentUserId);
  }, [members, user]);
  const statusColor = (status) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'busy': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };
  const statusText = (status) => {
    switch (status) {
      case 'online': return t('teamChat.online') || 'Online';
      case 'away': return t('teamChat.away') || 'Away';
      case 'busy': return t('teamChat.busy') || 'Busy';
      default: return t('teamChat.offline') || 'Offline';
    }
  };
  const formatTime = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    if (diff < 86400000 && d.getDate() === now.getDate()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (diff < 172800000) return t('teamChat.yesterday') || 'Yesterday';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };
  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col">
      <Helmet><title>{`${t('teamChat.title') || ''} - DestekChat`}</title></Helmet>
      { }
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('teamChat.title')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('teamChat.subtitle')}</p>
      </div>
      { }
      <div className="flex-1 flex bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden min-h-0">
        { }
        <div className={`w-full md:w-80 lg:w-96 border-r border-gray-200 dark:border-gray-700 flex flex-col ${mobileView !== 'list' ? 'hidden md:flex' : 'flex'}`}>
          { }
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 space-y-2">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={t('teamChat.searchChats')}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={() => { setShowNewChat(true); setShowNewGroup(false); }}
                className="p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition"
                title={t('teamChat.newChat')}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => { setShowNewChat(true); setShowNewGroup(false); }}
                className="flex-1 text-xs py-1.5 px-2 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition flex items-center justify-center gap-1"
              >
                <User className="w-3 h-3" /> {t('teamChat.directMessage')}
              </button>
              <button
                onClick={() => { setShowNewGroup(true); setShowNewChat(false); }}
                className="flex-1 text-xs py-1.5 px-2 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition flex items-center justify-center gap-1"
              >
                <Users className="w-3 h-3" /> {t('teamChat.newGroup')}
              </button>
            </div>
          </div>
          { }
          {showNewChat && (
            <div className="border-b border-gray-700 bg-gray-800 p-3 space-y-3 rounded-md shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-100">{t('teamChat.selectMember')}</span>
                <button onClick={() => setShowNewChat(false)} className="text-gray-400 hover:text-gray-200"><X className="w-4 h-4" /></button>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1 modal-scrollbar pr-2">
                {otherMembers.map(m => (
                  <button
                    key={m._id}
                    onClick={() => startDirectChat(m)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-700 transition-colors text-left"
                  >
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-semibold text-white">
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-gray-800 ${statusColor(m.status)}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-100 truncate">{m.name}</p>
                      <p className="text-xs text-gray-400">{m.role} · {statusText(m.status)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          { }
          {showNewGroup && (
            <div className="border-b border-gray-700 bg-gray-800 p-3 space-y-3 rounded-md shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-100">{t('teamChat.createGroup')}</span>
                <button onClick={() => { setShowNewGroup(false); setSelectedMembers([]); setGroupName(''); }} className="text-gray-400 hover:text-gray-200"><X className="w-4 h-4" /></button>
              </div>
              <input
                type="text"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                placeholder={t('teamChat.groupNamePlaceholder')}
                className="w-full px-3 py-2 text-sm rounded-md border border-gray-700 bg-gray-900 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="max-h-36 overflow-y-auto space-y-1 modal-scrollbar pr-2">
                {otherMembers.map(m => (
                  <label key={m._id} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedMembers.includes(m._id)}
                      onChange={e => {
                        if (e.target.checked) setSelectedMembers(prev => [...prev, m._id]);
                        else setSelectedMembers(prev => prev.filter(id => id !== m._id));
                      }}
                      className="rounded border-gray-600 text-indigo-400 focus:ring-indigo-500"
                    />
                    <div className="flex-1">
                      <p className="text-sm text-gray-100">{m.name}</p>
                      <p className="text-xs text-gray-400">{m.role}</p>
                    </div>
                  </label>
                ))}
              </div>
              <button
                onClick={createGroupChat}
                disabled={!groupName.trim() || selectedMembers.length === 0}
                className="w-full py-2 text-sm rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 text-white hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {t('teamChat.createGroupBtn')} ({selectedMembers.length})
              </button>
            </div>
          )}
          { }
          <div className="flex-1 overflow-y-auto modal-scrollbar pr-2">
            {filteredChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 p-6">
                <MessageSquare className="w-12 h-12 mb-2 opacity-50" />
                <p className="text-sm">{t('teamChat.noChats')}</p>
              </div>
            ) : (
              filteredChats.map(chat => (
                <button
                  key={chat.chatId}
                  onClick={() => { setActiveChat(chat); setMobileView('chat'); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition text-left ${activeChat?.chatId === chat.chatId ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-2 border-l-indigo-500' : ''
                    }`}
                >
                  <div className="relative flex-shrink-0">
                    {chat.chatType === 'group' ? (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <Users className="w-5 h-5 text-white" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                        {getChatAvatar(chat)}
                      </div>
                    )}
                    {getChatStatus(chat) && (
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${statusColor(getChatStatus(chat))}`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{getChatName(chat)}</p>
                      <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{formatTime(chat.lastMessage?.createdAt || chat.updatedAt)}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                      {chat.lastMessage
                        ? `${chat.lastMessage.senderName?.split(' ')[0]}: ${chat.lastMessage.content}`
                        : t('teamChat.noMessages')
                      }
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
        { }
        <div className={`flex-1 flex flex-col min-w-0 ${mobileView !== 'chat' ? 'hidden md:flex' : 'flex'}`}>
          {activeChat ? (
            <>
              { }
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
                <button onClick={() => setMobileView('list')} className="md:hidden text-gray-500">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                {activeChat.chatType === 'group' ? (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <Users className="w-4 h-4 text-white" />
                  </div>
                ) : (
                  <div className="relative flex-shrink-0">
                    <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                      {getChatAvatar(activeChat)}
                    </div>
                    {getChatStatus(activeChat) && (
                      <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-800 ${statusColor(getChatStatus(activeChat))}`} />
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{getChatName(activeChat)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {activeChat.chatType === 'group'
                      ? `${activeChat.participants?.length || 0} ${t('teamChat.members')}`
                      : statusText(getChatStatus(activeChat))
                    }
                  </p>
                </div>
                {activeChat.chatType === 'group' && (
                  <button
                    onClick={() => setMobileView(mobileView === 'members' ? 'chat' : 'members')}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 md:hidden"
                  >
                    <Users className="w-4 h-4" />
                  </button>
                )}
              </div>
              { }
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-900/50 modal-scrollbar pr-2">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <MessageSquare className="w-10 h-10 mb-2 opacity-40" />
                    <p className="text-sm">{t('teamChat.startConversation')}</p>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const currentUserId = user?._id || user?.id;
                    const isMe = msg.senderId === currentUserId;
                    const showAvatar = !isMe && (idx === 0 || messages[idx - 1]?.senderId !== msg.senderId);
                    return (
                      <div key={msg._id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex gap-2 max-w-[75%] ${isMe ? 'flex-row-reverse' : ''}`}>
                          {!isMe && (
                            <div className="flex-shrink-0 mt-auto">
                              {showAvatar ? (
                                <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                                  {msg.senderName?.charAt(0).toUpperCase()}
                                </div>
                              ) : <div className="w-7" />}
                            </div>
                          )}
                          <div>
                            {showAvatar && !isMe && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 ml-1">{msg.senderName}</p>
                            )}
                            <div className={`px-3 py-2 rounded-2xl text-sm ${isMe
                                ? 'bg-indigo-600 text-white rounded-br-md'
                                : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-bl-md'
                              }`}>
                              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                            </div>
                            <p className={`text-[10px] text-gray-400 mt-0.5 ${isMe ? 'text-right mr-1' : 'ml-1'}`}>
                              {formatTime(msg.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                {typingUser && (
                  <div className="flex items-center gap-2 text-gray-400 text-xs">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span>{typingUser} {t('teamChat.isTyping')}</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              { }
              <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={e => { setNewMessage(e.target.value); handleTyping(); }}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder={t('teamChat.typeMessage')}
                    className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim()}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
              <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
                <MessageSquare className="w-10 h-10 opacity-50" />
              </div>
              <p className="text-lg font-medium text-gray-600 dark:text-gray-300">{t('teamChat.selectChat')}</p>
              <p className="text-sm mt-1">{t('teamChat.selectChatDesc')}</p>
            </div>
          )}
        </div>
        { }
        <div className={`w-64 border-l border-gray-200 dark:border-gray-700 flex-col bg-white dark:bg-gray-800 ${activeChat?.chatType === 'group'
            ? (mobileView === 'members' ? 'flex' : 'hidden lg:flex')
            : 'hidden lg:flex'
          }`}>
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('teamChat.teamMembers')}</h3>
            <button onClick={() => setMobileView('chat')} className="lg:hidden text-gray-400">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 modal-scrollbar pr-2">
            { }
            {['online', 'away', 'busy', 'offline'].map(status => {
              const statusMembers = members.filter(m => (m.status || 'offline') === status);
              if (statusMembers.length === 0) return null;
              return (
                <div key={status} className="mb-3">
                  <p className="text-[10px] uppercase font-semibold text-gray-400 px-2 mb-1 tracking-wider">
                    {statusText(status)} — {statusMembers.length}
                  </p>
                  {statusMembers.map(m => (
                    <button
                      key={m._id}
                      onClick={() => { if (m._id !== (user?._id || user?.id)) startDirectChat(m); }}
                      disabled={m._id === (user?._id || user?.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition text-left disabled:opacity-60 disabled:cursor-default"
                    >
                      <div className="relative">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-xs font-medium text-indigo-600 dark:text-indigo-400">
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-800 ${statusColor(m.status)}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                          {m.name} {m._id === (user?._id || user?.id) && <span className="text-gray-400">({t('teamChat.you')})</span>}
                        </p>
                        <p className="text-[10px] text-gray-400">{m.role}</p>
                      </div>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      { }
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, messageId: null })}
        onConfirm={handleDeleteMessage}
        title={t('teamChat.deleteTitle') || 'Mesajı Sil'}
        message={t('teamChat.deleteMessage') || 'Bu mesajı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.'}
        confirmText={t('teamChat.deleteConfirm') || 'Evet, Sil'}
        cancelText={t('common.cancel') || 'İptal'}
        type="danger"
      />
    </div>
  );
};
export default TeamChatPage;
