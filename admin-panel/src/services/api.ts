// Every endpoint the dashboard calls, grouped by the resource it belongs to.
//
// This file is a list and nothing else. The transport — credentials, the CSRF
// header, the GET cache, the 401 redirect — lives in `http.ts`, and a write
// that has to invalidate reads says so with `mutates(prefix, …)` instead of
// repeating the same five-line wrapper twenty-seven times.
//
// Request and response shapes come from `../types/api`, which mirrors what the
// server actually returns.

import { api, clearCache, mutates } from './http';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import type {
  AIStatus,
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

export { clearCache };

// ---------------------------------------------------------------------- auth

/**
 * What a successful sign-in or registration hands back.
 *
 * No token: the credential is an httpOnly cookie the server writes and
 * JavaScript never sees. The `csrfToken` here grants nothing — it only proves a
 * later request came from the panel. See `lib/session.ts`.
 */
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

// --------------------------------------------------------------------- sites

export const sitesAPI = {
  getAll: () => api.get<{ sites: Site[] }>('/sites'),
  getOne: (siteId: string) => api.get<{ site: Site }>(`/sites/${siteId}`),
  create: mutates('/sites', (data: Partial<Site>) => api.post<{ site: Site }>('/sites', data)),
  update: mutates('/sites', (siteId: string, data: Partial<Site>) =>
    api.put<{ site: Site }>(`/sites/${siteId}`, data)
  ),
  delete: mutates('/sites', (siteId: string) => api.delete(`/sites/${siteId}`)),
  regenerateKey: mutates('/sites', (siteId: string) =>
    api.post<{ site: Site }>(`/sites/${siteId}/regenerate-key`)
  ),

  // The integration secrets come back once, in the response that creates them;
  // the site itself only ever says whether one is set.
  generateIdentitySecret: mutates('/sites', (siteId: string) =>
    api.post<{ site: Site; secret: string }>(`/sites/${siteId}/integrations/identity-secret`)
  ),
  updateOrderLookup: mutates(
    '/sites',
    (siteId: string, data: { enabled?: boolean; url?: string | null }) =>
      api.put<{ site: Site }>(`/sites/${siteId}/integrations/order-lookup`, data)
  ),
  generateOrderSigningSecret: mutates('/sites', (siteId: string) =>
    api.post<{ site: Site; secret: string }>(
      `/sites/${siteId}/integrations/order-lookup/signing-secret`
    )
  ),
  testOrderLookup: (siteId: string) =>
    api.post<{ ok: boolean; orders?: number; reason?: string }>(
      `/sites/${siteId}/integrations/order-lookup/test`
    )
};

// ------------------------------------------------------------------ visitors

export const visitorsAPI = {
  // Never cached: this is a live presence list, and a thirty-second-old answer
  // is worse than none.
  getAll: (siteId: string, active = true) =>
    api.get<Visitor[]>(`/visitors/site/${siteId}`, { params: { active }, cache: false })
};

// --------------------------------------------------------------------- deals

export const dealsAPI = {
  getAll: () => api.get<Deal[]>('/deals', { cache: false }),
  create: mutates('/deals', (data: Partial<Deal>) => api.post<Deal>('/deals', data)),
  updateStage: mutates('/deals', (dealId: string, stage: string, order?: number) =>
    api.put<Deal>(`/deals/${dealId}/stage`, { stage, order })
  ),
  delete: mutates('/deals', (dealId: string) => api.delete(`/deals/${dealId}`))
};

// ---------------------------------------------------------------------- FAQs

export const faqsAPI = {
  getAll: (siteId: string) => api.get<{ faqs: FAQ[] }>(`/faqs/admin/${siteId}`),
  create: mutates('/faqs', (data: Partial<FAQ>) => api.post<{ faq: FAQ }>('/faqs/admin', data)),
  update: mutates('/faqs', (faqId: string, data: Partial<FAQ>) =>
    api.put<{ faq: FAQ }>(`/faqs/admin/${faqId}`, data)
  ),
  delete: mutates('/faqs', (faqId: string) => api.delete(`/faqs/admin/${faqId}`))
};

// ------------------------------------------------------------- conversations

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

/** Drops the 'all' sentinels and the empty values, leaving what the API wants. */
function inboxParams(query: ConversationQuery): Record<string, unknown> {
  const { status, search, departmentId, assignedTo, priority, limit, cursor } = query;
  return {
    ...(status && status !== 'all' ? { status } : {}),
    ...(search ? { search } : {}),
    ...(departmentId && departmentId !== 'all' ? { departmentId } : {}),
    ...(assignedTo && assignedTo !== 'all' ? { assignedTo } : {}),
    ...(priority && priority !== 'all' ? { priority } : {}),
    ...(limit ? { limit } : {}),
    ...(cursor ? { cursor } : {})
  };
}

const CONVERSATIONS = '/conversations';

export const conversationsAPI = {
  /**
   * One page of the inbox.
   *
   * Filtering and search run on the server. The panel used to do both in the
   * browser over whatever page was already loaded, so a conversation that had
   * not been fetched could not be found by any search.
   */
  getAll: (siteId: string | null | undefined, params: ConversationQuery | string = {}) => {
    if (!siteId) {
      // No site selected yet — answer with an empty page rather than calling an
      // endpoint that would 404 on an empty id.
      return Promise.resolve({
        data: { conversations: [], hasMore: false, nextCursor: null }
      } as unknown as AxiosResponse<ConversationPage>);
    }
    // The status-only string form is still used by a couple of callers.
    const query = typeof params === 'string' ? { status: params } : params;
    return api.get<ConversationPage>(`${CONVERSATIONS}/${siteId}`, { params: inboxParams(query) });
  },

  getOne: (siteId: string | null | undefined, conversationId: string | null | undefined) => {
    if (!siteId || !conversationId) {
      return Promise.reject(new Error('Missing siteId or conversationId'));
    }
    return api.get<{ conversation: Conversation; messages: Message[]; hasMore: boolean }>(
      `${CONVERSATIONS}/${siteId}/${conversationId}`
    );
  },

  getAssigned: () => api.get<{ conversations: Conversation[] }>(`${CONVERSATIONS}/assigned/me`),

  getUnreadCount: () =>
    api.get<{ totalUnreadCount: number; unreadBySite: Record<string, number> }>(
      `${CONVERSATIONS}/unread-count`
    ),

  assign: mutates(CONVERSATIONS, (conversationId: string, agentId: string | null) =>
    api.put<{ conversation: Conversation }>(`${CONVERSATIONS}/${conversationId}/assign`, {
      agentId
    })
  ),

  claim: mutates(CONVERSATIONS, (conversationId: string) =>
    api.put<{ conversation: Conversation }>(`${CONVERSATIONS}/${conversationId}/claim`)
  ),

  setDepartment: mutates(CONVERSATIONS, (conversationId: string, departmentId: string | null) =>
    api.put<{ conversation: Conversation }>(`${CONVERSATIONS}/${conversationId}/department`, {
      departmentId
    })
  ),

  setPriority: mutates(CONVERSATIONS, (conversationId: string, priority: Priority) =>
    api.put<{ conversation: Conversation }>(`${CONVERSATIONS}/${conversationId}/priority`, {
      priority
    })
  ),

  addNote: mutates(CONVERSATIONS, (conversationId: string, note: string) =>
    api.post<{ conversation: Conversation }>(`${CONVERSATIONS}/${conversationId}/notes`, { note })
  ),

  updateStatus: mutates(CONVERSATIONS, (conversationId: string, status: string) =>
    api.put<{ conversation: Conversation }>(`${CONVERSATIONS}/${conversationId}/status`, { status })
  ),

  delete: mutates(CONVERSATIONS, (siteId: string, conversationId: string) =>
    api.delete(`${CONVERSATIONS}/${siteId}/${conversationId}`)
  )
};

// --------------------------------------------------------------- departments

const DEPARTMENTS = '/departments';

export const departmentsAPI = {
  getAll: (siteId: string) => api.get<Department[]>(`${DEPARTMENTS}/site/${siteId}`),
  getOne: (departmentId: string) => api.get<Department>(`${DEPARTMENTS}/${departmentId}`),
  getStats: (departmentId: string) =>
    api.get<Record<string, unknown>>(`${DEPARTMENTS}/${departmentId}/stats`),

  create: mutates(DEPARTMENTS, (data: Partial<Department>) =>
    api.post<Department>(DEPARTMENTS, data)
  ),
  update: mutates(DEPARTMENTS, (departmentId: string, data: Partial<Department>) =>
    api.put<Department>(`${DEPARTMENTS}/${departmentId}`, data)
  ),
  delete: mutates(DEPARTMENTS, (departmentId: string) =>
    api.delete(`${DEPARTMENTS}/${departmentId}`)
  ),

  // Membership shows on the team page too, so both caches are dropped.
  addMember: mutates([DEPARTMENTS, '/team'], (departmentId: string, userId: string, role: string) =>
    api.post<Department>(`${DEPARTMENTS}/${departmentId}/members`, { userId, role })
  ),
  removeMember: mutates([DEPARTMENTS, '/team'], (departmentId: string, userId: string) =>
    api.delete(`${DEPARTMENTS}/${departmentId}/members/${userId}`)
  )
};

// ---------------------------------------------------------------------- team

const TEAM = '/team';

export const teamAPI = {
  getAll: (siteId?: string | null) => api.get<TeamMember[]>(TEAM, { params: { siteId } }),
  getOne: (userId: string) => api.get<TeamMember>(`${TEAM}/${userId}`),
  getStats: (userId: string) => api.get<Record<string, number>>(`${TEAM}/${userId}/stats`),

  create: mutates(TEAM, (data: Partial<TeamMember> & { password?: string }) =>
    api.post<TeamMember>(TEAM, data)
  ),
  update: mutates(TEAM, (userId: string, data: Partial<TeamMember>) =>
    api.put<TeamMember>(`${TEAM}/${userId}`, data)
  ),
  updateStatus: mutates(TEAM, (userId: string, status: string) =>
    api.patch<TeamMember>(`${TEAM}/${userId}/status`, { status })
  ),
  delete: mutates(TEAM, (userId: string) => api.delete(`${TEAM}/${userId}`)),

  /** The signed-in agent's own figures; the server scopes them, so no id is sent. */
  getMyPerformance: (range: string) =>
    api.get<{ range: string; days: number; performance: AgentPerformance }>(
      `${TEAM}/me/performance`,
      { params: { range }, cache: false }
    )
};

// ----------------------------------------------------------------- team chat

const TEAM_CHAT = '/team-chat';

export const teamChatAPI = {
  // None of these are cached: a chat list that is thirty seconds stale shows
  // messages as unread that the user has already read.
  getChats: () => api.get<TeamChat[]>(`${TEAM_CHAT}/chats`, { cache: false }),
  getMessages: (chatId: string, limit?: number) =>
    api.get<TeamChatMessage[]>(`${TEAM_CHAT}/chats/${chatId}/messages`, {
      params: { limit },
      cache: false
    }),
  getMembers: () => api.get<TeamChatParticipant[]>(`${TEAM_CHAT}/members`, { cache: false }),
  getUnread: () => api.get<{ unreadCount: number }>(`${TEAM_CHAT}/unread`, { cache: false }),

  createDirect: (targetUserId: string) =>
    api.post<TeamChat>(`${TEAM_CHAT}/chats/direct`, { targetUserId }),
  createGroup: (name: string, participantIds: string[]) =>
    api.post<TeamChat>(`${TEAM_CHAT}/chats/group`, { name, participantIds }),
  deleteMessage: (messageId: string) => api.delete(`${TEAM_CHAT}/messages/${messageId}`)
};

// ------------------------------------------------------------- widget config

const WIDGET_CONFIG = '/widget-config';

export const widgetConfigAPI = {
  getConfig: (siteId: string) =>
    api.get<{ config: WidgetConfig }>(`${WIDGET_CONFIG}/site/${siteId}`, { cache: false }),
  getPublicConfig: (siteKey: string) =>
    api.get<{ config: WidgetConfig }>(`${WIDGET_CONFIG}/public/${siteKey}`, { cache: false }),

  updateConfig: mutates(WIDGET_CONFIG, (siteId: string, data: Partial<WidgetConfig>) =>
    api.put<{ config: WidgetConfig }>(`${WIDGET_CONFIG}/site/${siteId}`, data)
  ),

  uploadLogo: mutates(WIDGET_CONFIG, (siteId: string, file: File) => {
    const formData = new FormData();
    formData.append('logo', file);
    return api.post<{ config: WidgetConfig; logoUrl: string }>(
      `${WIDGET_CONFIG}/site/${siteId}/logo`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  }),

  deleteLogo: mutates(WIDGET_CONFIG, (siteId: string) =>
    api.delete(`${WIDGET_CONFIG}/site/${siteId}/logo`)
  )
};

// ------------------------------------------------------------------------ AI

/** Every AI task reports which model answered and what it cost. */
export interface AIAttribution {
  model: string;
  usage: { inputTokens: number | null; outputTokens: number | null };
}

const AI_CONVERSATIONS = '/ai/conversations';

/**
 * A model call on a shared GPU can take longer than the panel's usual 15 s, so
 * AI tasks get their own ceiling. Callers pass an AbortSignal so a request the
 * agent no longer wants — they switched threads, pressed cancel — is dropped.
 */
export const AI_REQUEST_TIMEOUT_MS = 30 * 1000;
type AIRequest = Pick<AxiosRequestConfig, 'signal'>;
const aiConfig = (request?: AIRequest): AxiosRequestConfig => ({
  timeout: AI_REQUEST_TIMEOUT_MS,
  ...request
});

export const aiAPI = {
  // The model server and its key live only on the server; the browser never
  // sees either. `status` lets the UI hide the controls when AI is off and
  // show "loading" while the model warms up.
  status: () => api.get<AIStatus>('/ai/status', { cache: false }),

  summarize: (conversationId: string, request?: AIRequest) =>
    api.post<AIAttribution & { summary: string }>(
      `${AI_CONVERSATIONS}/${conversationId}/summary`,
      undefined,
      aiConfig(request)
    ),

  suggestReply: (conversationId: string, instruction?: string | null, request?: AIRequest) =>
    api.post<AIAttribution & { reply: string }>(
      `${AI_CONVERSATIONS}/${conversationId}/suggest-reply`,
      { instruction },
      aiConfig(request)
    ),

  rewrite: (conversationId: string, draft: string, tone: string, request?: AIRequest) =>
    api.post<AIAttribution & { reply: string }>(
      `${AI_CONVERSATIONS}/${conversationId}/rewrite`,
      { draft, tone },
      aiConfig(request)
    ),

  translate: (conversationId: string, text: string, targetLanguage: string, request?: AIRequest) =>
    api.post<AIAttribution & { text: string }>(
      `${AI_CONVERSATIONS}/${conversationId}/translate`,
      { text, targetLanguage },
      aiConfig(request)
    ),

  analyze: (conversationId: string, request?: AIRequest) =>
    api.post<AIAttribution & { analysis: Record<string, unknown> }>(
      `${AI_CONVERSATIONS}/${conversationId}/analyze`,
      undefined,
      aiConfig(request)
    ),

  knowledgeAnswer: (conversationId: string, question: string, request?: AIRequest) =>
    api.post<AIAttribution & { answered: boolean; answer: string | null; reason?: string }>(
      `${AI_CONVERSATIONS}/${conversationId}/knowledge-answer`,
      { question },
      aiConfig(request)
    ),

  /** "Take over" (human) and "give back to AI" (ai). */
  setOwner: mutates(CONVERSATIONS, (conversationId: string, owner: 'ai' | 'human') =>
    api.put<{ responseOwner: 'ai' | 'human'; aiControlVersion: number }>(
      `${AI_CONVERSATIONS}/${conversationId}/owner`,
      { owner }
    )
  )
};

// ----------------------------------------------------------------- reporting

export const analyticsAPI = {
  // Never cached: the page also refreshes it from realtime socket events, so a
  // cached answer would fight with the live one.
  getOverview: (range: string, siteId?: string | null) =>
    api.get<AnalyticsOverview>('/analytics/overview', { params: { range, siteId }, cache: false })
};

export const auditAPI = {
  getAll: (params?: Record<string, unknown>) =>
    api.get<{ docs: AuditLogEntry[]; total: number; page: number; limit: number }>('/audit', {
      params
    })
};

export default api;
