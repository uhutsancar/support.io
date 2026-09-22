/** One cached GET response, kept for CACHE_DURATION. */
import axios from 'axios';
import { csrfToken, CSRF_HEADER, purgeLegacyStorage } from '../lib/session';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '../lib/runtime';
import type {
  AgentPerformance,
  AnalyticsOverview,
  AuditLogEntry,
  Conversation,
  ConversationPage,
  CurrentUser,
  Deal,
  Department,
  FAQ,
  Message,
  Priority,
  Site,
  TeamChat,
  TeamChatMessage,
  TeamChatParticipant,
  TeamMember,
  Visitor,
  WidgetConfig
} from '../types/api';

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_DURATION = 30 * 1000;
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
  // Oturum httpOnly çerezde; tarayıcının onu isteğe eklemesi için gerekli.
  withCredentials: true,
});
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Authorization başlığı yok: token JavaScript'in okuyamadığı bir çerezde ve
  // tarayıcı onu kendisi ekliyor. Buradan yalnızca isteğin panelden geldiğini
  // gösteren CSRF eşi geçiyor.
  const csrf = csrfToken();
  if (csrf) {
    config.headers[CSRF_HEADER] = csrf;
  }
  if (config.method === 'get' && config.cache !== false) {
    // Cache entries are scoped to the authenticated session. Without the
    // token in the key, signing out and into another tenant in the same tab
    // could expose the previous tenant's cached GET response.
    const cacheKey = `${csrf || 'anonymous'}:${config.url}${JSON.stringify(config.params || {})}`;
    config.__cacheKey = cacheKey;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      config.adapter = () => Promise.resolve({
        data: cached.data,
        status: 200,
        statusText: 'OK (cached)',
        headers: {},
        config,
      } as AxiosResponse);
    }
  }
  return config;
});
api.interceptors.response.use(
  (response) => {
    if (response.config.method === 'get' && response.config.cache !== false) {
      const cacheKey = response.config.__cacheKey;
      if (!cacheKey) return response;
      cache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now(),
      });
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      cache.clear();
      purgeLegacyStorage();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
export const clearCache = (pattern?: string): void => {
  if (pattern) {
    for (const key of cache.keys()) {
      if (key.includes(pattern)) {
        cache.delete(key);
      }
    }
  } else {
    cache.clear();
  }
};

/** What a successful sign-in or registration hands back.
 *
 * Token yok: yetki belgesi sunucunun yazdigi httpOnly cerezde durur ve
 * JavaScript'e hic gorunmez. Buradaki csrfToken yetki vermez, yalnizca
 * isteklerin panelden geldigini gosterir. */
export interface AuthResponse {
  csrfToken: string;
  user: CurrentUser;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  companyName?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export const authAPI = {
  register: (data: RegisterPayload) => api.post<AuthResponse>('/auth/register', data),
  login: (data: LoginPayload) => api.post<AuthResponse>('/auth/login', data),
  me: () => api.get<{ user: CurrentUser }>('/auth/me'),
  logout: () => api.post('/auth/logout'),
  updateStatus: (data: { status: string }) => api.put('/auth/status', data),
  deleteAccount: () => api.delete('/auth/account')
};
export const sitesAPI = {
  getAll: () => api.get<{ sites: Site[] }>('/sites'),
  getOne: (siteId: string) => api.get<{ site: Site }>(`/sites/${siteId}`),
  create: async (data: Partial<Site>) => {
    const response = await api.post<{ site: Site }>('/sites', data);
    clearCache('/sites');
    return response;
  },
  update: async (siteId: string, data: Partial<Site>) => {
    const response = await api.put<{ site: Site }>(`/sites/${siteId}`, data);
    clearCache('/sites');
    return response;
  },
  delete: async (siteId: string) => {
    const response = await api.delete(`/sites/${siteId}`);
    clearCache('/sites');
    return response;
  },
  regenerateKey: async (siteId: string) => {
    const response = await api.post<{ site: Site }>(`/sites/${siteId}/regenerate-key`);
    clearCache('/sites');
    return response;
  },
};
export const visitorsAPI = {
  getAll: (siteId: string, active = true) =>
    api.get<Visitor[]>(`/visitors/site/${siteId}`, { params: { active }, cache: false })
};
export const dealsAPI = {
  getAll: () => api.get<Deal[]>('/deals', { cache: false }),
  create: (data: Partial<Deal>) => api.post<Deal>('/deals', data),
  updateStage: (dealId: string, stage: string, order?: number) =>
    api.put<Deal>(`/deals/${dealId}/stage`, { stage, order }),
  delete: (dealId: string) => api.delete(`/deals/${dealId}`)
};
export const faqsAPI = {
  getAll: (siteId: string) => api.get<{ faqs: FAQ[] }>(`/faqs/admin/${siteId}`),
  create: async (data: Partial<FAQ>) => {
    const response = await api.post<{ faq: FAQ }>('/faqs/admin', data);
    clearCache('/faqs');
    return response;
  },
  update: async (faqId: string, data: Partial<FAQ>) => {
    const response = await api.put<{ faq: FAQ }>(`/faqs/admin/${faqId}`, data);
    clearCache('/faqs');
    return response;
  },
  delete: async (faqId: string) => {
    const response = await api.delete(`/faqs/admin/${faqId}`);
    clearCache('/faqs');
    return response;
  },
};

/** The filters the inbox list accepts; 'all' means "do not narrow by this". */
export interface ConversationQuery {
  status?: string;
  search?: string;
  departmentId?: string;
  assignedTo?: string;
  priority?: string;
  limit?: number | string;
  cursor?: string | null;
}

export const conversationsAPI = {
  // Arama ve filtreler sunucuda uygulanir. Panel bunlari tarayicida yapiyordu
  // ve yalnizca yuklu olan sayfayi tariyordu, dolayisiyla listede olmayan bir
  // konusma hicbir aramada bulunamiyordu.
  getAll: (siteId: string | null | undefined, params: ConversationQuery | string = {}) => {
    if (!siteId) {
      return Promise.resolve({ data: { conversations: [] } } as unknown as AxiosResponse<ConversationPage>);
    }
    const { status, search, departmentId, assignedTo, priority, limit, cursor } =
      typeof params === 'string' ? ({ status: params } as ConversationQuery) : params;
    return api.get<ConversationPage>(`/conversations/${siteId}`, {
      params: {
        ...(status && status !== 'all' ? { status } : {}),
        ...(search ? { search } : {}),
        ...(departmentId && departmentId !== 'all' ? { departmentId } : {}),
        ...(assignedTo && assignedTo !== 'all' ? { assignedTo } : {}),
        ...(priority && priority !== 'all' ? { priority } : {}),
        ...(limit ? { limit } : {}),
        ...(cursor ? { cursor } : {})
      }
    });
  },
  getOne: (siteId: string | null | undefined, conversationId: string | null | undefined) => {
    if (!siteId || !conversationId) {
      return Promise.reject(new Error('Missing siteId or conversationId'));
    }
    return api.get<{ conversation: Conversation; messages: Message[]; hasMore: boolean }>(
      `/conversations/${siteId}/${conversationId}`
    );
  },
  getAssigned: () => api.get<{ conversations: Conversation[] }>('/conversations/assigned/me'),
  assign: async (conversationId: string, agentId: string | null, assignedBy?: string) => {
    const response = await api.put<{ conversation: Conversation }>(
      `/conversations/${conversationId}/assign`,
      { agentId, assignedBy }
    );
    clearCache('/conversations');
    return response;
  },
  claim: async (conversationId: string) => {
    const response = await api.put<{ conversation: Conversation }>(`/conversations/${conversationId}/claim`);
    clearCache('/conversations');
    return response;
  },
  setDepartment: async (conversationId: string, departmentId: string | null) => {
    const response = await api.put<{ conversation: Conversation }>(
      `/conversations/${conversationId}/department`,
      { departmentId }
    );
    clearCache('/conversations');
    return response;
  },
  setPriority: async (conversationId: string, priority: Priority) => {
    const response = await api.put<{ conversation: Conversation }>(
      `/conversations/${conversationId}/priority`,
      { priority }
    );
    clearCache('/conversations');
    return response;
  },
  addNote: async (conversationId: string, note: string) => {
    const response = await api.post<{ conversation: Conversation }>(
      `/conversations/${conversationId}/notes`,
      { note }
    );
    clearCache('/conversations');
    return response;
  },
  updateStatus: async (conversationId: string, status: string) => {
    const response = await api.put<{ conversation: Conversation }>(
      `/conversations/${conversationId}/status`,
      { status }
    );
    clearCache('/conversations');
    return response;
  },
  updatePriority: async (conversationId: string, priority: Priority) => {
    const response = await api.put<{ conversation: Conversation }>(
      `/conversations/${conversationId}/priority`,
      { priority }
    );
    clearCache('/conversations');
    return response;
  },
  delete: async (siteId: string, conversationId: string) => {
    const response = await api.delete(`/conversations/${siteId}/${conversationId}`);
    clearCache('/conversations');
    return response;
  },
  getUnreadCount: () =>
    api.get<{ totalUnreadCount: number; unreadBySite: Record<string, number> }>('/conversations/unread-count'),
};
export const departmentsAPI = {
  getAll: (siteId: string) => api.get<Department[]>(`/departments/site/${siteId}`),
  getOne: (departmentId: string) => api.get<Department>(`/departments/${departmentId}`),
  create: async (data: Partial<Department>) => {
    const response = await api.post<Department>('/departments', data);
    clearCache('/departments');
    return response;
  },
  update: async (departmentId: string, data: Partial<Department>) => {
    const response = await api.put<Department>(`/departments/${departmentId}`, data);
    clearCache('/departments');
    return response;
  },
  delete: async (departmentId: string) => {
    const response = await api.delete(`/departments/${departmentId}`);
    clearCache('/departments');
    return response;
  },
  addMember: async (departmentId: string, userId: string, role: string) => {
    const response = await api.post<Department>(
      `/departments/${departmentId}/members`,
      { userId, role }
    );
    clearCache('/departments');
    return response;
  },
  removeMember: async (departmentId: string, userId: string) => {
    const response = await api.delete(`/departments/${departmentId}/members/${userId}`);
    clearCache('/departments');
    return response;
  },
  getStats: (departmentId: string) => api.get<Record<string, unknown>>(`/departments/${departmentId}/stats`),
};
export const teamAPI = {
  getAll: (siteId?: string | null) => api.get<TeamMember[]>('/team', { params: { siteId } }),
  getOne: (userId: string) => api.get<TeamMember>(`/team/${userId}`),
  create: async (data: Partial<TeamMember> & { password?: string }) => {
    const response = await api.post<TeamMember>('/team', data);
    clearCache('/team');
    return response;
  },
  update: async (userId: string, data: Partial<TeamMember>) => {
    const response = await api.put<TeamMember>(`/team/${userId}`, data);
    clearCache('/team');
    return response;
  },
  updateStatus: async (userId: string, status: string) => {
    const response = await api.patch<TeamMember>(`/team/${userId}/status`, { status });
    clearCache('/team');
    return response;
  },
  delete: async (userId: string) => {
    const response = await api.delete(`/team/${userId}`);
    clearCache('/team');
    return response;
  },
  getStats: (userId: string) => api.get<Record<string, number>>(`/team/${userId}/stats`),
  // Real aggregates for the signed-in agent; the server scopes them to the
  // caller, so no id is sent.
  getMyPerformance: (range: string) =>
    api.get<{ range: string; days: number; performance: AgentPerformance }>(
      '/team/me/performance',
      { params: { range }, cache: false }
    ),
};
export const teamChatAPI = {
  getChats: () => api.get<TeamChat[]>('/team-chat/chats', { cache: false }),
  createDirect: (targetUserId: string) => api.post<TeamChat>('/team-chat/chats/direct', { targetUserId }),
  createGroup: (name: string, participantIds: string[]) =>
    api.post<TeamChat>('/team-chat/chats/group', { name, participantIds }),
  getMessages: (chatId: string, limit?: number) =>
    api.get<TeamChatMessage[]>(`/team-chat/chats/${chatId}/messages`, { params: { limit }, cache: false }),
  getMembers: () => api.get<TeamChatParticipant[]>('/team-chat/members', { cache: false }),
  getUnread: () => api.get<{ unreadCount: number }>('/team-chat/unread', { cache: false }),
  deleteMessage: (messageId: string) => api.delete(`/team-chat/messages/${messageId}`),
};
export const widgetConfigAPI = {
  getConfig: (siteId: string) =>
    api.get<{ config: WidgetConfig }>(`/widget-config/site/${siteId}`, { cache: false }),
  updateConfig: async (siteId: string, data: Partial<WidgetConfig>) => {
    const response = await api.put<{ config: WidgetConfig }>(`/widget-config/site/${siteId}`, data);
    clearCache('/widget-config');
    return response;
  },
  uploadLogo: async (siteId: string, file: File) => {
    const formData = new FormData();
    formData.append('logo', file);
    const response = await api.post<{ config: WidgetConfig; logoUrl: string }>(
      `/widget-config/site/${siteId}/logo`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    clearCache('/widget-config');
    return response;
  },
  deleteLogo: async (siteId: string) => {
    const response = await api.delete(`/widget-config/site/${siteId}/logo`);
    clearCache('/widget-config');
    return response;
  },
  getPublicConfig: (siteKey: string) =>
    api.get<{ config: WidgetConfig }>(`/widget-config/public/${siteKey}`, { cache: false }),
};

/** Every AI task answers with the model it used and what it cost. */
export interface AIAttribution {
  model: string;
  usage: { inputTokens: number | null; outputTokens: number | null };
}

export const aiAPI = {
  // The provider and its key live only on the server; the browser never sees
  // either. `status` lets the UI hide the controls when AI is not configured.
  status: () => api.get<{ enabled: boolean; provider: string }>('/ai/status', { cache: false }),
  summarize: (conversationId: string) =>
    api.post<AIAttribution & { summary: string }>(`/ai/conversations/${conversationId}/summary`),
  suggestReply: (conversationId: string, instruction?: string | null) =>
    api.post<AIAttribution & { reply: string }>(
      `/ai/conversations/${conversationId}/suggest-reply`,
      { instruction }
    ),
  rewrite: (conversationId: string, draft: string, tone?: string) =>
    api.post<AIAttribution & { reply: string }>(`/ai/conversations/${conversationId}/rewrite`, { draft, tone }),
  translate: (conversationId: string, text: string, targetLanguage: string) =>
    api.post<AIAttribution & { text: string }>(
      `/ai/conversations/${conversationId}/translate`,
      { text, targetLanguage }
    ),
  analyze: (conversationId: string) =>
    api.post<AIAttribution & { analysis: Record<string, unknown> }>(
      `/ai/conversations/${conversationId}/analyze`
    ),
  knowledgeAnswer: (conversationId: string, question: string) =>
    api.post<AIAttribution & { answered: boolean; answer: string | null }>(
      `/ai/conversations/${conversationId}/knowledge-answer`,
      { question }
    )
};
export const analyticsAPI = {
  // Server-side aggregation over the whole window; never cached, because the
  // page also refreshes it from realtime socket events.
  getOverview: (range: string, siteId?: string | null) =>
    api.get<AnalyticsOverview>('/analytics/overview', { params: { range, siteId }, cache: false })
};
export const auditAPI = {
  getAll: (params?: Record<string, unknown>) =>
    api.get<{ docs: AuditLogEntry[]; total: number; page: number; limit: number }>('/audit', { params })
};
export default api;
