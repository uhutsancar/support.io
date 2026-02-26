import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { sitesAPI, conversationsAPI, departmentsAPI, teamAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { io } from 'socket.io-client';
import ConfirmDialog from '../components/ConfirmDialog';
import { Send, Search, MessageCircle, User, Clock, CheckCheck, Trash2, Paperclip, X, File, Image, FileText, UserPlus, Folder, Flag, UserCheck } from 'lucide-react';
const Conversations = () => {
  const { t } = useTranslation();
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState(null);
  const [activeTab, setActiveTab] = useState('inbox');
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [socket, setSocket] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, conversationId: null });
  const { user } = useAuth();
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    fetchSites();
    const token = localStorage.getItem('token');
    const socketUrl = import.meta.env.VITE_API_URL + '/admin';
    const newSocket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling']
    });
    newSocket.on('connect', () => {
    });
    newSocket.on('disconnect', () => {
    });
    setSocket(newSocket);
    return () => {
      newSocket.close();
    };
  }, []);
  useEffect(() => {
    if (!socket) return;
    const handleNewMessage = (data) => {
      const incomingConvId = String(data.message.conversationId);
      if (selectedConversation && incomingConvId === String(selectedConversation._id)) {
        setMessages(prev => {
          if (prev.some(msg => msg._id === data.message._id)) return prev;
          return [...prev, data.message];
        });
      } else {
        setConversations(prev => {
          let found = false;
          const next = prev.map(conv => {
            if (String(conv._id) === incomingConvId) {
              found = true;
              return { ...conv, lastMessage: data.message, lastMessageAt: new Date() };
            }
            return conv;
          }).sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
          if (!selectedConversation && user && user.role === 'agent' && found) {
            const conv = next.find(c => String(c._id) === incomingConvId);
            const assignedId = conv?.assignedAgent?._id || conv?.assignedAgent;
            if (assignedId && String(assignedId) === String(user._id)) {
              setSelectedConversation(conv);
              const derivedSiteId = (conv.siteId || conv.site?._id) || (selectedSite && (selectedSite._id || selectedSite));
              fetchConversationMessages(derivedSiteId, conv._id);
            }
          }
          return next;
        });
      }
      setConversations(prev =>
        prev.map(conv =>
          String(conv._id) === String(data.message.conversationId)
            ? { ...conv, lastMessage: data.message, lastMessageAt: new Date() }
            : conv
        ).sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))
      );
    };
    const handleNewConversation = (data) => {
      const convSiteId = data.conversation.siteId || data.conversation.site?._id;
      if (convSiteId && (!selectedSite || String(convSiteId) !== String(selectedSite._id || selectedSite))) {
        const newSite = sites.find(s => String(s._id) === String(convSiteId));
        if (newSite) {
          setSelectedSite(newSite);
        } else {
          fetchSites();
        }
      }
      if (selectedSite && String(convSiteId) === String(selectedSite._id || selectedSite)) {
        setConversations(prev => {
          if (prev.some(conv => conv._id === data.conversation._id)) {
            return prev;
          }
          return [data.conversation, ...prev];
        });
      }
    };
    const handleConversationUpdate = (data) => {
      if (selectedConversation && String(selectedConversation._id) === String(data.conversationId)) {
        setSelectedConversation(prev => ({
          ...prev,
          ...data.conversation,
          assignedAgent: data.conversation.assignedAgent || prev.assignedAgent,
          department: data.conversation.department || prev.department
        }));
      }
      setConversations(prev =>
        prev.map(conv =>
          conv._id === data.conversationId
            ? { ...conv, ...data.conversation }
            : conv
        )
      );
    };
    const handleSLABreach = (data) => {
      if (selectedConversation && selectedConversation._id === data.conversationId) {
        setSelectedConversation(prev => ({
          ...prev,
          sla: data.conversation.sla
        }));
      }
      setConversations(prev =>
        prev.map(conv =>
          conv._id === data.conversationId
            ? { ...conv, sla: data.conversation.sla }
            : conv
        )
      );
    };
    const handleConversationResolved = (data) => {
      if (selectedConversation && selectedConversation._id === data.conversationId) {
        setSelectedConversation(prev => ({
          ...prev,
          status: 'resolved',
          resolvedAt: data.conversation.resolvedAt
        }));
      }
      setConversations(prev =>
        prev.map(conv =>
          conv._id === data.conversationId
            ? { ...conv, status: 'resolved', resolvedAt: data.conversation.resolvedAt }
            : conv
        )
      );
    };
    const handleConversationAssigned = async (data) => {
      try {
        if (String(data.agentId) === String(user?._id) || String(data.agentId) === String(user?.id)) {
          try {
            const siteId = data.siteId || (selectedSite && (selectedSite._id || selectedSite));
            if (siteId) {
              const existingSite = sites.find(s => String(s._id) === String(siteId));
              if (existingSite) {
                setSelectedSite(existingSite);
              } else {
                try {
                  const siteResp = await sitesAPI.getOne(siteId);
                  if (siteResp?.data?.site) {
                    setSites(prev => {
                      if (prev.some(s => String(s._id) === String(siteId))) return prev;
                      return [siteResp.data.site, ...prev];
                    });
                    setSelectedSite(siteResp.data.site);
                  }
                } catch (se) {
                }
              }
              await fetchConversations(siteId);
              try {
                const resp = await conversationsAPI.getOne(siteId, data.conversationId);
                if (resp?.data?.conversation) {
                  setSelectedConversation(resp.data.conversation);
                  const msgs = Array.isArray(resp.data.messages) && resp.data.messages.length > 0
                    ? resp.data.messages
                    : (resp.data.conversation.lastMessage ? [resp.data.conversation.lastMessage] : []);
                  setMessages(msgs);
                  toast.success(t('conversations.assignedNotification') || 'Conversation assigned to you');
                }
              } catch (e) {
              }
            } else {
              if (selectedSite) {
                await fetchConversations(selectedSite._id || selectedSite);
                toast.success(t('conversations.assignedNotification') || 'Conversation assigned to you');
              }
            }
          } catch (innerErr) {
          }
        } else {
          setConversations(prev => prev.map(conv => conv._id === data.conversationId ? { ...conv, assignedAgent: data.agentId, status: 'assigned' } : conv));
        }
      } catch (err) {
      }
    };
    const handleConversationClaimed = async (data) => {
      try {
        if (String(data.agentId) === String(user?._id) || String(data.agentId) === String(user?.id)) {
          if (selectedSite) {
            await fetchConversations(selectedSite._id);
            toast.success(t('conversations.claimedNotification') || 'Conversation claimed');
          }
        } else {
          setConversations(prev => prev.map(conv => conv._id === data.conversationId ? { ...conv, assignedAgent: data.agentId, status: 'assigned' } : conv));
        }
      } catch (err) {
      }
    };
    socket.on('new-message', handleNewMessage);
    socket.on('new-conversation', handleNewConversation);
    socket.on('conversation-update', handleConversationUpdate);
    socket.on('sla-breach', handleSLABreach);
    socket.on('conversation-resolved', handleConversationResolved);
    socket.on('conversation-assigned', handleConversationAssigned);
    socket.on('conversation-claimed', handleConversationClaimed);
    const onGlobalAssigned = (e) => handleConversationAssigned(e.detail);
    const onGlobalClaimed = (e) => handleConversationClaimed(e.detail);
    const onGlobalNewMessage = (e) => handleNewMessage(e.detail);
    const onNavigateOpenConversation = async (e) => {
      try {
        const { conversationId, siteId } = e.detail || {};
        if (!conversationId) return;
        if (siteId) {
          const existingSite = sites.find(s => String(s._id) === String(siteId));
          if (existingSite) setSelectedSite(existingSite);
          else {
            try {
              const siteResp = await sitesAPI.getOne(siteId);
              if (siteResp?.data?.site) {
                setSites(prev => prev.some(s => String(s._id) === String(siteId)) ? prev : [siteResp.data.site, ...prev]);
                setSelectedSite(siteResp.data.site);
              }
            } catch (se) {
            }
          }
        }
        if (selectedSite) {
          await fetchConversationMessages(conversationId);
        } else {
          await fetchAssignedConversations();
          const conv = conversations.find(c => String(c._id) === String(conversationId));
          if (conv) {
            setSelectedConversation(conv);
            if (!messages || messages.length === 0) {
              setMessages(conv.lastMessage ? [conv.lastMessage] : []);
            }
          }
        }
      } catch (err) {
      }
    };
    const onNavigateSetTab = (e) => {
      try {
        const { tab } = e.detail || {};
        if (tab === 'assigned') {
          setActiveTab('assigned');
          fetchAssignedConversations();
        }
      } catch (err) {
      }
    };
    window.addEventListener('socket:conversation-assigned', onGlobalAssigned);
    window.addEventListener('socket:conversation-claimed', onGlobalClaimed);
    window.addEventListener('socket:new-message', onGlobalNewMessage);
    window.addEventListener('navigate:open-conversation', onNavigateOpenConversation);
    window.addEventListener('navigate:set-tab', onNavigateSetTab);
    return () => {
      socket.off('new-message', handleNewMessage);
      socket.off('new-conversation', handleNewConversation);
      socket.off('conversation-update', handleConversationUpdate);
      socket.off('sla-breach', handleSLABreach);
      socket.off('conversation-resolved', handleConversationResolved);
      socket.off('conversation-assigned', handleConversationAssigned);
      socket.off('conversation-claimed', handleConversationClaimed);
      window.removeEventListener('socket:conversation-assigned', onGlobalAssigned);
      window.removeEventListener('socket:conversation-claimed', onGlobalClaimed);
      window.removeEventListener('socket:new-message', onGlobalNewMessage);
      window.removeEventListener('navigate:open-conversation', onNavigateOpenConversation);
      window.removeEventListener('navigate:set-tab', onNavigateSetTab);
    };
  }, [socket, selectedConversation, selectedSite]);
  useEffect(() => {
    if (selectedSite && socket && user) {
      const siteId = selectedSite && (selectedSite._id || selectedSite);
      try {
        socket.emit('join-site', {
          siteId,
          userId: user._id
        });
      } catch (e) {
      }
      fetchConversations(siteId);
    }
    if (user && user.role === 'agent') {
      fetchAssignedConversations();
    }
  }, [selectedSite, socket, user]);
  useEffect(() => {
    const conversationId = searchParams.get('id');
    const tab = searchParams.get('tab');
    if (tab === 'assigned') {
      setActiveTab('assigned');
      fetchAssignedConversations();
      setSearchParams({});
      return;
    }
    if (conversationId && conversations.length > 0) {
      const conversation = conversations.find(conv => conv._id === conversationId);
      if (conversation && conversation._id !== selectedConversation?._id) {
        setSelectedConversation(conversation);
        setSearchParams({});
      }
    }
  }, [searchParams, conversations]);
  useEffect(() => {
    if (selectedConversation && socket) {
      socket.emit('join-conversation', {
        conversationId: selectedConversation._id
      });
      const derivedSiteId = (selectedConversation.siteId || selectedConversation.site?._id) || (selectedSite && (selectedSite._id || selectedSite));
      fetchConversationMessages(derivedSiteId, selectedConversation._id);
    }
  }, [selectedConversation, socket]);
  useEffect(() => {
    const id = setTimeout(() => scrollToBottom(), 50);
    return () => clearTimeout(id);
  }, [messages]);
  const fetchSites = async () => {
    try {
      const response = await sitesAPI.getAll();
      const siteList = response.data.sites || [];
      setSites(siteList);
      if (siteList.length > 0) {
        if (!selectedSite || !siteList.some(s => String(s._id) === String(selectedSite._id || selectedSite))) {
          setSelectedSite(siteList[0]);
        }
      } else {
        setSelectedSite(null);
        setConversations([]);
        setSelectedConversation(null);
      }
    } catch (error) {
    }
  };
  const fetchDepartments = async (siteId) => {
    try {
      const response = await departmentsAPI.getAll(siteId);
      setDepartments(response.data || []);
    } catch (error) {
    }
  };
  const fetchTeamMembers = async (siteId) => {
    try {
      const response = await teamAPI.getAll(siteId);
      setTeamMembers(response.data || []);
    } catch (error) {
    }
  };
  const fetchConversations = async (siteId) => {
    try {
      const response = await conversationsAPI.getAll(siteId);
      setConversations(response.data.conversations);
      fetchDepartments(siteId);
      fetchTeamMembers(siteId);
      if (socket) {
        socket.emit('join-site', { siteId, userId: user?._id });
      }
    } catch (error) {
      toast.error(t('dashboard.fetchError') + ': ' + (error.response?.data?.error || error.message));
    }
  };
  const fetchAssignedConversations = async () => {
    try {
      const resp = await conversationsAPI.getAssigned();
      if (resp && resp.data && Array.isArray(resp.data.conversations)) {
        setConversations(prev => {
          const map = new Map();
          resp.data.conversations.forEach(c => map.set(String(c._id), c));
          prev.forEach(c => {
            if (!map.has(String(c._id))) map.set(String(c._id), c);
          });
          return Array.from(map.values()).sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
        });
      }
    } catch (err) {
    }
  };
  const fetchConversationMessages = async (siteId, conversationId) => {
    try {
      const useSiteId = siteId || (selectedSite && (selectedSite._id || selectedSite)) || (selectedConversation && (selectedConversation.siteId || selectedConversation.site?._id));
      if (!useSiteId) {
        return;
      }
      const response = await conversationsAPI.getOne(useSiteId, conversationId);
      setSelectedConversation(response.data.conversation);
      const fetched = Array.isArray(response.data.messages) ? response.data.messages : [];
      if (fetched.length === 0 && response.data.conversation && response.data.conversation.lastMessage) {
        setMessages([response.data.conversation.lastMessage]);
      } else {
        setMessages(fetched);
      }
    } catch (error) {
      toast.error(t('dashboard.fetchMessagesError') + ': ' + (error.response?.data?.error || error.message));
    }
  };
  const deleteConversation = async () => {
    const { conversationId } = confirmDialog;
    try {
      await conversationsAPI.delete(selectedSite._id, conversationId);
      setConversations(prev => prev.filter(conv => conv._id !== conversationId));
      if (selectedConversation?._id === conversationId) {
        setSelectedConversation(null);
        setMessages([]);
      }
      toast.success(t('conversations.deleteSuccess'));
    } catch (error) {
      toast.error(t('conversations.deleteError') + ': ' + (error.response?.data?.error || error.message));
    }
  };
  const openDeleteConfirm = (conversationId) => {
    setConfirmDialog({ isOpen: true, conversationId });
  };
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedFile) || !socket || !selectedConversation) return;
    if (selectedFile) {
      await uploadAndSendFile();
    } else {
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
      toast.error(t('conversations.fileUploadError'));
    }
  };
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(t('conversations.fileTooLarge'));
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
    if (!date) return '-';
    return new Date(date).toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };
  const formatDateTime = (date) => {
    if (!date) return '-';
    const d = new Date(date);
    return `${d.toLocaleDateString('tr-TR')} ${formatTime(date)}`;
  };
  const formatMinutes = (minutes) => {
    if (minutes === null || minutes === undefined) return '-';
    if (minutes < 0) return 'Süre doldu';
    if (minutes === 0) return '0dk';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}s ${mins}dk`;
    }
    return `${mins}dk`;
  };
  const getSLAColor = (minutes) => {
    if (!minutes || minutes < 0) return 'text-red-600 dark:text-red-400';
    if (minutes < 5) return 'text-red-600 dark:text-red-400';
    if (minutes < 10) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };
  const handleStatusChange = async (newStatus) => {
    if (!selectedConversation) return;
    try {
      const response = await conversationsAPI.updateStatus(selectedConversation._id, newStatus);
      setSelectedConversation(response.data.conversation);
      setConversations(prev =>
        prev.map(conv =>
          conv._id === selectedConversation._id
            ? { ...conv, status: newStatus }
            : conv
        )
      );
      toast.success(t('conversations.statusChangeSuccess'));
    } catch (error) {
      toast.error(t('conversations.statusChangeError'));
    }
  };
  const handlePriorityChange = async (newPriority) => {
    if (!selectedConversation) return;
    try {
      const response = await conversationsAPI.updatePriority(selectedConversation._id, newPriority);
      setSelectedConversation(response.data.conversation);
      setConversations(prev =>
        prev.map(conv =>
          conv._id === selectedConversation._id
            ? { ...conv, priority: newPriority }
            : conv
        )
      );
      toast.success(t('conversations.priorityChangeSuccess'));
    } catch (error) {
      toast.error(t('conversations.priorityChangeError'));
    }
  };
  const getStatusColor = (status) => {
    const colors = {
      open: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
      unassigned: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
      assigned: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
      pending: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
      resolved: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
      closed: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
    };
    return colors[status] || colors.open;
  };
  const getPriorityColor = (priority) => {
    const colors = {
      low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
      normal: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400',
      high: 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-400',
      urgent: 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400'
    };
    return colors[priority] || colors.normal;
  };
  const handleClaimConversation = async (conversationId) => {
    try {
      await conversationsAPI.claim(conversationId);
      if (selectedSite) {
        fetchConversations(selectedSite._id);
      }
      toast.success(t('conversations.assignedToYou'));
    } catch (error) {
      toast.error(error.response?.data?.error || t('conversations.claimError'));
    }
  };
  const handleAssignConversation = async (conversationId, agentId) => {
    try {
      const response = await conversationsAPI.assign(conversationId, agentId || null, user?._id || user?.id);
      if (selectedConversation && selectedConversation._id === conversationId) {
        setSelectedConversation(response.data.conversation);
      }
      if (selectedSite) {
        fetchConversations(selectedSite._id);
      }
      toast.success(t('conversations.assignSuccess'));
    } catch (error) {
      toast.error(t('conversations.assignError'));
    }
  };
  const handleSetDepartment = async (conversationId, departmentId) => {
    try {
      const response = await conversationsAPI.setDepartment(conversationId, departmentId || null);
      if (selectedConversation && selectedConversation._id === conversationId) {
        setSelectedConversation(response.data.conversation);
      }
      if (selectedSite) {
        fetchConversations(selectedSite._id);
      }
      toast.success(t('conversations.departmentChangeSuccess'));
    } catch (error) {
      toast.error(t('conversations.departmentChangeError'));
    }
  };
  const handleSetPriority = async (conversationId, priority) => {
    try {
      await conversationsAPI.setPriority(conversationId, priority);
      if (selectedSite) {
        fetchConversations(selectedSite._id);
      }
      toast.success(t('conversations.priorityChangeSuccess'));
    } catch (error) {
      toast.error(t('conversations.priorityChangeError'));
    }
  };
  const filteredConversations = conversations.filter(conv => {
    const matchesStatus = statusFilter === 'all' || conv.status === statusFilter;
    const matchesDepartment = departmentFilter === 'all' || conv.department?._id === departmentFilter;
    return matchesStatus && matchesDepartment;
  });
  return (
    <>
      <Helmet>
        <title>{`${t('conversations.title') || ''} - Support.io Admin`}</title>
        <meta name="description" content={t('conversations.subtitle')} />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="w-full h-full max-w-full overflow-hidden">
        <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 xl:px-8 h-screen max-h-screen overflow-hidden flex flex-col py-2 sm:py-4">
          {sites.length === 0 && (
            <div className="p-4 mb-4 border border-yellow-400 bg-yellow-50 text-yellow-600 rounded">
              {t('conversations.noSitesNotice') || 'You don\'t have any sites yet. Please add a site to start receiving conversations.'}
            </div>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 mb-2 sm:mb-3 lg:mb-4 flex-shrink-0">
            <div className="min-w-0 flex-shrink-1">
              <h1 className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-gray-900 dark:text-white transition-colors duration-200 truncate">{t('conversations.title')}</h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-0.5 sm:mt-1 transition-colors duration-200 truncate">{t('conversations.subtitle')}</p>
            </div>
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
              <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 modal-scrollbar pr-2">
                {filteredConversations.length === 0 ? (
                  <div className="p-4 sm:p-6 text-center text-gray-500 dark:text-gray-400 transition-colors duration-200">
                    <MessageCircle className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2 text-gray-400 dark:text-gray-500 transition-colors duration-200" />
                    <p className="text-xs sm:text-sm">{conversations.length === 0 ? t('conversations.noConversations') : t('conversations.noMatchFilter', 'Filtre kriterlerine uygun konuşma bulunamadı')}</p>
                  </div>
                ) : (
                  filteredConversations.map((conv) => (
                    <div
                      key={conv._id}
                      onClick={() => setSelectedConversation(conv)}
                      className={`p-2 sm:p-3 lg:p-4 border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 ${selectedConversation?._id === conv._id ? 'bg-indigo-50 dark:bg-indigo-900' : ''
                        }`}
                    >
                      <div className="flex items-start justify-between mb-1.5 sm:mb-2 gap-2 min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center transition-colors duration-200 flex-shrink-0">
                            <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-indigo-600 dark:text-indigo-400 transition-colors duration-200" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                              <p className="font-medium text-xs sm:text-sm lg:text-base text-gray-900 dark:text-white transition-colors duration-200 truncate flex-1 min-w-0">
                                {conv.ticketId || `#${conv.ticketNumber}`}
                              </p>
                              <span className={`px-1.5 py-0.5 text-[9px] sm:text-[10px] rounded ${getPriorityColor(conv.priority)} flex-shrink-0`}>
                                {conv.priority === 'urgent' ? t('conversations.priorities.urgent', 'Acil') : conv.priority === 'high' ? t('conversations.priorities.high', 'Yüksek') : conv.priority === 'normal' ? t('conversations.priorities.normal', 'Normal') : t('conversations.priorities.low', 'Düşük')}
                              </span>
                            </div>
                            <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-300 truncate">{conv.visitorName}</p>
                            <p className="text-[9px] sm:text-[10px] text-gray-500 dark:text-gray-400 transition-colors duration-200 truncate">{conv.currentPage}</p>
                          </div>
                        </div>
                        <span className={`px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs rounded-full flex-shrink-0 whitespace-nowrap ${getStatusColor(conv.status)}`}>
                          {conv.status === 'open' ? t('conversations.statuses.open', 'Açık') : conv.status === 'assigned' ? t('conversations.statuses.assigned', 'Atandı') : conv.status === 'pending' ? t('conversations.statuses.pending', 'Bekliyor') : conv.status === 'resolved' ? t('conversations.statuses.resolved', 'Çözüldü') : t('conversations.statuses.closed', 'Kapalı')}
                        </span>
                      </div>
                      {conv.assignedAgent && (
                        <div className="mb-1.5 flex items-center gap-1.5">
                          <UserCheck className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                          <span className="text-[9px] sm:text-[10px] text-blue-600 dark:text-blue-400 font-medium truncate">
                            {conv.assignedAgent.name}
                          </span>
                        </div>
                      )}
                      {conv.sla && (
                        <div className="mb-1.5 flex items-center gap-2">
                          {(conv.sla.firstResponseStatus === 'breached' ||
                            (conv.sla.firstResponseTimeRemaining !== null && conv.sla.firstResponseTimeRemaining < 0)) ? (
                            <span className="text-[9px] sm:text-[10px] text-red-600 dark:text-red-400 font-medium flex items-center gap-1 animate-pulse">
                              <Clock className="w-3 h-3" />
                              {t('conversations.slaBreach', 'SLA İhlali')}
                            </span>
                          ) : conv.sla.firstResponseTimeRemaining !== null && conv.sla.firstResponseTimeRemaining >= 0 ? (
                            <span className={`text-[9px] sm:text-[10px] font-medium flex items-center gap-1 ${getSLAColor(conv.sla.firstResponseTimeRemaining)}`}>
                              <Clock className="w-3 h-3" />
                              {formatMinutes(conv.sla.firstResponseTimeRemaining)} {t('conversations.remaining', 'kaldı')}
                            </span>
                          ) : conv.sla.firstResponseStatus === 'met' ? (
                            <span className="text-[9px] sm:text-[10px] text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              ✓ {t('conversations.responded', 'Yanıtlandı')}
                            </span>
                          ) : null}
                        </div>
                      )}
                      {conv.lastMessage && (
                        <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-300 truncate transition-colors duration-200">{conv.lastMessage.content}</p>
                      )}
                      <p className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 mt-0.5 sm:mt-1 transition-colors duration-200">
                        {formatTime(conv.lastMessageAt || conv.createdAt)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
            {selectedConversation ? (
              <div className="flex flex-1 flex-col w-full min-w-0 overflow-hidden min-h-0">
                <div className="p-2 sm:p-2.5 lg:p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 transition-colors duration-200 flex-shrink-0">
                  <div className="flex items-center justify-between mb-2">
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
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 transition-colors duration-200 truncate">{selectedConversation.visitorEmail || t('conversations.noEmail')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 ml-1.5 sm:ml-2">
                      <select
                        value={selectedConversation.priority}
                        onChange={(e) => handlePriorityChange(e.target.value)}
                        className={`px-2 py-1 text-[10px] sm:text-xs rounded cursor-pointer border-0 font-medium ${getPriorityColor(selectedConversation.priority)}`}
                      >
                        <option value="low">{t('conversations.priorities.low', 'Düşük')}</option>
                        <option value="normal">{t('conversations.priorities.normal', 'Orta')}</option>
                        <option value="high">{t('conversations.priorities.high', 'Yüksek')}</option>
                        <option value="urgent">{t('conversations.priorities.urgent', 'Acil')}</option>
                      </select>
                      <select
                        value={selectedConversation.status}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        className={`px-2 py-1 text-[10px] sm:text-xs rounded cursor-pointer border-0 font-medium whitespace-nowrap ${getStatusColor(selectedConversation.status)}`}
                      >
                        <option value="open">{t('conversations.statuses.open', 'Açık')}</option>
                        <option value="assigned">{t('conversations.statuses.assigned', 'Atandı')}</option>
                        <option value="pending">{t('conversations.statuses.pending', 'Beklemede')}</option>
                        <option value="resolved">{t('conversations.statuses.resolved', 'Çözüldü')}</option>
                        <option value="closed">{t('conversations.statuses.closed', 'Kapalı')}</option>
                      </select>
                      <button
                        onClick={() => openDeleteConfirm(selectedConversation._id)}
                        className="p-1.5 sm:p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors duration-200"
                        title={t('conversations.deleteConversationTooltip')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1">
                      <Folder className="w-3 h-3 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                      <select
                        value={selectedConversation.department?._id || ''}
                        onChange={(e) => handleSetDepartment(selectedConversation._id, e.target.value || null)}
                        className="px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300"
                      >
                        <option value="">{t('conversations.selectDepartment', 'Departman Seçiniz')}</option>
                        {departments.map(dept => (
                          <option key={dept._id} value={dept._id}>
                            {dept.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-1">
                      <UserCheck className="w-3 h-3 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                      <select
                        value={selectedConversation.assignedAgent?._id || ''}
                        onChange={(e) => handleAssignConversation(selectedConversation._id, e.target.value || null)}
                        className="px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300"
                      >
                        <option value="">{t('conversations.unassigned', 'Atanmamış')}</option>
                        {teamMembers.map(member => (
                          <option key={member._id} value={member._id}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-2.5 lg:p-3 xl:p-4 space-y-2 sm:space-y-2.5 lg:space-y-3 bg-gray-50 dark:bg-gray-900 transition-colors duration-200 min-h-0 modal-scrollbar pr-2 relative">
                  {selectedConversation.status === 'open' && !selectedConversation.assignedAgent && (
                    <div className="absolute inset-0 z-20 bg-gray-50/90 dark:bg-gray-900/90 backdrop-blur-sm flex flex-col items-center justify-center p-6">
                      <div className="bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 rounded-2xl p-8 max-w-sm text-center transform transition-all hover:scale-[1.02]">
                        <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4">
                          <UserCheck className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('conversations.claimTitle', 'Talebi Üzerinize Alın')}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                          {t('conversations.claimDesc', 'Bu müşteriye yanıt verebilmek ve konuşma geçmişine erişebilmek için talebi üstlenmeniz gerekmektedir.')}
                        </p>
                        {selectedConversation.lastMessage && (
                          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl text-left border border-gray-100 dark:border-gray-700 mb-6">
                            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 block mb-1">{t('conversations.claimSummaryLabel', 'Müşteri Talebi Özeti:')}</span>
                            <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-3 italic">
                              "{selectedConversation.lastMessage.content}"
                            </p>
                          </div>
                        )}
                        <button
                          onClick={() => handleClaimConversation(selectedConversation._id)}
                          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex justify-center items-center gap-2"
                        >
                          <CheckCheck className="w-5 h-5" />
                          {t('conversations.claimButton', 'Talebi Üzerime Al')}
                        </button>
                      </div>
                    </div>
                  )}
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
                          className={`px-2 sm:px-2.5 lg:px-3 py-1.5 sm:py-2 rounded-lg transition-colors duration-200 break-words overflow-wrap-anywhere ${message.senderType === 'visitor'
                            ? 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white'
                            : message.senderType === 'bot'
                              ? 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                              : 'bg-indigo-600 text-white'
                            }`}
                        >
                          <p className="text-xs sm:text-sm">{message.content}</p>
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
                                  className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:opacity-90 transition-opacity ${message.senderType === 'visitor'
                                    ? 'bg-gray-100 dark:bg-gray-700'
                                    : 'bg-white/20'
                                    }`}
                                  onClick={() => window.open(`http://localhost:5000${message.fileData.url}`, '_blank')}
                                >
                                  <div className={`p-2 rounded ${message.senderType === 'visitor'
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
                <form onSubmit={handleSendMessage} className={`p-2 sm:p-2.5 lg:p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 transition-colors duration-200 flex-shrink-0 ${selectedConversation.status === 'open' && !selectedConversation.assignedAgent ? 'opacity-50 pointer-events-none' : ''}`}>
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
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          onClose={() => setConfirmDialog({ isOpen: false, conversationId: null })}
          onConfirm={deleteConversation}
          title={t('conversations.deleteTitle')}
          message={t('conversations.deleteMessage')}
          confirmText={t('conversations.deleteConfirm')}
          cancelText={t('common.cancel')}
          type="danger"
        />
      </div>
    </>
  );
};
export default Conversations;
