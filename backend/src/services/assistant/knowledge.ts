// The only knowledge the assistant has: the site's public FAQ entries.
//
// The same entries the widget shows to every visitor in its Help tab, so
// nothing private can leak through an answer. The best text-search matches
// for the question come first; a few of the newest entries fill up the list,
// so the model can also tell that the answer is simply not there.

import FAQ from '../../models/FAQ';

export interface FaqSource {
  /** A short id the model cites, e.g. "s1"; mapped back to the FAQ here. */
  ref: string;
  faqId: string;
  question: string;
  answer: string;
}

const MATCHES = 5;
const MAX_SOURCES = 8;
const MAX_ANSWER_CHARS = 800;

/** The FAQ entries an answer to `question` may be drawn from. */
export async function faqSources(siteId: string, question: string): Promise<FaqSource[]> {
  const scope = { siteId, isActive: true, pageSpecific: '*' };
  const matched = question.trim()
    ? await FAQ.find({ ...scope, $text: { $search: question } }, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } })
        .limit(MATCHES)
    : [];
  const seen = new Set(matched.map((f) => String(f._id)));
  const filler =
    matched.length < MAX_SOURCES
      ? (await FAQ.find(scope).sort({ createdAt: -1 }).limit(MAX_SOURCES)).filter(
          (f) => !seen.has(String(f._id))
        )
      : [];

  return [...matched, ...filler].slice(0, MAX_SOURCES).map((faq, i) => ({
    ref: `s${i + 1}`,
    faqId: String(faq._id),
    question: String(faq.question).slice(0, 300),
    answer: String(faq.answer).slice(0, MAX_ANSWER_CHARS)
  }));
}
