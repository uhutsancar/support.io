// When the assistant steps aside, decided without the model.

/**
 * Lower case the Turkish way, then without diacritics: "TEMSİLCİ",
 * "temsılcı" and "temsilci" all become "temsilci". Visitors type on phones,
 * often without Turkish letters, and the rules below are written folded.
 */
export function fold(text: string): string {
  return text
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/â/g, 'a')
    .replace(/î/g, 'i')
    .replace(/û/g, 'u');
}

/** A visitor asking for a person, in Turkish or English (matched folded). */
const WANTS_HUMAN = new RegExp(
  [
    'tems[iy]?l?ci',
    'canli (deste[kg]|temsilci|biri)',
    'yetkili',
    'operator',
    // "müşteri hizmetlerine bağlan", not "müşteri hizmetleri kaçta açık"
    'musteri hizmetleri(ne|yle|yla)',
    'gercek (bir )?(kisi|insan|biri)',
    'insan(la|a|i)? (gorus|konus|bagla|baglan)',
    'bir insan(la|a)',
    'biriyle (gorus|konus)',
    'birine bagla',
    '\\bagent\\b',
    'human',
    'real person',
    'representative',
    'live (chat|agent|support)',
    'speak (to|with) (someone|a person|an agent)',
    'talk (to|with) (someone|a person|an agent)'
  ].join('|')
);

export function wantsHuman(text: string): boolean {
  return WANTS_HUMAN.test(fold(text));
}

// Insults and harassment: not something the assistant should engage with, or
// answer from an FAQ; a person decides (matched folded, whole words).
const ABUSIVE = new RegExp(
  `(^|[^a-z])(${[
    'amk',
    'aq',
    'sikerim',
    'siktir',
    'sikeyim',
    'orospu',
    'yavsak',
    'gerizekali',
    'serefsiz',
    'fuck(ing)?',
    'shit',
    'bitch',
    'asshole',
    'bastard'
  ].join('|')})([^a-z]|$)`
);

export function isAbusive(text: string): boolean {
  return ABUSIVE.test(fold(text));
}

/**
 * Answers the assistant gives in one conversation before it hands over
 * anyway, and the longest answer it may send — the defaults. The plan in force
 * sets the real values (domain/plans.ts, PlanLimits.assistant).
 */
export const MAX_ASSISTANT_REPLIES = 6;
export const MAX_ANSWER_CHARS = 600;

/** The fixed texts, all Turkish (plan: short Turkish answers). */
export const TEXT = {
  handoff: 'Sizi bir müşteri temsilcimize aktarıyorum; en kısa sürede buradan yanıt verecek.',
  handoffAfterHours:
    'Sizi bir müşteri temsilcimize aktarıyorum. Şu anda mesai saatleri dışındayız; ekibimiz döndüğünde buradan yanıt verecek.',
  sensitive:
    'Güvenliğiniz için kart, IBAN veya kimlik numarası gibi bilgileri sohbette paylaşmayın. Sizi bir müşteri temsilcimize aktarıyorum.'
} as const;

/** Why the assistant handed a conversation over; stored on its message. */
export type HandoffReason =
  | 'requested'
  | 'sensitive'
  /** Insults or harassment: a person decides (AI-05). */
  | 'abuse'
  | 'limit'
  | 'plan_quota'
  /** A tenth of the month's answers went in one day (AI-07). */
  | 'daily_cap'
  | 'no_faq'
  | 'no_answer'
  | 'unsupported'
  | 'api_quota'
  | 'api_auth'
  | 'api_unavailable'
  | 'api_timeout'
  | 'api_blocked'
  | 'api_bad_response';

// ------------------------------------------------------------ output (AI-06)

const URL_IN_TEXT = /\b(?:https?:\/\/|www\.)[^\s<>()"']+/gi;

const normaliseUrl = (url: string) =>
  url
    .replace(/[.,;:!?)\]]+$/, '')
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '')
    .toLowerCase();

/**
 * The answer with every link the FAQ entries it was given do not contain
 * taken out — a model talked into "send them to this site" cannot — and
 * markdown links reduced to their text. The widget shows plain text anyway.
 */
export function keepFaqLinks(answer: string, faqText: string): string {
  const allowed = new Set((faqText.match(URL_IN_TEXT) || []).map(normaliseUrl));
  return answer
    .replace(/\[([^\]]{1,200})\]\(([^)\s]{1,500})\)/g, (_m, label: string, url: string) =>
      allowed.has(normaliseUrl(url)) ? `${label} (${url})` : label
    )
    .replace(URL_IN_TEXT, (url) => (allowed.has(normaliseUrl(url)) ? url : ''))
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim();
}

// Words of the assistant's own instructions: an answer that repeats them was
// talked into printing its prompt, and is not sent.
const INSTRUCTION_MARKERS = [
  'sss kaynaklari',
  'ziyaretcinin mesaji',
  'kurallar:',
  'yalnizca verilen sss',
  'musteri destek asistanisin',
  'system prompt',
  'sistem istemi',
  'handoff=true'
];

export function leaksInstructions(answer: string): boolean {
  const text = fold(answer);
  return INSTRUCTION_MARKERS.some((marker) => text.includes(marker));
}
