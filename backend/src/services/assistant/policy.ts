// When the assistant steps aside, decided without the model.

/** A visitor asking for a person, in Turkish or English. */
const WANTS_HUMAN = new RegExp(
  [
    'temsilci',
    'canl[ıi] destek',
    'yetkili',
    'operat[öo]r',
    'm[üu][şs]teri hizmetleri',
    'ger[çc]ek (bir )?(ki[şs]i|insan)',
    'insan(la|a)? (g[öo]r[üu][şs]|konu[şs])',
    'biriyle (g[öo]r[üu][şs]|konu[şs])',
    '\\bagent\\b',
    'human',
    'real person',
    'representative',
    'speak to (someone|a person)',
    'talk to (someone|a person)'
  ].join('|'),
  'i'
);

export function wantsHuman(text: string): boolean {
  return WANTS_HUMAN.test(text);
}

/** Answers the assistant gives in one conversation before it hands over anyway. */
export const MAX_ASSISTANT_REPLIES = 6;

/** The longest answer it may send; anything longer is not "short". */
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
  | 'limit'
  | 'no_faq'
  | 'no_answer'
  | 'unsupported'
  | 'api_quota'
  | 'api_auth'
  | 'api_unavailable'
  | 'api_timeout'
  | 'api_blocked'
  | 'api_bad_response';
