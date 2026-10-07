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
import type { AxiosResponse } from 'axios';
import type {
  AssistantOverview,
  BillingOverview,
  CheckoutSession,
  AssistantStatus,
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
  WidgetConfig,
  Invitation,
  PlanInfo
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
  /** The Cloudflare Turnstile answer, when the server asks for one. */
  turnstileToken?: string;
  locale?: string;
}

/**
 * What /auth/login answers: a session, or — with two-step sign-in on — a
 * five-minute token to trade for one at /auth/login/2fa.
 */
export type LoginResponse = AuthResponse | { mfaRequired: true; mfaToken: string };

export const isPendingSecondStep = (
  data: LoginResponse
): data is { mfaRequired: true; mfaToken: string } => 'mfaRequired' in data && data.mfaRequired;

/** Public settings the sign-up and sign-in forms read before anything else. */
export interface AuthConfig {
  turnstileSiteKey: string | null;
  passwordMinLength: number;
}

/** A site's chat behaviour (backend services/chatSettings.ts). */
export interface ChatSettings {
  missedChat: { delayMinutes: number; notify: 'all' | 'assigned' | 'off' };
  offlineForm: boolean;
  emailReplies: boolean;
  preChat: {
    mode: 'off' | 'optional' | 'required';
    name: boolean;
    email: boolean;
    phone: boolean;
    customFields: string[];
    department: boolean;
    consent: { mode: 'off' | 'optional' | 'required'; policyUrl: string };
  };
  csat: { enabled: boolean; style: 'thumbs' | 'stars'; askByEmail: boolean };
  transcript: boolean;
  spamMode: boolean;
}

export interface NotificationPreferences {
  missedChatEmail: 'instant' | 'hourly' | 'off';
  desktop: { newConversation: boolean; assigned: boolean; allMessages: boolean };
  notificationSound: boolean;
  /** The set-up mails of the first month (PRD-08). */
  activationEmails: boolean;
  locale: 'tr' | 'en';
}

export interface MfaStatus {
  enabled: boolean;
  recoveryCodesLeft: number;
  enforcedByOrganization: boolean;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export const authAPI = {
  config: () => api.get<AuthConfig>('/auth/config'),
  // E-mail first: the answer is the same for every address and starts no
  // session; the link in the mail does (verifyEmail below).
  register: (data: RegisterPayload) => api.post<{ verificationSent: true }>('/auth/register', data),
  login: (data: LoginPayload) => api.post<LoginResponse>('/auth/login', data),
  loginSecondStep: (data: { mfaToken: string; code?: string; recoveryCode?: string }) =>
    api.post<AuthResponse>('/auth/login/2fa', data),
  resendVerificationLink: (email: string, locale?: string) =>
    api.post<{ verificationSent: true }>('/auth/resend-verification-link', { email, locale }),
  me: () => api.get<{ user: CurrentUser }>('/auth/me'),
  logout: () => api.post('/auth/logout'),
  updateStatus: (data: { status: string }) => api.put('/auth/status', data),
  // The owner confirms with the password: it deletes the whole workspace.
  deleteAccount: (password?: string) =>
    api.delete('/auth/account', password ? { data: { password } } : undefined),

  // E-mail links (plan §7.2). The answers never say whether an address has
  // an account; the locale picks the mail's language.
  forgotPassword: (email: string, locale?: string) =>
    api.post<{ message: string }>('/auth/forgot-password', { email, locale }),
  resetPassword: (token: string, password: string) =>
    api.post<{ reset: boolean }>('/auth/reset-password', { token, password }),
  // Opening the link signs the browser in (unless the account has two-step
  // sign-in, which then goes through the ordinary sign-in).
  verifyEmail: (token: string) =>
    api.post<Partial<AuthResponse> & { verified?: boolean }>('/auth/verify-email', { token }),
  confirmEmailChange: (token: string) =>
    api.post<{ changed: boolean; email: string }>('/auth/confirm-email-change', { token }),

  // The signed-in account's own security (routes/account.ts).
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<{ changed: boolean; csrfToken: string }>('/auth/change-password', {
      currentPassword,
      newPassword
    }),
  changeEmail: (newEmail: string, password: string, locale?: string) =>
    api.post<{ message: string }>('/auth/change-email', { newEmail, password, locale }),
  revokeSessions: () => api.post<{ revoked: boolean; csrfToken: string }>('/auth/sessions/revoke'),
  mfaStatus: () => api.get<MfaStatus>('/auth/2fa', { cache: false }),
  mfaSetup: (password: string) =>
    api.post<{ secret: string; otpauthUri: string }>('/auth/2fa/setup', { password }),
  mfaConfirm: (code: string) =>
    api.post<{ enabled: true; recoveryCodes: string[]; csrfToken: string }>('/auth/2fa/confirm', {
      code
    }),
  mfaDisable: (data: { password: string; code?: string; recoveryCode?: string }) =>
    api.post<{ enabled: false }>('/auth/2fa/disable', data),
  mfaRecoveryCodes: (data: { password: string; code?: string; recoveryCode?: string }) =>
    api.post<{ recoveryCodes: string[] }>('/auth/2fa/recovery-codes', data),
  preferences: () =>
    api.get<{ preferences: NotificationPreferences }>('/auth/preferences', { cache: false }),
  updatePreferences: (prefs: Partial<NotificationPreferences>) =>
    api.put<{ preferences: NotificationPreferences }>('/auth/preferences', prefs),
  setOrganizationSecurity: (enforce2fa: boolean) =>
    api.put<{ enforce2fa: boolean }>('/auth/organization-security', { enforce2fa }),
  resendVerification: (locale?: string) =>
    api.post<{ sent?: boolean; alreadyVerified?: boolean }>('/auth/resend-verification', {
      locale
    })
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

  // Missed-chat mails, the offline and pre-chat forms, ratings, transcripts.
  getChatSettings: (siteId: string) =>
    api.get<{ settings: ChatSettings }>(`/sites/${siteId}/chat-settings`, { cache: false }),
  updateChatSettings: (siteId: string, settings: Partial<ChatSettings>) =>
    api.put<{ settings: ChatSettings }>(`/sites/${siteId}/chat-settings`, settings),

  // The integration secrets come back once, in the response that creates them;
  // the site itself only ever says whether one is set.
  generateIdentitySecret: mutates('/sites', (siteId: string) =>
    api.post<{ site: Site; secret: string }>(`/sites/${siteId}/integrations/identity-secret`)
  )
};

// --------------------------------------------------------------------- files

export const filesAPI = {
  /**
   * An attachment an agent sends from the inbox. Goes through the panel's own
   * session (cookie + CSRF), for a site the agent may work on; the widget's
   * public upload takes a visitor's widget session instead.
   */
  agentUpload: (siteId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<{ file: Record<string, unknown> }>('/files/agent-upload', form, {
      params: { siteId },
      // axios drops the JSON content type for FormData in the browser, so the
      // browser writes the multipart boundary itself.
      timeout: 60 * 1000
    });
  }
};

// ------------------------------------------------------------------ visitors

/** A block still in force on a site (SEC-09). */
export interface VisitorBlock {
  _id: string;
  visitorId: string | null;
  reason: string | null;
  expiresAt: string;
  createdAt: string;
}

export const visitorsAPI = {
  // Never cached: this is a live presence list, and a thirty-second-old answer
  // is worse than none.
  getAll: (siteId: string, active = true) =>
    api.get<Visitor[]>(`/visitors/site/${siteId}`, { params: { active }, cache: false }),
  block: (body: { conversationId: string; days: number; reason?: string }) =>
    api.post<{ id: string; days: number }>('/visitors/block', body),
  blocks: (siteId: string) =>
    api.get<{ blocks: VisitorBlock[] }>(`/visitors/blocks/${siteId}`, { cache: false }),
  unblock: (id: string) => api.delete(`/visitors/blocks/${id}`)
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
    // Never cached: the page re-reads the open thread after every realtime
    // change to it, and a 30-second-old copy would undo that change — an
    // agent's reply taking the thread from the assistant showed the assistant
    // still answering until the cache expired.
    return api.get<{ conversation: Conversation; messages: Message[]; hasMore: boolean }>(
      `${CONVERSATIONS}/${siteId}/${conversationId}`,
      { cache: false }
    );
  },

  /**
   * The messages written after `afterId` — what the thread missed while the
   * socket was down. Never cached.
   */
  messagesAfter: (siteId: string, conversationId: string, afterId: string) =>
    api.get<{ messages: Message[]; hasMore: boolean }>(
      `${CONVERSATIONS}/${siteId}/${conversationId}/messages`,
      { params: { after: afterId, limit: 100 }, cache: false }
    ),

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

  /** Takes the conversation from the FAQ assistant; a person answers from now on. */
  takeOver: mutates(CONVERSATIONS, (conversationId: string) =>
    api.put<{ responseOwner: 'human' }>(`${CONVERSATIONS}/${conversationId}/take-over`)
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

// --------------------------------------------------------------- invitations

const INVITATIONS = '/invitations';

export const invitationsAPI = {
  list: () => api.get<{ invitations: Invitation[] }>(INVITATIONS, { cache: false }),
  create: (data: { email: string; role: string; assignedSites?: string[]; locale?: string }) =>
    api.post<{ invitation: Invitation; sent: boolean }>(INVITATIONS, data),
  resend: (id: string, locale?: string) =>
    api.post<{ invitation: Invitation; sent: boolean }>(`${INVITATIONS}/${id}/resend`, { locale }),
  revoke: (id: string) => api.delete(`${INVITATIONS}/${id}`),
  /** What an invitation link is for; needs no account. */
  preview: (token: string) =>
    api.get<{ email: string; role: string; organization: string | null; expiresAt: string }>(
      `${INVITATIONS}/accept`,
      { params: { token }, cache: false }
    ),
  /** Accepting creates the account and signs it in (the session cookie is set). */
  accept: (token: string, name: string, password: string) =>
    api.post(`${INVITATIONS}/accept`, { token, name, password })
};

// --------------------------------------------------------------------- plans

export const plansAPI = {
  /** The plan table the server enforces; the pricing page renders it. */
  list: () => api.get<{ plans: PlanInfo[] }>('/plans')
};

export const billingAPI = {
  /** Plan, usage and subscription; the owner only. Never cached. */
  overview: () => api.get<BillingOverview>('/billing', { cache: false }),
  /** What Paddle.js needs to open checkout; the server signs the reference. */
  checkout: (plan: 'PRO' | 'ENTERPRISE', cycle: 'monthly' | 'yearly') =>
    api.post<CheckoutSession>('/billing/checkout', { plan, cycle }),
  /** A one-off link to Paddle's customer portal. */
  portal: () => api.post<{ url: string }>('/billing/portal')
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

// ----------------------------------------------------------------- assistant

export const assistantAPI = {
  /** Whether this server has a Gemini key; the site switch depends on it. */
  status: () => api.get<AssistantStatus>('/assistant/status', { cache: false }),
  /** Every site's switch, FAQ count and the last 30 days of activity. */
  overview: () => api.get<AssistantOverview>('/assistant/overview', { cache: false })
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
