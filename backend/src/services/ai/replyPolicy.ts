// The rules an automatic reply has to pass, in code.
//
// The instructions in prompts.ts ask the model to behave; this file makes sure
// it did. Two gates:
//
//   before  decides from the visitor's message alone whether the model is
//           called at all. A request for a person, a card number, an IBAN or
//           an identity number never reaches the model.
//   after   reads what the model produced and refuses anything a customer must
//           not see: a number, date or link that is not in the sources, a
//           claim that something was done, markup, a reply that is too long.
//
// A refused reply is never sent. The caller replaces it with a fixed text.

import { AIError } from './provider';
import { AUTO_REPLY_DECISIONS, REPLY_LANGUAGES } from './prompts';
import type { AutoReplyDecision, ReplyLanguage } from './prompts';

// ------------------------------------------------------------------ before

/** Why a message goes straight to a person without a model call. */
export type PreCheckReason =
  | 'human_requested'
  | 'sensitive_data'
  | 'too_long'
  | 'bot_limit'
  | 'clarify_limit'
  | 'blocked_term';

export interface PreCheckInput {
  text: string;
  /** Automatic replies already sent in this conversation. */
  botReplies: number;
  /** The decisions of the most recent automatic replies, newest first. */
  recentDecisions: readonly string[];
  maxBotReplies: number;
  blockedTerms: readonly string[];
}

export const MAX_AUTO_REPLY_INPUT = 2000;

// Stems, matched at the start of a word so the Turkish suffixes still match
// ("temsilciyle", "temsilciye"). Deliberately narrow: "yetkili servis" is a
// question, "yetkiliyle görüşmek" is a request for a person.
const HUMAN_REQUEST_STEMS = [
  'temsilci',
  'canlı destek',
  'canli destek',
  // Consonant softening: destek -> desteğe, desteğiniz.
  'canlı desteğ',
  'canli desteg',
  'müşteri hizmetleri',
  'musteri hizmetleri',
  'yetkiliyle',
  'yetkili biri',
  'yetkili kişi',
  'gerçek kişi',
  'gerçek bir kişi',
  'gerçek insan',
  'gercek insan',
  'insanla',
  'operatör',
  'operator',
  'human',
  'real person',
  'live agent',
  'live chat',
  'representative',
  'agent',
  'someone real',
  'talk to someone',
  'speak to someone'
];

const HUMAN_REQUEST = new RegExp(
  `(^|[^\\p{L}])(${HUMAN_REQUEST_STEMS.map((s) => s.replace(/ /g, '\\s+')).join('|')})`,
  'iu'
);

function luhnValid(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

function containsCardNumber(text: string): boolean {
  for (const match of text.matchAll(/\d(?:[ -]?\d){12,18}/g)) {
    const digits = match[0].replace(/\D/g, '');
    if (digits.length >= 13 && digits.length <= 19 && luhnValid(digits)) return true;
  }
  return false;
}

function ibanValid(candidate: string): boolean {
  const rearranged = candidate.slice(4) + candidate.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const value = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const digit of value) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

function containsIban(text: string): boolean {
  for (const match of text.toUpperCase().matchAll(/\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){11,30}/g)) {
    if (ibanValid(match[0].replace(/ /g, ''))) return true;
  }
  return false;
}

/** A Turkish identity number: eleven digits with two check digits. */
function containsTurkishId(text: string): boolean {
  for (const match of text.matchAll(/(?<!\d)[1-9]\d{10}(?!\d)/g)) {
    const d = match[0].split('').map(Number);
    const odd = d[0] + d[2] + d[4] + d[6] + d[8];
    const even = d[1] + d[3] + d[5] + d[7];
    const tenth = (((odd * 7 - even) % 10) + 10) % 10;
    const eleventh = d.slice(0, 10).reduce((a, b) => a + b, 0) % 10;
    if (tenth === d[9] && eleventh === d[10]) return true;
  }
  return false;
}

export function containsSensitiveData(text: string): boolean {
  return containsCardNumber(text) || containsIban(text) || containsTurkishId(text);
}

/** Null when the model may be asked; otherwise why the visitor goes to a person. */
export function preCheck(input: PreCheckInput): PreCheckReason | null {
  const text = input.text.toLocaleLowerCase('tr-TR');
  if (HUMAN_REQUEST.test(text)) return 'human_requested';
  if (containsSensitiveData(input.text)) return 'sensitive_data';
  if (input.text.length > MAX_AUTO_REPLY_INPUT) return 'too_long';
  if (input.botReplies >= input.maxBotReplies) return 'bot_limit';
  if (input.recentDecisions[0] === 'clarify' && input.recentDecisions[1] === 'clarify') {
    return 'clarify_limit';
  }
  const blocked = input.blockedTerms.some(
    (term) => term.trim() && text.includes(term.trim().toLocaleLowerCase('tr-TR'))
  );
  return blocked ? 'blocked_term' : null;
}

// ------------------------------------------------------------------- after

export interface AutoReplyOutput {
  decision: AutoReplyDecision;
  answer: string | null;
  sourceIds: string[];
  orderNumber: string | null;
  language: ReplyLanguage;
}

function badFormat(): AIError {
  return new AIError('Model beklenen biçimde yanıt vermedi.', {
    code: 'ai_bad_format',
    status: 502
  });
}

const isStringOrNull = (value: unknown): value is string | null =>
  value === null || typeof value === 'string';

/**
 * The model's JSON, checked field by field.
 *
 * Structured output already constrains the tokens, but this is the boundary
 * where outside data becomes a typed value, so it is checked like any other:
 * `Boolean("false")` is true, and trusting a shape is how that bug happened.
 */
export function parseAutoReply(text: string): AutoReplyOutput {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw badFormat();
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) throw badFormat();
  const o = data as Record<string, unknown>;

  if (!(AUTO_REPLY_DECISIONS as readonly unknown[]).includes(o.decision)) throw badFormat();
  if (!(REPLY_LANGUAGES as readonly unknown[]).includes(o.language)) throw badFormat();
  if (!isStringOrNull(o.answer) || !isStringOrNull(o.orderNumber)) throw badFormat();
  if (!Array.isArray(o.sourceIds) || !o.sourceIds.every((id) => typeof id === 'string')) {
    throw badFormat();
  }

  return {
    decision: o.decision as AutoReplyDecision,
    answer: o.answer === null ? null : o.answer.trim() || null,
    sourceIds: o.sourceIds as string[],
    orderNumber: o.orderNumber === null ? null : o.orderNumber.trim() || null,
    language: o.language as ReplyLanguage
  };
}

/** The second call of an order question: an answer from the order data, or a handoff. */
export function parseOrderReply(text: string): {
  decision: 'answer' | 'handoff';
  answer: string | null;
} {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw badFormat();
  }
  if (typeof data !== 'object' || data === null) throw badFormat();
  const o = data as Record<string, unknown>;
  if ((o.decision !== 'answer' && o.decision !== 'handoff') || !isStringOrNull(o.answer)) {
    throw badFormat();
  }
  return { decision: o.decision, answer: o.answer === null ? null : o.answer.trim() || null };
}

/** Why a reply the model wrote is not sent. */
export type RejectReason =
  | 'missing_answer'
  | 'unknown_source'
  | 'too_long'
  | 'markup'
  | 'unsupported_fact'
  | 'facts_in_chitchat'
  | 'action_claim';

export interface ReplyCheck {
  decision: 'small_talk' | 'answer' | 'clarify' | 'decline' | 'order';
  answer: string | null;
  sourceIds: readonly string[];
  /** Ids of the sources the model was given; anything else is invented. */
  allowedSourceIds: readonly string[];
  /** Every text the reply may take facts from: FAQ answers, order data. */
  evidence: readonly string[];
  maxSentences: number;
  maxChars: number;
}

const MARKUP = /<[^>]+>|\*\*|__|```|\[[^\]]+\]\([^)]*\)|^\s*(#|>|[-*] )/m;
const URL = /\bhttps?:\/\/[^\s)]+|\bwww\.[^\s)]+/gi;
const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.\p{L}{2,}/giu;
/** Codes such as a tracking number: letters and digits together. */
const CODE = /(?<![\p{L}\p{N}])(?=[\p{L}\p{N}-]*\p{L})(?=[\p{L}\p{N}-]*\d)[\p{L}\p{N}-]{3,}/gu;

const ACTION_CLAIMS = [
  // TR: first person past tense, and the passive a done deed is reported in.
  /(başlattım|başlatıldı|iptal ettim|iptal edildi|iade ettim|iade edildi|tanımladım|tanımlandı|oluşturdum|değiştirdim|güncelledim|onayladım|gönderdim|ilettim|düzelttim|yaptım)/iu,
  /\bI(?:'ve| have)? (?:started|cancell?ed|refunded|processed|updated|changed|created|submitted|sent|fixed|approved)\b/i,
  /\bhas been (?:refunded|cancell?ed|processed|updated|changed|approved|shipped)\b/i
];

function normalise(text: string): string {
  return text.toLocaleLowerCase('tr-TR').replace(/[‐-―−]/g, '-');
}

/** Digit runs, compared without leading zeros so "09" and "9" are the same day. */
function numbers(text: string): string[] {
  return (text.match(/\d+/g) || []).map((n) => String(Number(n)));
}

/** True when every fact the reply states is in one of the evidence texts. */
function factsSupported(answer: string, evidence: readonly string[]): boolean {
  const source = normalise(evidence.join('\n'));
  const available = new Set(numbers(source));
  if (!numbers(answer).every((n) => available.has(n))) return false;

  const text = normalise(answer);
  const literal = [
    ...(text.match(URL) || []),
    ...(text.match(EMAIL) || []),
    ...(text.match(CODE) || [])
  ];
  return literal.every((token) => source.includes(token.replace(/[.,;:!?]+$/, '')));
}

/**
 * Any number, link or address at all. Not the /g patterns above: `test` on a
 * global regex resumes from its previous match and skips text.
 */
function hasFacts(answer: string): boolean {
  return /\d|\bhttps?:\/\/|\bwww\.|@[\p{L}\p{N}.-]+\.\p{L}{2,}/iu.test(answer);
}

/** A claim that something was done — unless the order data itself says so. */
function claimsAction(answer: string, evidence: readonly string[]): boolean {
  const source = normalise(evidence.join('\n'));
  return ACTION_CLAIMS.some((claim) => {
    const match = answer.match(claim);
    return match !== null && !source.includes(normalise(match[0]));
  });
}

function sentenceCount(text: string): number {
  return text.split(/[.!?…]+(?:\s+|$)/).filter((s) => s.trim()).length;
}

/** Null when the reply may be sent; otherwise why it may not. */
export function checkReply(check: ReplyCheck): RejectReason | null {
  const answer = check.answer?.trim();
  if (!answer) return 'missing_answer';

  if (check.decision === 'answer') {
    if (!check.sourceIds.length) return 'unknown_source';
    if (!check.sourceIds.every((id) => check.allowedSourceIds.includes(id))) {
      return 'unknown_source';
    }
  } else if (check.sourceIds.length) {
    return 'unknown_source';
  }

  if (answer.length > check.maxChars || sentenceCount(answer) > check.maxSentences) {
    return 'too_long';
  }
  if (MARKUP.test(answer)) return 'markup';
  if (claimsAction(answer, check.evidence)) return 'action_claim';

  // Small talk, a refusal and a clarifying question state no facts at all.
  if (
    check.decision === 'small_talk' ||
    check.decision === 'decline' ||
    check.decision === 'clarify'
  ) {
    return hasFacts(answer) ? 'facts_in_chitchat' : null;
  }
  return factsSupported(answer, check.evidence) ? null : 'unsupported_fact';
}
