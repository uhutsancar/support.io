// Dosya yukleme ve ek gorselleri ayni backend'den gelir. Sabit yazilirsa
// dagitilan panel kullanicinin kendi makinesine istek atmaya calisir.
// Temsilci cevrimici degilken autoAssignment konusmayi 'unassigned' yapar.
// Bu deger etiket zincirinde yoktu ve son else'e dusup "Kapali" goruntuluyordu.
import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { aiAPI, sitesAPI, conversationsAPI, departmentsAPI, teamAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { API_BASE_URL } from '../lib/runtime';
import ConfirmDialog from '../components/ConfirmDialog';
import AIAssistant from '../components/AIAssistant';
import {
  Bot,
  CheckCheck,
  Clock,
  ExternalLink,
  Folder,
  Globe2,
  Mail,
  MessageCircle,
  Paperclip,
  Search,
  Send,
  ShieldCheck,
  StickyNote,
  Tag,
  Trash2,
  User,
  UserCheck,
  X
} from 'lucide-react';
import type { Conversation, Department, Message, Site, TeamMember } from '../types/api';
import { formatDateTime, formatFileSize } from '../lib/format';
import {
  conversationStatusBadge as getStatusColor,
  priorityBadge as getPriorityColor
} from '../lib/statusStyles';
import { useInboxNavigation, useInboxRealtime } from '../features/conversations/useInboxRealtime';
import { errorMessage } from '../hooks/useAsync';
import ConversationListItem from '../components/conversations/ConversationListItem';
import MessageBubble, { attachmentIcon } from '../components/conversations/MessageBubble';

const STATUS_LABELS = {
  open: ['conversations.statuses.open', 'Açık'],
  unassigned: ['conversations.unassigned', 'Atanmamış'],
  assigned: ['conversations.statuses.assigned', 'Atandı'],
  pending: ['conversations.statuses.pending', 'Bekliyor'],
  resolved: ['conversations.statuses.resolved', 'Çözüldü'],
  closed: ['conversations.statuses.closed', 'Kapalı']
};

// Henuz kimseye atanmamis konusma: hem 'open' hem 'unassigned' bu anlama gelir.
const isUnclaimed = (c: Conversation | null | undefined): boolean =>
  !c?.assignedAgent && (c?.status === 'open' || c?.status === 'unassigned');

/** Newest activity first, the order the inbox is always sorted in. */
const byMostRecent = (a: Conversation, b: Conversation): number =>
  new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime();
const Conversations = () => {
  const { t } = useTranslation();
  const statusLabel = (status: string) => {
    const entry = STATUS_LABELS[status as keyof typeof STATUS_LABELS] || STATUS_LABELS.closed;
    return t(entry[0], entry[1]);
  };
  /** The selected site's id, whichever shape the selection was stored in. */
  const siteIdOf = (site: Site | string | null | undefined): string =>
    !site ? '' : typeof site === 'string' ? site : site._id;

  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { socket } = useSocket();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  // Arama sunucuda calisir, bu yuzden her tusa basista istek atilmaz.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [note, setNote] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    conversationId: string | null;
  }>({
    isOpen: false,
    conversationId: null
  });
  const { user } = useAuth();
  // Sunucudaki kuralların aynısı (backend/src/middleware/rbac.ts):
  //   assign_tickets     owner, admin, manager — herkese atayabilir
  //   manage_operations  owner, admin — konuşmayı kalıcı olarak silebilir
  // Bu izinleri olmayan bir temsilci yalnızca atanmamış bir konuşmayı kendine
  // alabilir ya da kendi konuşmasını bırakabilir. Panel yapılamayacak bir
  // seçeneği göstermez; asıl kontrol her durumda sunucuda.
  const canAssignAnyone = ['owner', 'admin', 'manager'].includes(user?.role || '');
  const canDeleteConversations = ['owner', 'admin'].includes(user?.role || '');
  const selfId = String(user?._id || user?.id || '');
  // The realtime handlers need the current selection but must not be
  // re-attached every time it changes, so they read it through a ref. Written
  // in an effect rather than during render; see hooks/useAsync.ts.
  const selectedConversationRef = useRef<Conversation | null>(selectedConversation);
  const selectedSiteRef = useRef<Site | null>(selectedSite);
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
    selectedSiteRef.current = selectedSite;
  });

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    fetchSites();
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);
  // Live updates. The seven socket listeners and the two window listeners that
  // used to be written out here now live in features/conversations — see that
  // file for why their old shape kept reading stale state.
  useInboxRealtime({
    socket,
    currentUserId: selfId || null,

    onMessage: (message) => {
      const conversationId = String(message.conversationId);

      // Into the open thread if it is the one on screen, de-duplicated because
      // the sender also receives its own broadcast.
      setMessages((current) =>
        selectedConversationRef.current?._id === conversationId &&
        !current.some((m) => m._id === message._id)
          ? [...current, message]
          : current
      );

      // The list row shows the latest message and re-sorts by recency either
      // way, so this runs whether or not the thread is open.
      setConversations((current) =>
        current
          .map((conversation) =>
            String(conversation._id) === conversationId
              ? { ...conversation, lastMessage: message, lastMessageAt: new Date().toISOString() }
              : conversation
          )
          .sort(byMostRecent)
      );
    },

    onConversationPatched: (conversationId, patch) => {
      setSelectedConversation((current) =>
        current && String(current._id) === String(conversationId)
          ? {
              ...current,
              ...patch,
              // A patch that omits these must not blank them: the server sends
              // a projection, not the whole document.
              assignedAgent: patch.assignedAgent ?? current.assignedAgent,
              department: patch.department ?? current.department
            }
          : current
      );
      setConversations((current) =>
        current.map((conversation) =>
          String(conversation._id) === String(conversationId)
            ? { ...conversation, ...patch }
            : conversation
        )
      );
    },

    onConversationAdded: (conversation) => {
      const conversationSiteId = conversation.siteId || (conversation as { site?: Site }).site?._id;
      if (
        !selectedSiteRef.current ||
        String(conversationSiteId) !== siteIdOf(selectedSiteRef.current)
      ) {
        return;
      }
      setConversations((current) =>
        current.some((existing) => existing._id === conversation._id)
          ? current
          : [conversation, ...current]
      );
    },

    onAssignedToMe: (conversationId, siteId) => {
      void openAssignedConversation(conversationId, siteId);
    }
  });

  useInboxNavigation({
    onOpenConversation: (conversationId, siteId) => {
      void openAssignedConversation(conversationId, siteId);
    },
    onSelectTab: (tab) => {
      if (tab !== 'assigned') return;
      void fetchAssignedConversations();
    }
  });
  useEffect(() => {
    if (selectedSite && socket && user) {
      const siteId = siteIdOf(selectedSite);
      // Emitting on a socket that has just dropped throws; the socket layer
      // reconnects and the page re-joins on the next render, so the failure is
      // logged rather than shown to the agent.
      try {
        socket.emit('join-site', { siteId, userId: user._id });
      } catch (error) {
        console.error('[inbox] join-site failed', error);
      }
      void fetchConversations(siteId);
    }
    if (user && user.role === 'agent') {
      fetchAssignedConversations();
    }
  }, [selectedSite, socket, user]);
  // Filtreler sunucuda uygulandigi icin her degisiklik listeyi bastan ceker.
  // Ilk yukleme yukaridaki effect'te yapilir, bu yuzden burada site secimi
  // degistiginde tekrar cekilmez.
  const filtersKey = `${statusFilter}|${departmentFilter}|${debouncedSearch}`;
  const lastFiltersKey = useRef(filtersKey);
  useEffect(() => {
    if (lastFiltersKey.current === filtersKey) return;
    lastFiltersKey.current = filtersKey;
    if (!selectedSite) return;
    setNextCursor(null);
    fetchConversations(siteIdOf(selectedSite));
  }, [filtersKey, selectedSite]);
  useEffect(() => {
    const conversationId = searchParams.get('id');
    const tab = searchParams.get('tab');
    if (tab === 'assigned') {
      fetchAssignedConversations();
      setSearchParams({});
      return;
    }
    if (conversationId && conversations.length > 0) {
      const conversation = conversations.find((conv) => conv._id === conversationId);
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
      const derivedSiteId =
        selectedConversation.siteId ||
        (selectedConversation.site as Site | undefined)?._id ||
        siteIdOf(selectedSite);
      fetchConversationMessages(derivedSiteId, selectedConversation._id);
    }
  }, [selectedConversation, socket]);
  useEffect(() => {
    setNote('');
  }, [selectedConversation?._id]);
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
        if (
          !selectedSite ||
          !siteList.some((s) => String(s._id) === String(selectedSite._id || selectedSite))
        ) {
          setSelectedSite(siteList[0]);
        }
      } else {
        setSelectedSite(null);
        setConversations([]);
        setSelectedConversation(null);
      }
    } catch (error) {
      // Without the site list the page cannot show anything at all, so this
      // one is surfaced rather than logged.
      toast.error(errorMessage(error, t('conversations.sitesError', 'Siteler yüklenemedi')));
    }
  };

  /**
   * The pickers in the conversation sidebar.
   *
   * These two are secondary: if they fail the inbox still works, the agent just
   * cannot reassign or re-route from the dropdowns. Reported to the console so
   * a persistent failure is findable, not to the agent, who cannot act on it.
   */
  const fetchDepartments = async (siteId: string) => {
    try {
      const response = await departmentsAPI.getAll(siteId);
      setDepartments(response.data || []);
    } catch (error) {
      console.error('[inbox] could not load departments', error);
    }
  };

  const fetchTeamMembers = async (siteId: string) => {
    try {
      const response = await teamAPI.getAll(siteId);
      setTeamMembers(response.data || []);
    } catch (error) {
      console.error('[inbox] could not load team members', error);
    }
  };
  const fetchConversations = async (
    siteId: string,
    { cursor = null }: { cursor?: string | null } = {}
  ) => {
    try {
      const response = await conversationsAPI.getAll(siteId, {
        status: statusFilter,
        departmentId: departmentFilter,
        search: debouncedSearch,
        limit: 30,
        cursor
      });
      const { conversations: page, nextCursor: cursorAfter, counts: pageCounts } = response.data;
      // Sayfa eklenirken kimlige gore tekillestirilir: bu sirada gelen bir
      // realtime guncelleme ayni kaydi listeye ikinci kez sokabilir.
      setConversations((prev) => {
        if (!cursor) return page;
        const merged = new Map(prev.map((c) => [String(c._id), c]));
        page.forEach((c) => merged.set(String(c._id), c));
        return Array.from(merged.values());
      });
      setNextCursor(cursorAfter || null);
      if (pageCounts) setCounts(pageCounts);
      if (!cursor) {
        fetchDepartments(siteId);
        fetchTeamMembers(siteId);
        if (socket) {
          socket.emit('join-site', { siteId, userId: user?._id });
        }
      }
    } catch (error) {
      toast.error(errorMessage(error, t('dashboard.fetchError')));
    }
  };
  const loadMoreConversations = async () => {
    if (!nextCursor || loadingMore || !selectedSite) return;
    setLoadingMore(true);
    try {
      await fetchConversations(siteIdOf(selectedSite), { cursor: nextCursor });
    } finally {
      setLoadingMore(false);
    }
  };
  const fetchAssignedConversations = async () => {
    try {
      const resp = await conversationsAPI.getAssigned();
      if (resp && resp.data && Array.isArray(resp.data.conversations)) {
        setConversations((prev) => {
          const map = new Map();
          resp.data.conversations.forEach((c) => map.set(String(c._id), c));
          prev.forEach((c) => {
            if (!map.has(String(c._id))) map.set(String(c._id), c);
          });
          return Array.from(map.values()).sort(
            (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
          );
        });
      }
    } catch (error) {
      toast.error(errorMessage(error, t('conversations.fetchError', 'Konuşmalar yüklenemedi')));
    }
  };
  const fetchConversationMessages = async (siteId: string, conversationId: string) => {
    const resolvedSiteId =
      siteId ||
      siteIdOf(selectedSiteRef.current) ||
      String(selectedConversationRef.current?.siteId ?? '');
    if (!resolvedSiteId) return;

    try {
      const { data } = await conversationsAPI.getOne(resolvedSiteId, conversationId);
      setSelectedConversation(data.conversation);
      // An empty page with a `lastMessage` on the conversation means the
      // transcript has not loaded yet; showing that one line beats an empty
      // thread that looks like a bug.
      const fetched = Array.isArray(data.messages) ? data.messages : [];
      setMessages(
        fetched.length > 0
          ? fetched
          : data.conversation?.lastMessage
            ? [data.conversation.lastMessage]
            : []
      );
    } catch (error) {
      toast.error(errorMessage(error, t('dashboard.fetchMessagesError')));
    }
  };

  /**
   * Opens a conversation that was just handed to this agent.
   *
   * The site may not be the one on screen — an assignment can arrive for any
   * site the agent works on — so it is selected first, fetching it when the
   * list does not have it yet.
   *
   * The version this replaces was four levels of nested try/catch inside the
   * socket handler, each level swallowing its error, so a failure at any step
   * left the agent with a toast saying the conversation was assigned to them
   * and no way to see it.
   */
  const openAssignedConversation = async (conversationId: string, siteId: string | null) => {
    try {
      const targetSiteId = siteId || siteIdOf(selectedSiteRef.current);
      if (!targetSiteId) {
        // No site context at all: fall back to the assigned list, which is
        // scoped to this agent and needs no site.
        await fetchAssignedConversations();
        return;
      }

      if (siteIdOf(selectedSiteRef.current) !== targetSiteId) {
        const known = sites.find((site) => String(site._id) === String(targetSiteId));
        if (known) {
          setSelectedSite(known);
        } else {
          const { data } = await sitesAPI.getOne(targetSiteId);
          if (data?.site) {
            setSites((current) =>
              current.some((site) => String(site._id) === String(targetSiteId))
                ? current
                : [data.site, ...current]
            );
            setSelectedSite(data.site);
          }
        }
      }

      await fetchConversations(targetSiteId);
      await fetchConversationMessages(targetSiteId, conversationId);
      toast.success(t('conversations.assignedNotification', 'Conversation assigned to you'));
    } catch (error) {
      toast.error(errorMessage(error, t('conversations.openError', 'Konuşma açılamadı')));
    }
  };
  const deleteConversation = async () => {
    const { conversationId } = confirmDialog;
    try {
      await conversationsAPI.delete(siteIdOf(selectedSite), conversationId as string);
      setConversations((prev) => prev.filter((conv) => conv._id !== conversationId));
      if (selectedConversation?._id === conversationId) {
        setSelectedConversation(null);
        setMessages([]);
      }
      toast.success(t('conversations.deleteSuccess'));
    } catch (error) {
      toast.error(errorMessage(error, t('conversations.deleteError')));
    }
  };
  const openDeleteConfirm = (conversationId: string) => {
    setConfirmDialog({ isOpen: true, conversationId });
  };
  const handleSendMessage = async (e: React.FormEvent) => {
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
      if (!selectedFile || !selectedSite || !selectedConversation || !socket) return;
      const formData = new FormData();
      formData.append('file', selectedFile);
      const response = await fetch(`${API_BASE_URL}/files/upload`, {
        method: 'POST',
        headers: {
          'X-Site-Key': selectedSite.siteKey
        },
        // Oturum çerezi bu isteği de taşır; token okunmuyor.
        credentials: 'include',
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
      toast.error(errorMessage(error, t('conversations.fileUploadError')));
    }
  };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
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
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  const handleStatusChange = async (newStatus: any) => {
    if (!selectedConversation) return;
    try {
      const response = await conversationsAPI.updateStatus(selectedConversation._id, newStatus);
      setSelectedConversation(response.data.conversation);
      setConversations((prev) =>
        prev.map((conv) =>
          conv._id === selectedConversation._id ? { ...conv, status: newStatus } : conv
        )
      );
      toast.success(t('conversations.statusChangeSuccess'));
    } catch (error) {
      toast.error(errorMessage(error, t('conversations.statusChangeError')));
    }
  };
  const handlePriorityChange = async (newPriority: any) => {
    if (!selectedConversation) return;
    try {
      const response = await conversationsAPI.setPriority(selectedConversation._id, newPriority);
      setSelectedConversation(response.data.conversation);
      setConversations((prev) =>
        prev.map((conv) =>
          conv._id === selectedConversation._id ? { ...conv, priority: newPriority } : conv
        )
      );
      toast.success(t('conversations.priorityChangeSuccess'));
    } catch (error) {
      toast.error(errorMessage(error, t('conversations.priorityChangeError')));
    }
  };
  // "Take over" silences the assistant at once; "give back" lets it answer the
  // visitor's next message. The server broadcasts the change to every inbox.
  const handleSetOwner = async (owner: 'ai' | 'human') => {
    const conversation = selectedConversation;
    if (!conversation) return;
    try {
      const { data } = await aiAPI.setOwner(conversation._id, owner);
      setSelectedConversation((current) =>
        current && current._id === conversation._id ? { ...current, ...data } : current
      );
    } catch (error) {
      toast.error(errorMessage(error, t('ai.ownerError')));
    }
  };

  const handleClaimConversation = async (conversationId: string) => {
    try {
      await conversationsAPI.claim(conversationId);
      if (selectedSite) {
        fetchConversations(selectedSite._id);
      }
      toast.success(t('conversations.assignedToYou'));
    } catch (error) {
      toast.error(errorMessage(error, t('conversations.claimError')));
    }
  };
  const handleAssignConversation = async (conversationId: string, agentId: string | null) => {
    try {
      const response = await conversationsAPI.assign(conversationId, agentId || null);
      if (selectedConversation && selectedConversation._id === conversationId) {
        setSelectedConversation(response.data.conversation);
      }
      if (selectedSite) {
        fetchConversations(selectedSite._id);
      }
      toast.success(t('conversations.assignSuccess'));
    } catch (error) {
      toast.error(errorMessage(error, t('conversations.assignError')));
    }
  };
  const handleSetDepartment = async (conversationId: string, departmentId: string | null) => {
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
      toast.error(errorMessage(error, t('conversations.departmentChangeError')));
    }
  };
  const handleAddNote = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = note.trim();
    if (!selectedConversation || !value || noteSaving) return;
    try {
      setNoteSaving(true);
      const response = await conversationsAPI.addNote(selectedConversation._id, value);
      const updated = response.data.conversation;
      setSelectedConversation(updated);
      setConversations((current) =>
        current.map((conversation) =>
          conversation._id === updated._id
            ? { ...conversation, internalNotes: updated.internalNotes }
            : conversation
        )
      );
      setNote('');
      toast.success(t('conversations.noteAdded', 'Dahili not eklendi'));
    } catch (error) {
      toast.error(errorMessage(error, t('conversations.noteError', 'Not eklenemedi')));
    } finally {
      setNoteSaving(false);
    }
  };
  // Sunucu zaten filtreledi. Burada tekrar filtrelemek, mesaj icerigiyle
  // eslesen konusmalari listeden atardi: o metin `lastMessage` icinde
  // olmayabilir ve tarayici konusmanin tum mesajlarini gormez.
  const filteredConversations = conversations;
  return (
    <>
      <Helmet>
        <title>{`${t('conversations.title') || ''} — Support.io`}</title>
        <meta name="description" content={t('conversations.subtitle')} />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="w-full h-full max-w-full overflow-hidden">
        <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 xl:px-8 h-screen max-h-screen overflow-hidden flex flex-col py-2 sm:py-4">
          {sites.length === 0 && (
            <div className="p-4 mb-4 border border-yellow-400 bg-yellow-50 text-yellow-600 rounded">
              {t('conversations.noSitesNotice') ||
                "You don't have any sites yet. Please add a site to start receiving conversations."}
            </div>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 mb-2 sm:mb-3 lg:mb-4 flex-shrink-0">
            <div className="min-w-0 flex-shrink-1">
              <h1 className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-gray-900 dark:text-white transition-colors duration-200 truncate">
                {t('conversations.title')}
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-0.5 sm:mt-1 transition-colors duration-200 truncate">
                {t('conversations.subtitle')}
              </p>
            </div>
            <select
              value={selectedSite?._id || ''}
              onChange={(e) => {
                const site = sites.find((s) => s._id === e.target.value);
                setSelectedSite(site ?? null);
                setSelectedConversation(null);
              }}
              className="px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-colors duration-200 w-full sm:w-auto flex-shrink-0"
            >
              {sites.map((site) => (
                <option key={site._id} value={site._id}>
                  {site.name}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full max-w-full bg-white dark:bg-gray-800 rounded-lg sm:rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex-1 flex flex-col lg:flex-row transition-colors duration-200 min-h-0">
            <div
              className={`${selectedConversation ? 'hidden lg:flex' : 'flex'} w-full lg:w-80 xl:w-96 lg:max-w-md border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700 flex-col transition-colors duration-200 overflow-hidden`}
            >
              <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 transition-colors duration-200 flex-shrink-0">
                <div className="relative w-full">
                  <Search className="absolute left-2.5 sm:left-3 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 dark:text-gray-500 transition-colors duration-200" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder={t('conversations.searchPlaceholder')}
                    className="w-full pl-8 sm:pl-9 pr-2 sm:pr-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-colors duration-200"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    aria-label={t('conversations.statusFilter', 'Duruma göre filtrele')}
                    className="min-w-0 px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="all">{t('conversations.allStatuses', 'Tüm durumlar')}</option>
                    {Object.keys(STATUS_LABELS).map((status) => (
                      <option key={status} value={status}>
                        {statusLabel(status)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={departmentFilter}
                    onChange={(event) => setDepartmentFilter(event.target.value)}
                    aria-label={t('conversations.departmentFilter', 'Departmana göre filtrele')}
                    className="min-w-0 px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="all">
                      {t('conversations.allDepartments', 'Tüm departmanlar')}
                    </option>
                    {departments.map((department) => (
                      <option key={department._id} value={department._id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                  <span>
                    {counts
                      ? t('conversations.shownOfTotal', '{{shown}} / {{total}} konuşma')
                          .replace('{{shown}}', String(conversations.length))
                          .replace('{{total}}', String(counts.total))
                      : conversations.length}
                  </span>
                  {(searchTerm || statusFilter !== 'all' || departmentFilter !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm('');
                        setStatusFilter('all');
                        setDepartmentFilter('all');
                      }}
                      className="font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                    >
                      {t('common.clear', 'Temizle')}
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 modal-scrollbar pr-2">
                {filteredConversations.length === 0 ? (
                  <div className="p-4 sm:p-6 text-center text-gray-500 dark:text-gray-400 transition-colors duration-200">
                    <MessageCircle className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2 text-gray-400 dark:text-gray-500 transition-colors duration-200" />
                    <p className="text-xs sm:text-sm">
                      {conversations.length === 0
                        ? t('conversations.noConversations')
                        : t(
                            'conversations.noMatchFilter',
                            'Filtre kriterlerine uygun konuşma bulunamadı'
                          )}
                    </p>
                  </div>
                ) : (
                  filteredConversations.map((conv) => (
                    <ConversationListItem
                      key={conv._id}
                      conversation={conv}
                      selected={selectedConversation?._id === conv._id}
                      onSelect={setSelectedConversation}
                      statusLabel={statusLabel}
                    />
                  ))
                )}
                {nextCursor && (
                  <button
                    type="button"
                    onClick={loadMoreConversations}
                    disabled={loadingMore}
                    className="w-full py-2.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors duration-200"
                  >
                    {loadingMore
                      ? t('common.loading', 'Yükleniyor...')
                      : t('conversations.loadMore', 'Daha fazla göster')}
                  </button>
                )}
              </div>
            </div>
            {selectedConversation ? (
              <>
                <div className="flex flex-1 flex-col w-full min-w-0 overflow-hidden min-h-0">
                  <div className="p-2 sm:p-2.5 lg:p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 transition-colors duration-200 flex-shrink-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0 overflow-hidden">
                        <button
                          onClick={() => setSelectedConversation(null)}
                          className="lg:hidden p-1.5 sm:p-2 -ml-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors flex-shrink-0"
                        >
                          <svg
                            className="w-4 h-4 sm:w-5 sm:h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M15 19l-7-7 7-7"
                            />
                          </svg>
                        </button>
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-200">
                          <User className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-indigo-400 transition-colors duration-200" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white transition-colors duration-200 truncate">
                            {selectedConversation.visitorName}
                          </p>
                          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 transition-colors duration-200 truncate">
                            {selectedConversation.visitorEmail || t('conversations.noEmail')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 ml-1.5 sm:ml-2">
                        <select
                          value={selectedConversation.priority}
                          onChange={(e) => handlePriorityChange(e.target.value)}
                          className={`px-2 py-1 text-[10px] sm:text-xs rounded cursor-pointer border-0 font-medium ${getPriorityColor(selectedConversation.priority)}`}
                        >
                          <option value="low">{t('conversations.priorities.low', 'Düşük')}</option>
                          <option value="normal">
                            {t('conversations.priorities.normal', 'Orta')}
                          </option>
                          <option value="high">
                            {t('conversations.priorities.high', 'Yüksek')}
                          </option>
                          <option value="urgent">
                            {t('conversations.priorities.urgent', 'Acil')}
                          </option>
                        </select>
                        <select
                          value={selectedConversation.status}
                          onChange={(e) => handleStatusChange(e.target.value)}
                          className={`px-2 py-1 text-[10px] sm:text-xs rounded cursor-pointer border-0 font-medium whitespace-nowrap ${getStatusColor(selectedConversation.status)}`}
                        >
                          <option value="open">{t('conversations.statuses.open', 'Açık')}</option>
                          <option value="assigned">
                            {t('conversations.statuses.assigned', 'Atandı')}
                          </option>
                          <option value="pending">
                            {t('conversations.statuses.pending', 'Beklemede')}
                          </option>
                          <option value="resolved">
                            {t('conversations.statuses.resolved', 'Çözüldü')}
                          </option>
                          <option value="closed">
                            {t('conversations.statuses.closed', 'Kapalı')}
                          </option>
                        </select>
                        {canDeleteConversations && (
                          <button
                            onClick={() => openDeleteConfirm(selectedConversation._id)}
                            className="p-1.5 sm:p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors duration-200"
                            title={t('conversations.deleteConversationTooltip')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {selectedConversation.metadata?.verifiedUserId ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400">
                          <ShieldCheck className="w-3 h-3" />
                          {t('ai.verifiedCustomer')}
                        </span>
                      ) : null}
                      {selectedConversation.responseOwner === 'ai' ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                            <Bot className="w-3 h-3" />
                            {t('ai.answeringAi')}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleSetOwner('human')}
                            className="px-2 py-0.5 text-[11px] font-medium rounded bg-indigo-600 text-white hover:bg-indigo-700"
                          >
                            {t('ai.takeOver')}
                          </button>
                        </span>
                      ) : selectedSite?.aiSettings?.mode === 'auto' ? (
                        <button
                          type="button"
                          onClick={() => handleSetOwner('ai')}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                        >
                          <Bot className="w-3 h-3" />
                          {t('ai.giveBack')}
                        </button>
                      ) : null}
                      <div className="flex items-center gap-1">
                        <Folder className="w-3 h-3 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                        <select
                          value={selectedConversation.department?._id || ''}
                          onChange={(e) =>
                            handleSetDepartment(selectedConversation!._id, e.target.value || null)
                          }
                          className="px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300"
                        >
                          <option value="">
                            {t('conversations.selectDepartment', 'Departman Seçiniz')}
                          </option>
                          {departments.map((dept) => (
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
                          onChange={(e) =>
                            handleAssignConversation(
                              selectedConversation!._id,
                              e.target.value || null
                            )
                          }
                          disabled={
                            !canAssignAnyone &&
                            Boolean(selectedConversation.assignedAgent) &&
                            String(selectedConversation.assignedAgent?._id) !== selfId
                          }
                          className="px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          <option value="">{t('conversations.unassigned', 'Atanmamış')}</option>
                          {teamMembers
                            .filter(
                              (member) =>
                                canAssignAnyone ||
                                String(member._id) === selfId ||
                                String(member._id) ===
                                  String(selectedConversation.assignedAgent?._id || '')
                            )
                            .map((member) => (
                              <option key={member._id} value={member._id}>
                                {member.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-2.5 lg:p-3 xl:p-4 space-y-2 sm:space-y-2.5 lg:space-y-3 bg-gray-50 dark:bg-gray-900 transition-colors duration-200 min-h-0 modal-scrollbar pr-2 relative">
                    {isUnclaimed(selectedConversation) && (
                      <div className="absolute inset-0 z-20 bg-gray-50/90 dark:bg-gray-900/90 backdrop-blur-sm flex flex-col items-center justify-center p-6">
                        <div className="bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 rounded-2xl p-8 max-w-sm text-center transform transition-all hover:scale-[1.02]">
                          <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4">
                            <UserCheck className="w-8 h-8" />
                          </div>
                          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                            {t('conversations.claimTitle', 'Talebi Üzerinize Alın')}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                            {t(
                              'conversations.claimDesc',
                              'Bu müşteriye yanıt verebilmek ve konuşma geçmişine erişebilmek için talebi üstlenmeniz gerekmektedir.'
                            )}
                          </p>
                          {selectedConversation.lastMessage && (
                            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl text-left border border-gray-100 dark:border-gray-700 mb-6">
                              <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 block mb-1">
                                {t('conversations.claimSummaryLabel', 'Müşteri Talebi Özeti:')}
                              </span>
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
                      <MessageBubble key={message._id} message={message} />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                  <AIAssistant
                    conversation={selectedConversation}
                    disabled={isUnclaimed(selectedConversation)}
                    onAccept={(text: string) => setNewMessage(text)}
                    composerText={newMessage}
                    lastVisitorMessage={
                      [...messages].reverse().find((m) => m.senderType === 'visitor')?.content ??
                      null
                    }
                  />
                  <form
                    onSubmit={handleSendMessage}
                    className={`p-2 sm:p-2.5 lg:p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 transition-colors duration-200 flex-shrink-0 ${isUnclaimed(selectedConversation) ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    {selectedFile && (
                      <div className="mb-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center gap-2">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 rounded">
                          {attachmentIcon(selectedFile.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                            {selectedFile.name}
                          </p>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400">
                            {formatFileSize(selectedFile.size)}
                          </p>
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
                        <span className="hidden sm:inline text-xs sm:text-sm lg:text-base">
                          {t('conversations.send')}
                        </span>
                      </button>
                    </div>
                  </form>
                </div>
                <aside className="hidden xl:flex w-72 flex-shrink-0 flex-col border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {t('conversations.customerContext', 'Müşteri bilgileri')}
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-semibold">
                        {(selectedConversation.visitorName || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {selectedConversation.visitorName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {selectedConversation.ticketId || `#${selectedConversation.ticketNumber}`}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 space-y-3 border-b border-gray-200 dark:border-gray-700 text-xs overflow-y-auto">
                    <div className="flex items-start gap-2 text-gray-600 dark:text-gray-300">
                      <Mail className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" />
                      <span className="break-all">
                        {selectedConversation.visitorEmail ||
                          t('conversations.noEmail', 'E-posta yok')}
                      </span>
                    </div>
                    <div className="flex items-start gap-2 text-gray-600 dark:text-gray-300">
                      <Globe2 className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" />
                      <span className="break-all flex-1">
                        {selectedConversation.currentPage || '-'}
                      </span>
                      {/^https?:\/\//i.test(selectedConversation.currentPage || '') && (
                        <a
                          href={selectedConversation.currentPage}
                          target="_blank"
                          rel="noreferrer noopener"
                          aria-label={t('conversations.openPage', 'Sayfayı aç')}
                          className="text-indigo-600 dark:text-indigo-400"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                    <div className="flex items-start gap-2 text-gray-600 dark:text-gray-300">
                      <Clock className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" />
                      <span>{formatDateTime(selectedConversation.createdAt)}</span>
                    </div>
                    <div className="flex items-start gap-2 text-gray-600 dark:text-gray-300">
                      <Tag className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" />
                      <div className="flex flex-wrap gap-1">
                        {(selectedConversation.tags || []).length > 0 ? (
                          selectedConversation.tags.map((item: any) => (
                            <span
                              key={item}
                              className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700"
                            >
                              {item}
                            </span>
                          ))
                        ) : (
                          <span>{t('conversations.noTags', 'Etiket yok')}</span>
                        )}
                      </div>
                    </div>
                    {Boolean(selectedConversation.metadata?.browser) && (
                      <div className="rounded-lg bg-gray-50 dark:bg-gray-700/60 p-2.5 text-[11px] text-gray-600 dark:text-gray-300">
                        {String(selectedConversation.metadata!.browser)}
                        {selectedConversation.metadata!.os
                          ? ` · ${String(selectedConversation.metadata!.os)}`
                          : ''}
                        {selectedConversation.metadata!.country
                          ? ` · ${String(selectedConversation.metadata!.country)}`
                          : ''}
                      </div>
                    )}
                    {Object.entries(selectedConversation.metadata?.attributes || {})
                      .slice(0, 10)
                      .map(([key, value]) => (
                        <div
                          key={key}
                          className="flex items-start justify-between gap-3 text-[11px]"
                        >
                          <span className="text-gray-500 dark:text-gray-400 truncate">{key}</span>
                          <span className="text-gray-800 dark:text-gray-200 text-right break-all">
                            {String(value)}
                          </span>
                        </div>
                      ))}
                  </div>
                  <div className="min-h-0 flex-1 flex flex-col p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <StickyNote className="w-4 h-4 text-amber-500" />
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {t('conversations.internalNotes', 'Dahili notlar')}
                      </p>
                      <span className="ml-auto text-xs text-gray-400">
                        {selectedConversation.internalNotes?.length || 0}
                      </span>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
                      {(selectedConversation.internalNotes || []).length === 0 ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {t('conversations.noNotes', 'Henüz dahili not yok.')}
                        </p>
                      ) : (
                        (selectedConversation.internalNotes || []).map(
                          (item: any, index: number) => (
                            <div
                              key={item._id || `${item.createdAt}-${index}`}
                              className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-2.5"
                            >
                              <p className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
                                {item.note}
                              </p>
                              <p className="mt-1.5 text-[10px] text-gray-500 dark:text-gray-400">
                                {item.userId?.name || t('conversations.teamMember', 'Ekip üyesi')} ·{' '}
                                {formatDateTime(item.createdAt)}
                              </p>
                            </div>
                          )
                        )
                      )}
                    </div>
                    <form onSubmit={handleAddNote} className="mt-3">
                      <textarea
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        maxLength={5000}
                        rows={3}
                        placeholder={t(
                          'conversations.notePlaceholder',
                          'Yalnızca ekibin görebileceği bir not yazın…'
                        )}
                        className="w-full resize-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2.5 py-2 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                      <button
                        type="submit"
                        disabled={!note.trim() || noteSaving}
                        className="mt-2 w-full rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-gray-950 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {noteSaving
                          ? t('common.saving', 'Kaydediliyor…')
                          : t('conversations.addNote', 'Dahili not ekle')}
                      </button>
                    </form>
                  </div>
                </aside>
              </>
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
