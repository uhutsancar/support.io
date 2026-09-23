// The shapes the API actually returns.
//
// These mirror the backend's models (backend/src/models, backend/src/types),
// but describe the JSON on the wire: ids are strings, dates arrive as ISO
// strings, and a reference is either its id or the populated document
// depending on whether the endpoint populated it.

/**
 * A reference column.
 *
 * Unpopulated it holds the 24-character id; after the endpoint populates it the
 * same field holds the referenced document, or a projection of it. Both shapes
 * are read at the same call sites — a row renders `assignedAgent.name` from a
 * populated list and passes `assignedAgent` as an id elsewhere — so the type
 * stays deliberately open rather than forcing a narrowing cast into every
 * render. The type argument records which document it points at. The backend's
 * own `Ref` (backend/src/db/model.ts) is defined the same way for the same
 * reason.
 */
// `TDoc | any` is `any`. Naming the parameter in the definition is what keeps
// it from reading as dead — no suppression comment needed, and the signature
// still records which document a column points at.
export type Ref<TDoc> = TDoc | any;

/** The id behind a reference, whether or not the endpoint populated it. */
export function refId<TDoc extends { _id?: string }>(
  ref: Ref<TDoc> | null | undefined
): string | null {
  if (!ref) return null;
  return typeof ref === 'string' ? ref : (ref._id ?? null);
}

export type Priority = 'low' | 'normal' | 'high' | 'urgent';
export type ConversationStatus =
  'open' | 'assigned' | 'pending' | 'resolved' | 'closed' | 'unassigned';
export type PresenceStatus = 'online' | 'offline' | 'away' | 'busy';
export type PlanType = 'FREE' | 'PRO' | 'ENTERPRISE';
export type SlaState = 'pending' | 'met' | 'breached';

export interface Organization {
  _id: string;
  name: string;
  planType: PlanType;
  isActive: boolean;
}

/** The signed-in account, as /auth/me returns it. */
export interface CurrentUser {
  id: string;
  _id?: string;
  email: string;
  name: string;
  role: string;
  avatar: string | null;
  status: PresenceStatus;
  isOnboarded?: boolean;
  organizationId?: string | null;
  userType?: 'user' | 'team';
  organization?: {
    id: string;
    name: string;
    planType: PlanType;
  } | null;
  permissions?: Record<string, boolean>;
  [extra: string]: unknown;
}

export interface Site {
  _id: string;
  name: string;
  domain: string;
  siteKey: string;
  organizationId: string;
  isActive: boolean;
  widgetSettings?: Record<string, unknown>;
  aiSettings?: Record<string, unknown>;
  installation?: {
    verifiedAt?: string | null;
    lastSeenAt?: string | null;
    origin?: string | null;
    path?: string | null;
    sdkVersion?: string | null;
  };
  createdAt?: string;
  updatedAt?: string;
}

/** An agent row from /team. Both tables (users, teams) render the same way. */
export interface TeamMember {
  _id: string;
  name: string;
  email: string;
  role: string;
  avatar: string | null;
  status: PresenceStatus;
  isActive: boolean;
  skills?: string[];
  maxCapacity?: number;
  currentLoad?: number;
  phone?: string | null;
  bio?: string | null;
  departments?: Array<{ departmentId: Ref<Department>; role: string }>;
  assignedSites?: Array<Ref<Site>>;
  permissions?: Record<string, boolean>;
  stats?: {
    totalConversations?: number;
    activeConversations?: number;
    resolvedConversations?: number;
    averageResponseTime?: number;
    satisfactionRate?: number;
  };
  createdAt?: string;
  [extra: string]: unknown;
}

export interface DepartmentMember {
  userId: Ref<TeamMember>;
  role: string;
  addedAt?: string;
}

export interface BusinessHoursDay {
  start: string;
  end: string;
  enabled: boolean;
}

export interface DepartmentSla {
  enabled: boolean;
  firstResponse: Record<Priority, number>;
  resolution: Record<Priority, number>;
  onlyBusinessHours: boolean;
}

export interface Department {
  _id: string;
  name: string;
  description: string;
  siteId: string;
  color: string;
  icon: string;
  isActive: boolean;
  requiredSkills?: string[];
  members: DepartmentMember[];
  autoAssignRules?: { enabled: boolean; strategy: string };
  businessHours?: {
    enabled: boolean;
    timezone: string;
    schedule: Record<string, BusinessHoursDay>;
  };
  sla?: DepartmentSla;
  stats?: {
    totalConversations?: number;
    activeConversations?: number;
    resolvedConversations?: number;
    averageResponseTime?: number;
    slaMetrics?: Record<string, number>;
  };
  createdAt?: string;
}

export interface ConversationSla {
  firstResponseTarget: number;
  resolutionTarget: number;
  firstResponseStatus: SlaState;
  resolutionStatus: SlaState;
  firstResponseTimeRemaining: number | null;
  resolutionTimeRemaining: number | null;
  firstResponseBreachedAt: string | null;
  resolutionBreachedAt: string | null;
}

export interface ConversationRating {
  score: number | null;
  feedback: string | null;
  ratedAt: string | null;
}

export interface InternalNote {
  _id?: string;
  userId: Ref<TeamMember> | null;
  note: string;
  createdAt: string;
}

export interface Conversation {
  _id: string;
  ticketNumber?: number;
  ticketId?: string;
  siteId: string;
  organizationId?: string;
  visitorId: string;
  visitorName: string;
  visitorEmail: string | null;
  department: Ref<Department> | null;
  assignedAgent: Ref<TeamMember> | null;
  assignedAt: string | null;
  assignedBy: Ref<TeamMember> | null;
  status: ConversationStatus;
  priority: Priority;
  unreadCount: number;
  tags: string[];
  requiredSkills?: string[];
  sla: ConversationSla;
  rating?: ConversationRating;
  channel: string;
  currentPage: string;
  metadata?: Record<string, unknown>;
  internalNotes?: InternalNote[];
  /** The client patches this with a Date when a message arrives over the socket. */
  lastMessageAt: string | Date;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt?: string;
  /** Added by the list endpoint so the row can show a preview. */
  lastMessage?: Message | null;
  [extra: string]: unknown;
}

export interface MessageFile {
  filename?: string;
  originalName?: string;
  mimeType?: string;
  size?: number;
  url?: string;
}

export interface Message {
  _id: string;
  conversationId: string;
  senderType: 'visitor' | 'agent' | 'bot';
  senderId: string;
  senderName: string;
  content: string;
  messageType: 'text' | 'image' | 'file' | 'system';
  fileData?: MessageFile | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  /** Echoed back so an optimistic bubble can be reconciled. */
  clientMessageId?: string;
  [extra: string]: unknown;
}

export interface FAQ {
  _id: string;
  siteId: string;
  question: string;
  answer: string;
  category: string;
  keywords: string[];
  pageSpecific: string;
  isActive: boolean;
  order: number;
  viewCount: number;
  helpfulCount: number;
  createdAt?: string;
}

export interface Visitor {
  _id: string;
  siteId: string;
  visitorId: string;
  ip: string | null;
  country: string | null;
  browser: string | null;
  os: string | null;
  currentPage: string;
  referrer: string | null;
  isActive: boolean;
  lastActiveAt: string;
}

export type DealStage = 'new' | 'potential' | 'quoted' | 'negotiation' | 'won' | 'lost';

export interface Deal {
  _id: string;
  title: string;
  value: number;
  currency: string;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  stage: DealStage;
  assignedTo: Ref<TeamMember> | null;
  createdBy: Ref<TeamMember>;
  order: number;
  notes: string;
  createdAt?: string;
}

export interface AutomationRule {
  _id: string;
  siteId: string;
  name: string;
  isActive: boolean;
  priority: number;
  triggerType: string;
  conditions: Array<{ field: string; operator: string; value: unknown }>;
  conditionOperator: string;
  actions: Array<{ type: string; payload?: Record<string, unknown> }>;
  metrics?: { executionsCount: number; successCount: number; failureCount: number };
  createdAt?: string;
}

export interface ProactiveRule {
  _id: string;
  siteId: string;
  name: string;
  isActive: boolean;
  triggerCondition: Record<string, unknown>;
  audienceContext: Record<string, unknown>;
  action: Record<string, unknown>;
  frequencyControl: { triggerOncePerVisitor: boolean; cooldownMinutes: number };
  metrics?: { triggersCount: number; conversionsCount: number };
  createdAt?: string;
}

export interface AuditLogEntry {
  _id: string;
  organizationId: string;
  userId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

/** One chat in the team-chat sidebar, with participants already resolved. */
/** The denormalised preview the chat list shows under each row. */
export interface TeamChatPreview {
  content?: string;
  senderId?: string;
  senderName?: string;
  createdAt?: string;
  timestamp?: string;
  [extra: string]: unknown;
}

export interface TeamChat {
  _id: string;
  chatId: string;
  chatType: 'direct' | 'group';
  groupName: string | null;
  createdBy: string | null;
  participants: Array<TeamChatParticipant | string>;
  lastMessage?: TeamChatPreview | null;
  unreadCount?: number;
  updatedAt?: string;
  [extra: string]: unknown;
}

export interface TeamChatParticipant {
  _id: string;
  name: string;
  role: string;
  avatar?: string | null;
  status: PresenceStatus;
  email?: string;
}

export interface TeamChatMessage {
  _id: string;
  chatId: string;
  chatType: 'direct' | 'group';
  senderId: string;
  senderName: string;
  content: string;
  messageType: 'text' | 'system';
  groupName?: string | null;
  readBy?: string[];
  createdAt: string;
  [extra: string]: unknown;
}

// --- widget configuration ---------------------------------------------------

export interface WidgetColors {
  primary: string;
  header: string;
  background: string;
  text: string;
  textSecondary: string;
  border: string;
  visitorMessageBg: string;
  agentMessageBg: string;
}

export interface WidgetBranding {
  logo: string | null;
  logoWidth: number;
  logoHeight: number;
  brandName: string;
  showBrandName: boolean;
}

export interface WidgetButton {
  position: string;
  size: string;
  icon: string;
  showLabel: boolean;
  labelText: string;
  borderRadius: number;
  shadow: boolean;
  shadowColor: string;
}

export interface WidgetWindow {
  width: number;
  height: number;
  borderRadius: number;
  headerHeight: number;
  showHeader: boolean;
  showCloseButton: boolean;
}

export interface WidgetMessages {
  welcomeMessage: string;
  placeholderText: string;
  showTimestamps: boolean;
  showAvatars: boolean;
  messageBubbleRadius: number;
}

export interface WidgetBehavior {
  autoOpen: boolean;
  autoOpenDelay: number;
  showOnPages: string[];
  hideOnPages: string[];
  showUnreadBadge: boolean;
  enableSound: boolean;
  enableNotifications: boolean;
}

export interface WidgetTypography {
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
}

export interface WidgetAdvanced {
  customCSS: string | null;
  zIndex: number;
  animationSpeed: string;
}

export interface WidgetConfig {
  _id?: string;
  siteId?: string;
  colors: WidgetColors;
  branding: WidgetBranding;
  button: WidgetButton;
  window: WidgetWindow;
  messages: WidgetMessages;
  behavior: WidgetBehavior;
  typography: WidgetTypography;
  advanced: WidgetAdvanced;
  isActive?: boolean;
}

// --- analytics --------------------------------------------------------------

export interface AnalyticsStats {
  total: number;
  openTickets: number;
  resolved: number;
  unassigned: number;
  slaBreaches: number;
  avgFirstResponse: number | null;
  avgResolution: number | null;
  csat: number | null;
  rated: number;
  [extra: string]: unknown;
}

export interface AnalyticsPoint {
  [field: string]: unknown;
}

export interface AnalyticsOverview {
  range: string;
  days: number;
  generatedAt: string;
  stats: AnalyticsStats;
  dailyTickets: AnalyticsPoint[];
  responseTimeByHour: AnalyticsPoint[];
  channelDistribution: AnalyticsPoint[];
  slaCompliance: Record<string, number>;
  departmentStats: AnalyticsPoint[];
  agentPerformance: AnalyticsPoint[];
  byStatus: Array<{ status: string; value: number }>;
  byPriority: Array<{ priority: string; value: number }>;
}

export interface AgentPerformance {
  totalResolved: number;
  avgResponseTime: number | null;
  avgResolutionTime: number | null;
  satisfaction: number | null;
  daily?: AnalyticsPoint[];
  trend?: AnalyticsPoint[];
  active?: number;
  [extra: string]: unknown;
}

/** What /conversations/:siteId returns: one page plus the strip counters. */
export interface ConversationPage {
  conversations: Conversation[];
  nextCursor?: string | null;
  counts?: Record<string, number> | null;
}

// ---------------------------------------------------------------------------
// Editor form shapes
//
// A form is not the same thing as the record it produces: `value` is the text
// the user has typed until it is submitted, and a half-written rule has fields
// the API would reject. These were declared inside their page components, which
// meant nothing outside those functions could name them — not the submit
// handler's payload type, not a test, not a shared form component.
// ---------------------------------------------------------------------------

/** One automation rule as its editor holds it while it is being written. */
export interface RuleForm {
  siteId: string;
  name: string;
  isActive: boolean;
  priority: number;
  triggerType: string;
  conditionOperator: string;
  conditions: Array<{ field: string; operator: string; value: string; [extra: string]: string }>;
  /** The payload's keys depend on the action: `text`, `tag`, `status` and so on. */
  actions: Array<{ type: string; payload: Record<string, string> }>;
}

/** The new-deal form; `value` stays raw input text until it is submitted. */
export interface DealForm {
  title: string;
  value: string | number;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  stage: string;
  notes: string;
}
