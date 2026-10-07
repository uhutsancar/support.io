// A site's chat behaviour beyond the bubble's look (sites.chat_settings,
// migration 0011): what happens when nobody answers, what the visitor is
// asked before the chat, how satisfaction is asked for. Stored sparse; every
// read goes through `chatSettings()`, which fills the defaults, and every
// write through `sanitizeChatSettings()`, which keeps only known fields with
// sane values.

export type PreChatMode = 'off' | 'optional' | 'required';

export interface ChatSettings {
  missedChat: {
    /** Minutes without an answer before the team is mailed. */
    delayMinutes: number;
    /** Who hears about it: everyone who works on the site, the assignee, nobody. */
    notify: 'all' | 'assigned' | 'off';
  };
  /** While nobody is online the widget asks for an e-mail address. */
  offlineForm: boolean;
  /** A reply to a visitor who left an address and has gone goes by e-mail. */
  emailReplies: boolean;
  preChat: {
    mode: PreChatMode;
    name: boolean;
    email: boolean;
    phone: boolean;
    /** Up to three free questions, by label. */
    customFields: string[];
    /** Ask which department; routes the conversation there. */
    department: boolean;
    consent: { mode: PreChatMode; policyUrl: string };
  };
  csat: { enabled: boolean; style: 'thumbs' | 'stars'; askByEmail: boolean };
  /** The visitor may have the transcript mailed when the chat ends. */
  transcript: boolean;
  /** Stricter limits for new visitors and links held back (SEC-09). */
  spamMode: boolean;
}

export const DEFAULT_CHAT_SETTINGS: ChatSettings = {
  missedChat: { delayMinutes: 3, notify: 'all' },
  offlineForm: true,
  emailReplies: true,
  preChat: {
    mode: 'off',
    name: true,
    email: true,
    phone: false,
    customFields: [],
    department: false,
    consent: { mode: 'off', policyUrl: '' }
  },
  csat: { enabled: true, style: 'thumbs', askByEmail: true },
  transcript: true,
  spamMode: false
};

const isObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
  options.includes(v as T) ? (v as T) : fallback;

function httpsUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.toString().slice(0, 500)
      : '';
  } catch {
    return '';
  }
}

/** The stored settings with every gap filled from the defaults. */
export function chatSettings(stored: unknown): ChatSettings {
  return sanitizeChatSettings(stored, DEFAULT_CHAT_SETTINGS);
}

/** Only known fields, each within its range; anything else falls back. */
export function sanitizeChatSettings(
  input: unknown,
  base: ChatSettings = DEFAULT_CHAT_SETTINGS
): ChatSettings {
  const raw = isObject(input) ? input : {};
  const missed = isObject(raw.missedChat) ? raw.missedChat : {};
  const pre = isObject(raw.preChat) ? raw.preChat : {};
  const consent = isObject(pre.consent) ? pre.consent : {};
  const csat = isObject(raw.csat) ? raw.csat : {};
  const delay = Number(missed.delayMinutes);
  return {
    missedChat: {
      delayMinutes:
        Number.isFinite(delay) && delay >= 1 && delay <= 120
          ? Math.round(delay)
          : base.missedChat.delayMinutes,
      notify: oneOf(missed.notify, ['all', 'assigned', 'off'] as const, base.missedChat.notify)
    },
    offlineForm: bool(raw.offlineForm, base.offlineForm),
    emailReplies: bool(raw.emailReplies, base.emailReplies),
    preChat: {
      mode: oneOf(pre.mode, ['off', 'optional', 'required'] as const, base.preChat.mode),
      name: bool(pre.name, base.preChat.name),
      email: bool(pre.email, base.preChat.email),
      phone: bool(pre.phone, base.preChat.phone),
      customFields: Array.isArray(pre.customFields)
        ? pre.customFields
            .filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
            .map((f) => f.trim().slice(0, 80))
            .slice(0, 3)
        : base.preChat.customFields,
      department: bool(pre.department, base.preChat.department),
      consent: {
        mode: oneOf(
          consent.mode,
          ['off', 'optional', 'required'] as const,
          base.preChat.consent.mode
        ),
        policyUrl:
          'policyUrl' in consent ? httpsUrl(consent.policyUrl) : base.preChat.consent.policyUrl
      }
    },
    csat: {
      enabled: bool(csat.enabled, base.csat.enabled),
      style: oneOf(csat.style, ['thumbs', 'stars'] as const, base.csat.style),
      askByEmail: bool(csat.askByEmail, base.csat.askByEmail)
    },
    transcript: bool(raw.transcript, base.transcript),
    spamMode: bool(raw.spamMode, base.spamMode)
  };
}

/** What the widget needs to know; nothing about who gets mailed. */
export function publicChatSettings(settings: ChatSettings) {
  return {
    offlineForm: settings.offlineForm,
    preChat: settings.preChat,
    csat: { enabled: settings.csat.enabled, style: settings.csat.style },
    transcript: settings.transcript
  };
}
