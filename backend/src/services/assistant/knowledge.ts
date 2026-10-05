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
export async function faqSources(
  siteId: string,
  question: string,
  maxSources = MAX_SOURCES
): Promise<FaqSource[]> {
  const scope = { siteId, isActive: true, pageSpecific: '*' };
  const matched = question.trim()
    ? await FAQ.find({ ...scope, $text: { $search: question } }, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } })
        // A larger window keeps the same share of best matches.
        .limit(Math.min(maxSources, Math.max(MATCHES, Math.round(maxSources * 0.6))))
    : [];
  const seen = new Set(matched.map((f) => String(f._id)));
  const filler =
    matched.length < maxSources
      ? (await FAQ.find(scope).sort({ createdAt: -1 }).limit(maxSources)).filter(
          (f) => !seen.has(String(f._id))
        )
      : [];

  return [...matched, ...filler].slice(0, maxSources).map((faq, i) => ({
    ref: `s${i + 1}`,
    faqId: String(faq._id),
    question: String(faq.question).slice(0, 300),
    answer: String(faq.answer).slice(0, MAX_ANSWER_CHARS)
  }));
}
