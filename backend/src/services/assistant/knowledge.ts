// What the assistant knows: the site's public FAQ entries and — on a plan
// with knowledge sources (PRD-21) — passages of the site's own pages and of
// the PDFs the business uploaded.
//
// The FAQ entries are the same ones the widget shows to every visitor in its
// Help tab, and pages are the site's public pages, so nothing private can
// leak through an answer; what a business uploads as a PDF is its choice,
// and the panel asks for public material only. The best text-search matches
// come first — FAQ entries, then passages — and a few of the newest FAQ
// entries fill up the list, so the model can also tell that the answer is
// simply not there.

import FAQ from '../../models/FAQ';
import { knowledgePassages } from '../knowledgeSources';
import { carriesSensitiveData, redact } from './privacy';

export interface FaqSource {
  /** A short id the model cites, e.g. "s1"; mapped back to the entry here. */
  ref: string;
  /** The FAQ entry, or the passage, it came from. */
  faqId: string;
  /** An FAQ entry by default; a passage of a page or a PDF otherwise. */
  kind?: 'faq' | 'page' | 'pdf';
  /** The FAQ question, or the page's or document's title. */
  question: string;
  /** The FAQ answer, or the passage. */
  answer: string;
  /** The page's address, for a page passage. */
  url?: string | null;
}

const MATCHES = 5;
const MAX_SOURCES = 8;
const MAX_ANSWER_CHARS = 800;

/**
 * The sources an answer to `question` may be drawn from: matching FAQ
 * entries, matching passages when `withPassages`, then the newest entries.
 */
export async function faqSources(
  siteId: string,
  question: string,
  maxSources = MAX_SOURCES,
  withPassages = false
): Promise<FaqSource[]> {
  const scope = { siteId, isActive: true, pageSpecific: '*' };
  const share = Math.min(maxSources, Math.max(MATCHES, Math.round(maxSources * 0.6)));
  const matched = question.trim()
    ? await FAQ.find({ ...scope, $text: { $search: question } }, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } })
        // A larger window keeps the same share of best matches.
        .limit(share)
    : [];
  const fromFaq = matched
    .filter((faq) => !carriesSensitiveData(`${faq.question} ${faq.answer}`))
    .map((faq) => ({
      faqId: String(faq._id),
      kind: 'faq' as const,
      question: redact(String(faq.question)).slice(0, 300),
      answer: redact(String(faq.answer)).slice(0, MAX_ANSWER_CHARS)
    }));

  // Passages take the room the FAQ matches left, at least two places of it.
  const passages = withPassages
    ? await knowledgePassages(siteId, question, Math.max(2, maxSources - fromFaq.length))
    : [];
  const fromPassages = passages
    .filter((p) => !carriesSensitiveData(`${p.title} ${p.content}`))
    .map((p) => ({
      faqId: p.id,
      kind: p.kind,
      question: redact(String(p.title)).slice(0, 200),
      answer: redact(p.content).slice(0, MAX_ANSWER_CHARS),
      url: p.url
    }));

  const chosen = [...fromFaq, ...fromPassages].slice(0, maxSources);
  if (chosen.length < maxSources) {
    const seen = new Set(fromFaq.map((f) => f.faqId));
    const filler = (await FAQ.find(scope).sort({ createdAt: -1 }).limit(maxSources))
      .filter((f) => !seen.has(String(f._id)))
      .filter((faq) => !carriesSensitiveData(`${faq.question} ${faq.answer}`))
      .map((faq) => ({
        faqId: String(faq._id),
        kind: 'faq' as const,
        question: redact(String(faq.question)).slice(0, 300),
        answer: redact(String(faq.answer)).slice(0, MAX_ANSWER_CHARS)
      }));
    chosen.push(...filler.slice(0, maxSources - chosen.length));
  }
  return chosen.map((source, i) => ({ ...source, ref: `s${i + 1}` }));
}
