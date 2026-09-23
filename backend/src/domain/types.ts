// Shapes that live inside `json` columns, shared by more than one model.
//
// A json column is stored and read as a whole, so these interfaces describe
// exactly what the column holds — that is where most of the accidental typos
// used to hide.

import type { AIAnswerLength, AIMode, AITone } from './constants';

export type Priority = 'low' | 'normal' | 'high' | 'urgent';

/** A target in minutes per priority. */
export type PriorityTargets = Record<Priority, number>;

export type SlaStatus = 'pending' | 'met' | 'breached';

/** The per-conversation SLA state, recalculated by Conversation#calculateSLA. */
export interface ConversationSla {
  firstResponseTarget: number;
  resolutionTarget: number;
  firstResponseStatus: SlaStatus;
  resolutionStatus: SlaStatus;
  firstResponseTimeRemaining: number | null;
  resolutionTimeRemaining: number | null;
  firstResponseBreachedAt: Date | null;
  resolutionBreachedAt: Date | null;
}

/** The per-department SLA policy conversations inherit from. */
export interface DepartmentSla {
  enabled: boolean;
  firstResponse: PriorityTargets;
  resolution: PriorityTargets;
  onlyBusinessHours: boolean;
}

export type Weekday =
  'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface BusinessHoursDay {
  start: string;
  end: string;
  enabled: boolean;
}

export interface BusinessHours {
  enabled: boolean;
  timezone: string;
  schedule: Record<Weekday, BusinessHoursDay>;
}

export interface AutoAssignRules {
  enabled: boolean;
  strategy: 'round-robin' | 'least-busy' | 'skill-based' | string;
}

export interface ConversationRating {
  score: number | null;
  feedback: string | null;
  ratedAt: Date | null;
}

export interface AgentStats {
  totalConversations: number;
  activeConversations: number;
  resolvedConversations: number;
  averageResponseTime: number;
  satisfactionRate?: number;
  /** Written by the socket handler when it folds a new reply into the average. */
  totalResponses?: number;
}

export interface DepartmentSlaMetrics {
  firstResponseMet: number;
  firstResponseBreached: number;
  resolutionMet: number;
  resolutionBreached: number;
  averageFirstResponseTime: number;
  averageResolutionTime: number;
}

export interface DepartmentStats {
  totalConversations: number;
  activeConversations: number;
  /** Written by the demo seeder alongside the live counters. */
  resolvedConversations?: number;
  averageResponseTime: number;
  slaMetrics: DepartmentSlaMetrics;
}

export interface UserPermissions {
  canManageTeam: boolean;
  canManageDepartments: boolean;
  canViewAllConversations: boolean;
  canAssignConversations: boolean;
  canDeleteConversations: boolean;
}

export interface TeamPermissions {
  canManageConversations: boolean;
  canManageDepartments: boolean;
  canManageTeam: boolean;
  canManageSites: boolean;
  canViewAnalytics: boolean;
  canManageFAQs: boolean;
}

export interface UserPreferences {
  autoAcceptAssignments: boolean;
  maxActiveConversations: number;
  notificationSound: boolean;
}

/** The widget settings kept on the site row (the widget's own config is richer). */
export interface SiteWidgetSettings {
  position: string;
  primaryColor: string;
  welcomeMessage: string;
  placeholderText: string;
  showOnPages: string[];
  autoOpen: boolean;
  autoOpenDelay: number;
}

/**
 * How the assistant behaves on one site. The model itself is chosen by the
 * server, never by a tenant, so there is no model field here.
 */
export interface SiteAiSettings {
  mode: AIMode;
  answerLength: AIAnswerLength;
  tone: AITone;
  /** Automatic replies one conversation may get before it goes to a person. */
  maxBotReplies: number;
  /** A visitor message containing any of these goes to a person unread by the model. */
  blockedTerms: string[];
  /** Null: the site's name is used. */
  botName: string | null;
  /** Null: the built-in handoff text is used. */
  handoffMessage: string | null;
}

/**
 * The shop's side of identity verification and order lookup, as stored.
 * Both secrets are sealed with config/secretBox.ts; they never leave the
 * server — the site's JSON form replaces this block (models/Site.ts).
 */
export interface SiteIntegrations {
  identitySecret: string | null;
  orderLookup: {
    enabled: boolean;
    url: string | null;
    signingSecret: string | null;
  };
}

/** What an automatic reply records about itself. Never the prompt or raw output. */
export interface MessageAiMetadata {
  decision: string;
  /** Why the visitor was handed to a person, when they were. */
  reason?: string | null;
  sourceIds: string[];
  /** The questions of the FAQ entries the answer was drawn from, for the inbox. */
  sources?: string[];
  promptVersion: string;
  durationMs: number;
}

/** Proof that the widget really loaded on the customer's site. */
export interface SiteInstallation {
  verifiedAt?: Date | string | null;
  lastSeenAt?: Date | string | null;
  url?: string | null;
  origin?: string | null;
  /** Only the path is kept; a query string can carry personal data. */
  path?: string | null;
  sdkVersion?: string | null;
  userAgent?: string | null;
}

/** A file attached to a message, after its upload token was verified. */
export interface MessageFileData {
  filename?: string;
  originalName?: string;
  mimeType?: string;
  size?: number;
  url?: string;
  key?: string;
}

export interface AutomationMetrics {
  executionsCount: number;
  successCount: number;
  failureCount: number;
}

export interface AutomationCondition {
  field: string;
  operator: string;
  value: unknown;
}

/** The parameters an action carries, keyed by what that action needs. */
export interface AutomationActionPayload {
  text?: string;
  departmentId?: string;
  agentId?: string;
  tag?: string;
  status?: string;
  note?: string;
  [param: string]: unknown;
}

export interface AutomationAction {
  type: string;
  payload?: AutomationActionPayload;
}

/** What a trigger hands the engine. */
export interface AutomationEvent {
  siteId?: string;
  organizationId?: string;
  triggerType: string;
  /** The conversation the rule acts on. */
  targetId?: string;
  payload?: Record<string, unknown>;
}

export interface ProactiveTriggerCondition {
  /** 'any' | 'exact' | 'contains' | 'regex' */
  urlMatch: string;
  /** The URL the match is made against, for everything but 'any'. */
  urlValue?: string;
  timeThresholdSeconds: number;
  scrollPercentage: number;
  /** Which visitor event arms the rule. */
  eventType?: string;
  /** For 'custom_event', the name the widget reports. */
  customEventName?: string;
  [extra: string]: unknown;
}

export interface ProactiveAudienceContext {
  deviceType: 'all' | 'desktop' | 'mobile' | 'tablet' | string;
  [extra: string]: unknown;
}

export interface ProactiveFrequencyControl {
  triggerOncePerVisitor: boolean;
  cooldownMinutes: number;
}

export interface ProactiveMetrics {
  triggersCount: number;
  conversionsCount: number;
}
