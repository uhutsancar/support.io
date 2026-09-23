'use strict';

// The AI copilot's support operations.
//
// Every task here is advisory. Nothing in this file sends a message to a
// visitor, changes a conversation's status or writes a tag: the routes hand the
// result back to the agent, who accepts, edits, regenerates or rejects it. That
// boundary is deliberate — an automated reply that reaches a customer without a
// human reading it is a support incident, not a feature.

/**
 * The parts of a conversation the copilot reads.
 *
 * Narrower than the stored document on purpose: these tasks only describe a
 * conversation to the model, so a caller can hand over exactly what it has.
 */
import { getProvider, AIError } from './ai';
import Message from '../models/Message';
import { findSources, renderSources } from './ai/knowledge';
import {
  ANALYSIS_SCHEMA,
  COPILOT_SYSTEM,
  KNOWLEDGE_SCHEMA,
  SENTIMENTS,
  SUGGESTED_PRIORITIES,
  TRANSLATE_SYSTEM,
  analysisPrompt,
  knowledgePrompt,
  replyPrompt,
  rewritePrompt,
  summaryPrompt,
  translatePrompt
} from './ai/prompts';
import type { Priority } from '../domain';

export interface ConversationInput {
  _id: string;
  siteId?: unknown;
  ticketId?: string;
  status?: string;
  priority?: string;
  channel?: string;
  visitorName?: string;
  tags?: string[];
  currentPage?: string;
}

/** A rendered transcript plus how much of the thread it covers. */
export interface TranscriptResult {
  transcript: string;
  /** Messages the transcript contains. */
  messageCount: number;
  /** True when older messages were dropped to fit the window. */
  truncated: boolean;
  /** The visitor's newest message, which is what a reply has to answer. */
  lastVisitorMessage: string;
}

/** How much of a thread one prompt may carry. */
export interface TranscriptWindow {
  messages: number;
  chars: number;
}

/** What every task returns alongside its own payload. */
interface ModelAttribution {
  model: string;
  usage: { inputTokens: number | null; outputTokens: number | null };
}

export type SummaryResult = ModelAttribution & { summary: string };
export type ReplyResult = ModelAttribution & { reply: string };
export type TranslationResult = ModelAttribution & { text: string };

export interface ConversationAnalysis {
  sentiment: 'positive' | 'neutral' | 'negative';
  intent: string;
  category: string;
  suggestedPriority: Priority | null;
  suggestedTags: string[];
  reason: string;
}

export type AnalysisResult = ModelAttribution & { analysis: ConversationAnalysis };

/** An answer drawn only from the site's own published entries. */
export type KnowledgeAnswerResult =
  | (ModelAttribution & { answered: boolean; answer: string | null; usedEntries: unknown[] })
  /** Returned without calling a model when the site has no knowledge base. */
  | { answered: false; answer: null; reason: string };

// How much transcript to send. The model runs with a 4096-token context, so the
// window is bounded in characters as well as messages; Turkish runs at roughly
// four characters a token. Long threads lose their oldest messages, so the
// most recent exchange — the part a reply must respond to — always survives.
const COPILOT_WINDOW: TranscriptWindow = { messages: 20, chars: 6000 };
const MAX_MESSAGE_CHARS = 800;

const SPEAKER: Record<string, string> = { visitor: 'Müşteri', agent: 'Temsilci', bot: 'Bot' };

// Renders the newest part of a conversation as a plain transcript.
//
// It used to read the *first* 200 messages oldest-first and keep the last 40
// of those, so on a thread longer than 200 the messages that mattered most —
// the latest — were exactly the ones never loaded.
async function buildTranscript(
  conversationId: string,
  window: TranscriptWindow = COPILOT_WINDOW
): Promise<TranscriptResult> {
  const newestFirst = await Message.find({ conversationId })
    .sort({ createdAt: -1 })
    .limit(window.messages + 1);

  const lines: string[] = [];
  let used = 0;
  for (const m of newestFirst.slice(0, window.messages)) {
    const who = SPEAKER[m.senderType] || m.senderType;
    const line = `${who}: ${String(m.content || '').slice(0, MAX_MESSAGE_CHARS)}`;
    if (lines.length && used + line.length > window.chars) break;
    lines.push(line);
    used += line.length;
  }

  const lastVisitor = newestFirst.find((m) => m.senderType === 'visitor');
  return {
    transcript: lines.reverse().join('\n'),
    messageCount: lines.length,
    truncated: newestFirst.length > lines.length,
    lastVisitorMessage: lastVisitor ? String(lastVisitor.content || '') : ''
  };
}

// Conversation metadata worth giving the model alongside the transcript.
function describeConversation(conversation: ConversationInput): string {
  const parts = [
    `Ticket: ${conversation.ticketId || conversation._id}`,
    `Durum: ${conversation.status}`,
    `Öncelik: ${conversation.priority}`,
    `Kanal: ${conversation.channel}`
  ];
  if (conversation.visitorName) parts.push(`Müşteri: ${conversation.visitorName}`);
  if (conversation.tags?.length) parts.push(`Etiketler: ${conversation.tags.join(', ')}`);
  if (conversation.currentPage) parts.push(`Sayfa: ${conversation.currentPage}`);
  return parts.join(' | ');
}

// Strips code fences a model sometimes wraps JSON in. Structured output makes
// them unlikely, but a stray fence is not worth failing a request over.
function parseJsonResponse(text: string): Record<string, unknown> {
  const cleaned = text
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new AIError('Model beklenen JSON biçiminde yanıt vermedi.', {
      code: 'ai_bad_format',
      status: 502,
      retryable: true
    });
  }
  return parsed as Record<string, unknown>;
}

// Guards every task: an empty thread has nothing to reason about, and calling
// the model anyway spends GPU time to produce a confident hallucination.
function assertHasTranscript(transcript: string): void {
  if (!transcript || !transcript.trim()) {
    throw new AIError('Bu konuşmada henüz mesaj yok.', {
      code: 'ai_no_messages',
      status: 400
    });
  }
}

/** The copilot's output budget; a panel answer is read by an agent, not a customer. */
const COPILOT_MAX_TOKENS = 400;
const MAX_INPUT_CHARS = 4000;

const oneOf = <T extends string>(values: readonly T[], value: unknown): T | null =>
  typeof value === 'string' && (values as readonly string[]).includes(value) ? (value as T) : null;

// --- tasks -----------------------------------------------------------------

async function summarize(conversation: ConversationInput): Promise<SummaryResult> {
  const { transcript } = await buildTranscript(conversation._id);
  assertHasTranscript(transcript);

  const result = await getProvider().complete({
    system: COPILOT_SYSTEM,
    prompt: summaryPrompt(describeConversation(conversation), transcript),
    maxTokens: COPILOT_MAX_TOKENS,
    temperature: 0
  });

  return { summary: result.text, model: result.model, usage: result.usage };
}

async function suggestReply(
  conversation: ConversationInput,
  { instruction = null }: { instruction?: string | null } = {}
): Promise<ReplyResult> {
  const { transcript, lastVisitorMessage } = await buildTranscript(conversation._id);
  assertHasTranscript(transcript);

  // The published answers that match what the visitor asked, so a suggested
  // reply reuses the wording support already stands behind rather than
  // inventing policy.
  const knowledge = renderSources(
    await findSources(conversation.siteId, lastVisitorMessage, conversation.currentPage)
  );

  const result = await getProvider().complete({
    system: COPILOT_SYSTEM,
    prompt: replyPrompt({
      context: describeConversation(conversation),
      transcript,
      knowledge,
      instruction: instruction ? String(instruction).slice(0, 500) : null
    }),
    maxTokens: COPILOT_MAX_TOKENS,
    temperature: 0.3
  });

  return { reply: result.text, model: result.model, usage: result.usage };
}

async function rewrite(
  _conversation: ConversationInput,
  { draft, tone = 'professional' }: { draft?: string; tone?: string } = {}
): Promise<ReplyResult> {
  if (!draft || !String(draft).trim()) {
    throw new AIError('Yeniden yazılacak metin boş.', { code: 'ai_missing_draft', status: 400 });
  }

  const result = await getProvider().complete({
    system: COPILOT_SYSTEM,
    prompt: rewritePrompt(String(draft).slice(0, MAX_INPUT_CHARS), tone),
    maxTokens: COPILOT_MAX_TOKENS,
    temperature: 0.3
  });

  return { reply: result.text, model: result.model, usage: result.usage };
}

async function translate(
  _conversation: ConversationInput,
  { text, targetLanguage }: { text?: string; targetLanguage?: string }
): Promise<TranslationResult> {
  if (!text || !String(text).trim()) {
    throw new AIError('Çevrilecek metin boş.', { code: 'ai_missing_text', status: 400 });
  }
  if (!targetLanguage || !String(targetLanguage).trim()) {
    throw new AIError('Hedef dil belirtilmedi.', { code: 'ai_missing_language', status: 400 });
  }

  const result = await getProvider().complete({
    system: TRANSLATE_SYSTEM,
    prompt: translatePrompt(
      String(text).slice(0, MAX_INPUT_CHARS),
      String(targetLanguage).slice(0, 40)
    ),
    maxTokens: COPILOT_MAX_TOKENS,
    temperature: 0
  });

  return { text: result.text, model: result.model, usage: result.usage };
}

// Sentiment, intent, category and a suggested priority in one request: they all
// need the same transcript, so asking four times would cost four times as much
// for the same reading.
async function analyze(conversation: ConversationInput): Promise<AnalysisResult> {
  const { transcript } = await buildTranscript(conversation._id);
  assertHasTranscript(transcript);

  const result = await getProvider().complete({
    system: COPILOT_SYSTEM,
    prompt: analysisPrompt(describeConversation(conversation), transcript),
    maxTokens: COPILOT_MAX_TOKENS,
    temperature: 0,
    responseSchema: ANALYSIS_SCHEMA
  });

  const parsed = parseJsonResponse(result.text);

  // The model's labels are constrained to the values the rest of the system
  // understands; anything else falls back rather than propagating a value the
  // Conversation model would reject.
  return {
    analysis: {
      sentiment: oneOf(SENTIMENTS, parsed.sentiment) ?? 'neutral',
      intent: typeof parsed.intent === 'string' ? parsed.intent.slice(0, 80) : '',
      category: typeof parsed.category === 'string' ? parsed.category.slice(0, 80) : '',
      suggestedPriority: oneOf(SUGGESTED_PRIORITIES, parsed.suggestedPriority),
      suggestedTags: Array.isArray(parsed.suggestedTags)
        ? parsed.suggestedTags
            .filter((tag): tag is string => typeof tag === 'string')
            .slice(0, 3)
            .map((tag) => tag.slice(0, 40))
        : [],
      reason: typeof parsed.reason === 'string' ? parsed.reason.slice(0, 300) : ''
    },
    model: result.model,
    usage: result.usage
  };
}

// Answers a question from the site's own published answers only, so the copilot
// cannot invent policy. Returns `answered: false` when the knowledge base does
// not cover it.
async function knowledgeAnswer(
  conversation: ConversationInput,
  { question }: { question?: string }
): Promise<KnowledgeAnswerResult> {
  if (!question || !String(question).trim()) {
    throw new AIError('Soru boş.', { code: 'ai_missing_question', status: 400 });
  }

  const sources = await findSources(
    conversation.siteId,
    String(question),
    conversation.currentPage
  );
  if (!sources.length) {
    return {
      answered: false,
      answer: null,
      reason: 'Bu soruya uyan yayınlanmış bilgi bankası içeriği yok.'
    };
  }

  const result = await getProvider().complete({
    system: COPILOT_SYSTEM,
    prompt: knowledgePrompt(String(question).slice(0, 1000), renderSources(sources)),
    maxTokens: COPILOT_MAX_TOKENS,
    temperature: 0,
    responseSchema: KNOWLEDGE_SCHEMA
  });

  const parsed = parseJsonResponse(result.text);
  // Strictly `true`: `Boolean("false")` is true, which is how the previous
  // version reported an answer the model had just said it did not have.
  const answer = typeof parsed.answer === 'string' ? parsed.answer.trim() : '';
  const answered = parsed.answered === true && answer.length > 0;
  const known = new Set(sources.map((s) => s.id));
  return {
    answered,
    answer: answered ? answer : null,
    usedEntries: Array.isArray(parsed.usedEntries)
      ? parsed.usedEntries.filter((id): id is string => typeof id === 'string' && known.has(id))
      : [],
    model: result.model,
    usage: result.usage
  };
}

export {
  summarize,
  suggestReply,
  rewrite,
  translate,
  analyze,
  knowledgeAnswer,
  buildTranscript,
  AIError
};
