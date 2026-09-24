// The FAQ entries a question should be answered from.
//
// The previous version handed the model the site's first twelve entries in
// display order, whatever the question was — so an answer about returns could
// be missing its only source while shipping and invoices filled the prompt.
// Entries are now chosen by the question itself, through the full-text index
// the FAQ table already has (`faqs.search_vector`, GIN). No embeddings and no
// second model: PostgreSQL ranks the matches.

import FAQ from '../../models/FAQ';

/** One entry as the model sees it. `id` is what the model cites back. */
export interface KnowledgeSource {
  id: string;
  question: string;
  answer: string;
  category: string;
}

/** Most entries one prompt carries. */
const MAX_SOURCES = 3;
/** Each answer is cut here, which keeps the prompt near its token budget. */
const MAX_ANSWER_CHARS = 600;
/**
 * A site this small is given whole when nothing matches: a typo such as
 * "iade suresi" can miss every indexed word, and with a handful of entries the
 * model can still pick the right one. A larger site gets no sources instead,
 * and the model hands the visitor over rather than guessing.
 */
const SMALL_SITE_ENTRIES = 12;
const MAX_QUESTION_CHARS = 500;

function toSource(faq: { _id: unknown; question: string; answer: string; category?: string }) {
  return {
    id: String(faq._id),
    question: faq.question,
    answer: String(faq.answer).slice(0, MAX_ANSWER_CHARS),
    category: faq.category || ''
  };
}

/**
 * The entries of this site that match the question, best first.
 *
 * `siteId` must come from a conversation the caller has already resolved and
 * authorised, never from a request body: it is the tenant boundary here.
 */
export async function findSources(
  siteId: unknown,
  question: string,
  page?: string | null
): Promise<KnowledgeSource[]> {
  // Entries pinned to a page apply only there; '*' applies everywhere. The
  // same rule the widget's own FAQ search uses (routes/faqs.ts).
  const scope = {
    siteId,
    isActive: true,
    $or: page ? [{ pageSpecific: '*' }, { pageSpecific: page }] : [{ pageSpecific: '*' }]
  };

  // Turkish lower-casing first: JavaScript's default turns "İ" into "i̇" (i
  // plus a combining dot), which never matches the indexed "iade".
  const text = question.slice(0, MAX_QUESTION_CHARS).toLocaleLowerCase('tr-TR');
  const matches = await FAQ.find(
    { ...scope, $text: { $search: text } },
    { score: { $meta: 'textScore' } }
  )
    .sort({ score: { $meta: 'textScore' } })
    .limit(MAX_SOURCES);
  if (matches.length) return matches.map(toSource);

  const total = await FAQ.countDocuments(scope);
  if (total === 0 || total > SMALL_SITE_ENTRIES) return [];

  const all = await FAQ.find(scope).sort({ order: 1 }).limit(SMALL_SITE_ENTRIES);
  return all.map(toSource);
}

/** The sources as a numbered block for a prompt, each tagged with its id. */
export function renderSources(sources: readonly KnowledgeSource[]): string {
  return sources
    .map((s) => `[${s.id}] ${s.category ? `(${s.category}) ` : ''}S: ${s.question}\nC: ${s.answer}`)
    .join('\n\n');
}
