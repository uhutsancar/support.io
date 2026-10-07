// What each socket event may carry (plan v10 SEC-15).
//
// Every event a client sends passes one validator before its handler runs,
// as REST requests pass express-validator: the payload must be an object (or
// nothing), only the fields listed for the event survive, and each has a type
// and a length. A string over its limit is refused — a message over
// MAX_MESSAGE_LENGTH characters is not cut, it is sent back — except where the old code chose to
// cut on purpose (what the browser reports about itself), so a long
// user-agent never costs a visitor their chat. `null` counts as "not sent".
//
// An event this server does not know is refused as well. The handlers keep
// their own checks; this layer only guarantees that what reaches them has
// the shape their types describe, with nothing extra hiding in it.

import { CLIENT_MESSAGE_TYPES, MAX_MESSAGE_LENGTH, PRIORITIES } from '../domain';
import type { Socket } from 'socket.io';

type Rule =
  | { t: 'string'; max: number; cut?: boolean }
  | { t: 'number'; min: number; max: number }
  | { t: 'boolean' }
  | { t: 'enum'; values: readonly string[] }
  | { t: 'object'; fields: Shape }
  /** Free keys (custom attributes, form fields), each with a primitive value. */
  | { t: 'record'; maxKeys: number; keyMax: number; valueMax: number };

type Shape = Record<string, Rule>;

const str = (max: number): Rule => ({ t: 'string', max });
const cut = (max: number): Rule => ({ t: 'string', max, cut: true });
const ID = str(64);

const CONVERSATION: Shape = { conversationId: ID };

const FILE: Rule = {
  t: 'object',
  fields: {
    uploadToken: str(2048),
    key: str(512),
    filename: str(512),
    originalName: str(255),
    mimeType: str(127),
    size: { t: 'number', min: 0, max: 1024 * 1024 * 1024 },
    url: str(2048),
    previewUrl: str(4096)
  }
};

const SEND_MESSAGE: Shape = {
  conversationId: ID,
  content: str(MAX_MESSAGE_LENGTH),
  messageType: { t: 'enum', values: CLIENT_MESSAGE_TYPES },
  fileData: FILE,
  clientMessageId: str(100),
  // Older widgets send it; the server names the sender itself.
  senderName: cut(100)
};

/** The visitor's widget, /widget. */
export const WIDGET_EVENTS: Record<string, Shape> = {
  'join-conversation': {
    visitorName: cut(100),
    visitorEmail: cut(254),
    currentPage: cut(2048),
    userId: str(256),
    userHash: str(256),
    metadata: {
      t: 'object',
      fields: {
        browser: cut(100),
        os: cut(100),
        country: cut(100),
        referrer: cut(2048),
        language: cut(30),
        sessionId: cut(100),
        attributes: { t: 'record', maxKeys: 50, keyMax: 64, valueMax: 500 }
      }
    }
  },
  'visitor-page-view': { currentPage: cut(2048) },
  'send-message': SEND_MESSAGE,
  'load-messages': {
    conversationId: ID,
    after: ID,
    before: ID,
    limit: { t: 'number', min: 1, max: 200 }
  },
  typing: {},
  'request-human': {},
  'visitor-contact': {
    name: str(100),
    email: str(254),
    phone: str(40),
    fields: { t: 'record', maxKeys: 20, keyMax: 100, valueMax: 500 },
    consent: { t: 'boolean' }
  },
  'rate-conversation': {
    conversationId: ID,
    score: { t: 'number', min: 1, max: 5 },
    feedback: str(1000)
  },
  'request-transcript': { conversationId: ID, email: str(254) }
};

/** The panel, /admin. */
export const ADMIN_EVENTS: Record<string, Shape> = {
  'join-site': { siteId: ID },
  'join-conversation': CONVERSATION,
  'send-message': SEND_MESSAGE,
  typing: CONVERSATION,
  'assign-conversation': { conversationId: ID, agentId: ID },
  'claim-conversation': CONVERSATION,
  'set-department': { conversationId: ID, departmentId: ID },
  'set-priority': { conversationId: ID, priority: { t: 'enum', values: PRIORITIES } },
  'resolve-conversation': CONVERSATION,
  'update-status': { status: { t: 'enum', values: ['online', 'away', 'busy', 'offline'] } },
  'team-chat-join': { chatId: ID },
  'team-chat-leave': { chatId: ID },
  'team-chat-send': { chatId: ID, content: str(MAX_MESSAGE_LENGTH) },
  'team-chat-typing': { chatId: ID }
};

export class PayloadError extends Error {}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

function check(rule: Rule, value: unknown, path: string): unknown {
  switch (rule.t) {
    case 'string':
      if (typeof value !== 'string') throw new PayloadError(`${path} must be text`);
      if (value.length <= rule.max) return value;
      if (rule.cut) return value.slice(0, rule.max);
      throw new PayloadError(`${path} is longer than ${rule.max} characters`);
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new PayloadError(`${path} must be a number`);
      }
      if (value < rule.min || value > rule.max) throw new PayloadError(`${path} is out of range`);
      return value;
    case 'boolean':
      if (typeof value !== 'boolean') throw new PayloadError(`${path} must be true or false`);
      return value;
    case 'enum':
      if (typeof value !== 'string' || !rule.values.includes(value)) {
        throw new PayloadError(`${path} is not one of the allowed values`);
      }
      return value;
    case 'object':
      return clean(rule.fields, value, path);
    case 'record': {
      if (!isPlainObject(value)) throw new PayloadError(`${path} must be an object`);
      const out: Record<string, string | number | boolean> = {};
      const entries = Object.entries(value);
      if (entries.length > rule.maxKeys) throw new PayloadError(`${path} has too many keys`);
      for (const [key, item] of entries) {
        if (!key || key.length > rule.keyMax || key === '__proto__' || key === 'constructor') {
          throw new PayloadError(`${path} has an invalid key`);
        }
        if (item === null || item === undefined) continue;
        if (typeof item === 'string') {
          if (item.length > rule.valueMax) throw new PayloadError(`${path}.${key} is too long`);
          out[key] = item;
        } else if (
          typeof item === 'boolean' ||
          (typeof item === 'number' && Number.isFinite(item))
        ) {
          out[key] = item;
        } else {
          throw new PayloadError(`${path}.${key} must be text, a number or true/false`);
        }
      }
      return out;
    }
  }
}

/** The payload with only the listed fields, each checked; throws PayloadError. */
export function clean(shape: Shape, payload: unknown, path = 'payload'): Record<string, unknown> {
  if (payload === undefined || payload === null) return {};
  if (!isPlainObject(payload)) throw new PayloadError(`${path} must be an object`);
  const out: Record<string, unknown> = {};
  for (const [field, rule] of Object.entries(shape)) {
    const value = payload[field];
    if (value === undefined || value === null) continue;
    out[field] = check(rule, value, `${path}.${field}`);
  }
  return out;
}

/**
 * The refusal code an event already answered with before this layer existed;
 * the widget and the panel branch on them. Every other event: INVALID_PAYLOAD.
 */
const REFUSAL_CODES: Record<string, string> = {
  'send-message': 'INVALID_MESSAGE',
  'team-chat-send': 'INVALID_MESSAGE',
  'rate-conversation': 'INVALID_RATING',
  'visitor-contact': 'PRECHAT_INVALID',
  'request-transcript': 'PRECHAT_INVALID'
};

/** The code a malformed payload of `event` is refused with. */
export const refusalCode = (event: string): string => REFUSAL_CODES[event] ?? 'INVALID_PAYLOAD';

/**
 * Installs the validator on one socket, after its rate limit. A refused event
 * never reaches its handler: the sender gets an `error` with the event's
 * refusal code (or UNKNOWN_EVENT) and, when it asked for one, a refused
 * acknowledgement.
 */
export function validateEvents(socket: Socket, events: Record<string, Shape>): void {
  socket.use((packet, next) => {
    const [event, ...args] = packet;
    const last = args[args.length - 1];
    const ack = typeof last === 'function' ? (last as (reply: unknown) => void) : null;
    const refuse = (code: string, message: string) => {
      socket.emit('error', { code, message });
      ack?.({ ok: false, code, message });
    };

    const shape = typeof event === 'string' ? events[event] : undefined;
    if (!shape) return refuse('UNKNOWN_EVENT', 'Unknown event');

    const code = refusalCode(event as string);
    const data = ack ? args.slice(0, -1) : args;
    if (data.length > 1) return refuse(code, 'One payload per event');
    try {
      const value = clean(shape, data[0]);
      // The handler sees the cleaned payload, then the acknowledgement.
      packet.length = 1;
      packet.push(value);
      if (ack) packet.push(ack);
    } catch (error) {
      return refuse(code, error instanceof PayloadError ? error.message : 'Invalid payload');
    }
    next();
  });
}
