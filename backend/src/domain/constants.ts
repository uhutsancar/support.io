// The vocabulary of the product, in one place.
//
// Every one of these lists used to exist as a string literal in several files
// at once: the conversation statuses were written out in routes, in the socket
// handler, in the automation validator and in the model; the SLA default
// targets existed twice with the same numbers; the presence statuses appeared
// in four files in two different orders. A value that is spelled out in more
// than one place is a value that will eventually disagree with itself — adding
// a status meant finding every copy, and missing one produced a filter that
// silently matched nothing.
//
// The rule from here on: a domain value is declared once, here, and imported.
// The `as const` + derived-type pattern means the TypeScript union and the
// runtime array can never drift apart.

import type { Priority, PriorityTargets } from './types';

/** Turns a readonly literal array into a runtime membership test. */
function memberOf<T extends readonly string[]>(values: T) {
  const set = new Set<string>(values);
  return (value: unknown): value is T[number] => typeof value === 'string' && set.has(value);
}

// --------------------------------------------------------------- conversation

export const CONVERSATION_STATUSES = [
  'open',
  'assigned',
  'pending',
  'resolved',
  'closed',
  'unassigned'
] as const;

export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

/**
 * The statuses that still count as work in progress.
 *
 * This drives agent load, department counters and the SLA sweeper's queue, so
 * the three had to agree. They did not: some call sites included 'unassigned'
 * and others did not, which meant a conversation could be counted against an
 * agent's capacity by one code path and released by another.
 */
export const ACTIVE_CONVERSATION_STATUSES = [
  'open',
  'assigned',
  'pending',
  'unassigned'
] as const satisfies readonly ConversationStatus[];

export const isConversationStatus = memberOf(CONVERSATION_STATUSES);

export const isActiveConversationStatus = (status: unknown): boolean =>
  typeof status === 'string' &&
  (ACTIVE_CONVERSATION_STATUSES as readonly string[]).includes(status);

export const CONVERSATION_CHANNELS = ['web-chat', 'email', 'whatsapp', 'phone'] as const;
export type ConversationChannel = (typeof CONVERSATION_CHANNELS)[number];

// ------------------------------------------------------------------- priority

export const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

export const isPriority = memberOf(PRIORITIES);

/**
 * The SLA clocks a conversation starts with, in minutes, when its department
 * declares no policy of its own.
 *
 * These numbers existed twice — in the Conversation model's `sla` default and
 * again, spelled out as an object literal, in both the priority route and the
 * socket handler. Changing the model's defaults therefore had no effect on a
 * conversation whose priority was edited afterwards.
 */
export const DEFAULT_SLA_TARGETS = {
  firstResponse: { urgent: 5, high: 10, normal: 15, low: 30 },
  resolution: { urgent: 60, high: 120, normal: 240, low: 480 }
} as const satisfies { firstResponse: PriorityTargets; resolution: PriorityTargets };

/**
 * The first-response and resolution targets for one priority, preferring the
 * department's policy and falling back to the defaults above.
 *
 * Both call sites wrote this fallback out by hand, with subtly different
 * optional chaining; a department with `sla.enabled` but an empty
 * `firstResponse` map produced `undefined` targets in one of them.
 */
export function slaTargetsFor(
  priority: Priority,
  departmentSla?: {
    enabled?: boolean;
    firstResponse?: Partial<PriorityTargets>;
    resolution?: Partial<PriorityTargets>;
  } | null
): { firstResponseTarget: number; resolutionTarget: number } {
  const usePolicy = Boolean(departmentSla?.enabled);
  return {
    firstResponseTarget:
      (usePolicy ? departmentSla?.firstResponse?.[priority] : undefined) ??
      DEFAULT_SLA_TARGETS.firstResponse[priority],
    resolutionTarget:
      (usePolicy ? departmentSla?.resolution?.[priority] : undefined) ??
      DEFAULT_SLA_TARGETS.resolution[priority]
  };
}

// ------------------------------------------------------------------- presence

export const PRESENCE_STATUSES = ['online', 'offline', 'busy', 'away'] as const;
export type PresenceStatus = (typeof PRESENCE_STATUSES)[number];

export const isPresenceStatus = memberOf(PRESENCE_STATUSES);

/** An agent in one of these states is not expected to answer right now. */
export const AWAY_PRESENCE_STATUSES = [
  'offline',
  'away'
] as const satisfies readonly PresenceStatus[];

export const isAwayPresence = (status: unknown): boolean =>
  typeof status === 'string' && (AWAY_PRESENCE_STATUSES as readonly string[]).includes(status);

// ---------------------------------------------------------------------- roles

/** Accounts in the `users` table. `owner` exists only here. */
export const USER_ROLES = ['owner', 'admin', 'manager', 'agent', 'viewer'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Accounts in the `teams` table: invited agents, never an owner. */
export const TEAM_ROLES = ['admin', 'manager', 'agent'] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const isTeamRole = memberOf(TEAM_ROLES);

// ---------------------------------------------------------------------- plans

export const PLAN_TYPES = ['FREE', 'PRO', 'ENTERPRISE'] as const;
export type PlanType = (typeof PLAN_TYPES)[number];

export const isPlanType = memberOf(PLAN_TYPES);

// -------------------------------------------------------------------- message

export const MESSAGE_SENDER_TYPES = ['visitor', 'agent', 'bot'] as const;
export type MessageSenderType = (typeof MESSAGE_SENDER_TYPES)[number];

export const MESSAGE_TYPES = ['text', 'image', 'file', 'system'] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

/** The subset a client is allowed to send; 'system' is written by the server. */
export const CLIENT_MESSAGE_TYPES = [
  'text',
  'image',
  'file'
] as const satisfies readonly MessageType[];

export const isClientMessageType = memberOf(CLIENT_MESSAGE_TYPES);

// ------------------------------------------------------------ AI assistant

/**
 * Who may answer on a site's behalf: nobody, agents with a copilot, or the
 * assistant itself. The FAQ keyword bot keeps running in the first two and
 * steps aside in `auto`, so a visitor never gets two automatic answers.
 */
export const AI_MODES = ['off', 'copilot', 'auto'] as const;
export type AIMode = (typeof AI_MODES)[number];
export const isAIMode = memberOf(AI_MODES);

/** Who answers a conversation right now; independent of who it is assigned to. */
export const RESPONSE_OWNERS = ['ai', 'human'] as const;
export type ResponseOwner = (typeof RESPONSE_OWNERS)[number];

export const AI_ANSWER_LENGTHS = ['short', 'normal'] as const;
export type AIAnswerLength = (typeof AI_ANSWER_LENGTHS)[number];
export const isAIAnswerLength = memberOf(AI_ANSWER_LENGTHS);

export const AI_TONES = ['professional', 'friendly'] as const;
export type AITone = (typeof AI_TONES)[number];
export const isAITone = memberOf(AI_TONES);

// ----------------------------------------------------------------------- deal

export const DEAL_STAGES = ['new', 'potential', 'quoted', 'negotiation', 'won', 'lost'] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

export const isDealStage = memberOf(DEAL_STAGES);
