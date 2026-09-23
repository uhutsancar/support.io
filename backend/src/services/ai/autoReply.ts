// The assistant answering a visitor on its own.
//
// Runs inside the backend process that received the visitor's message — no
// queue, no worker, no job table. The price of that simplicity is stated
// plainly: if the process dies mid-answer, that one message gets no automatic
// reply, and it is already in the assigned agent's inbox. Nothing is lost that
// a person would not see.
//
// The flow for one visitor message:
//
//   1. debounce   a second message within 800 ms replaces the first, so a
//                 visitor who types in bursts gets one answer to the last one
//   2. pre-check  a request for a person, sensitive data, the reply budget —
//                 decided in code, without calling the model (replyPolicy.ts)
//   3. model      one call with the matching FAQ entries; structured output
//   4. post-check numbers, links, claims and length checked against sources
//   5. deliver    a short transaction re-reads the conversation under a row
//                 lock and only then writes the reply — if an agent took over,
//                 the thread was closed, the site left auto mode or a newer
//                 message arrived while the model was writing, the answer is
//                 dropped. No lock or transaction is held during the model call.
//
// Whatever goes wrong, the visitor is never left with nothing: a failure hands
// the conversation to a person with a fixed text.

import Conversation from '../../models/Conversation';
import Department from '../../models/Department';
import Message from '../../models/Message';
import Site from '../../models/Site';
import { getProvider } from './index';
import { aiConfig } from '../../config/ai';
import { buildTranscript } from '../aiService';
import { isWithinBusinessHours } from '../businessHours';
import { findSources } from './knowledge';
import { checkReply, parseAutoReply, preCheck } from './replyPolicy';
import {
  AUTO_REPLY_SCHEMA,
  DECLINE_TEXT,
  PROMPT_VERSION,
  autoReplyPrompt,
  autoReplySystem
} from './prompts';
import { withTransaction, query } from '../../db/pool';
import { generateId } from '../../db/objectId';
import { AdminNotifier, WidgetNotifier } from '../../realtime';
import { isActiveConversationStatus } from '../../domain';
import type { Server } from 'socket.io';
import type { Doc } from '../../db/model';
import type { SiteDoc } from '../../models/Site';
import type { ConversationDoc } from '../../models/Conversation';
import type { AssistantPersona, ReplyLanguage } from './prompts';
import type { ReplyCheck } from './replyPolicy';
import type { MessageAiMetadata, ResponseOwner } from '../../domain';

/** A second visitor message inside this window replaces the first. */
export const DEBOUNCE_MS = 800;
/** How long the widget shows "typing" at most while the model writes. */
const TYPING_MS = 10000;
/** The context one answer is written from: the latest exchange only. */
const AUTO_REPLY_WINDOW = { messages: 10, chars: 3000 };
const AUTO_REPLY_MAX_TOKENS = 200;
const BOT_SENDER_ID = 'ai-assistant';
const DEFAULT_BOT_NAME = 'Asistan';

type Lang = 'tr' | 'en';

// The fixed texts a visitor may receive instead of a model answer. A site can
// replace the handoff line; none of these ever reaches a prompt.
const TEXT = {
  handoff: {
    tr: 'Sizi bir müşteri temsilcimize aktarıyorum; en kısa sürede buradan yanıt verecek.',
    en: "I'm passing you to one of our support agents; they will reply here shortly."
  },
  handoffAfterHours: {
    tr: 'Sizi bir müşteri temsilcimize aktarıyorum. Şu anda mesai saatleri dışındayız; ekibimiz mesai başladığında buradan yanıt verecek.',
    en: "I'm passing you to one of our support agents. We're outside business hours right now; the team will reply here once they are back."
  },
  sensitive: {
    tr: 'Güvenliğiniz için kart, IBAN veya kimlik bilgilerinizi sohbette paylaşmayın. Sizi bir müşteri temsilcimize aktarıyorum.',
    en: "For your security, please don't share card, IBAN or ID numbers in chat. I'm passing you to one of our support agents."
  },
  failure: {
    tr: 'Şu anda otomatik yanıt veremiyorum; sizi bir müşteri temsilcimize aktarıyorum.',
    en: "I can't answer automatically right now; I'm passing you to one of our support agents."
  },
  signIn: {
    tr: 'Siparişinizin durumunu görebilmem için lütfen siteye giriş yapın; giriş yaptıktan sonra sorunuzu buradan tekrar yazabilirsiniz.',
    en: 'Please sign in to the site so I can see your order; once you have, ask me again here.'
  }
} as const;

// --------------------------------------------------------------- the switch

/**
 * True when the assistant, and not the FAQ keyword bot, answers on this site.
 * Both platform switches and the site's own mode have to agree.
 */
export function assistantActive(site: Pick<SiteDoc, 'aiSettings'>): boolean {
  return Boolean(aiConfig()?.autoReplyEnabled) && site.aiSettings?.mode === 'auto';
}

// ------------------------------------------------------------ in-flight work

const pending = new Map<string, ReturnType<typeof setTimeout>>();
const running = new Map<string, AbortController>();

/** Stops any answer being prepared for this conversation. */
export function cancelAutoReply(conversationId: unknown): void {
  const id = String(conversationId);
  const timer = pending.get(id);
  if (timer) clearTimeout(timer);
  pending.delete(id);
  running.get(id)?.abort();
  running.delete(id);
}

/** Called on shutdown, so no timer outlives the server. */
export function stopAutoReplies(): void {
  for (const id of [...pending.keys(), ...running.keys()]) cancelAutoReply(id);
}

/**
 * Queues an answer to a visitor message. Returns immediately: the message
 * itself and its broadcast to the inbox are never delayed by the model.
 */
export function scheduleAutoReply(io: Server, conversationId: unknown, messageId: unknown): void {
  const id = String(conversationId);
  // A newer message supersedes whatever was being written for an older one.
  cancelAutoReply(id);
  pending.set(
    id,
    setTimeout(() => {
      pending.delete(id);
      void start(io, id, String(messageId));
    }, DEBOUNCE_MS)
  );
}

async function start(io: Server, conversationId: string, messageId: string): Promise<void> {
  const controller = new AbortController();
  running.set(conversationId, controller);
  try {
    await answer(io, conversationId, messageId, controller.signal);
  } catch (error) {
    // Only an identifier and a class of failure: the error text can quote the
    // visitor or the model.
    console.error(
      `[ai] auto-reply failed conversation=${conversationId} error=${(error as { code?: string })?.code || (error as Error)?.name || 'unknown'}`
    );
  } finally {
    if (running.get(conversationId) === controller) running.delete(conversationId);
  }
}

// ------------------------------------------------------------------ helpers

function personaFor(site: Doc<SiteDoc>): AssistantPersona {
  const settings = site.aiSettings;
  return {
    botName: settings.botName || DEFAULT_BOT_NAME,
    siteName: site.name,
    tone: settings.tone === 'friendly' ? 'friendly' : 'professional',
    answerLength: settings.answerLength === 'normal' ? 'normal' : 'short'
  };
}

/**
 * A best guess at the visitor's language, for the fixed texts sent when the
 * model is not asked or did not answer. Turkish unless the message reads as
 * English.
 */
export function guessLanguage(text: string): Lang {
  if (/[çğıöşüİ]/i.test(text)) return 'tr';
  const english = text.match(
    /\b(the|what|how|is|are|my|order|please|hello|hi|want|where|can|you|i)\b/gi
  );
  return english && english.length >= 2 ? 'en' : 'tr';
}

const toLang = (language: ReplyLanguage | null, fallback: Lang): Lang =>
  language === 'en' || language === 'tr' ? language : fallback;

export function verifiedUserId(conversation: Pick<ConversationDoc, 'metadata'>): string | null {
  const value = conversation.metadata?.verifiedUserId;
  return typeof value === 'string' && value ? value : null;
}

async function handoffText(
  site: Doc<SiteDoc>,
  conversation: Doc<ConversationDoc>,
  lang: Lang
): Promise<string> {
  const department = conversation.department
    ? await Department.findById(conversation.department)
    : null;
  if (department && !isWithinBusinessHours(department)) return TEXT.handoffAfterHours[lang];
  return site.aiSettings.handoffMessage || TEXT.handoff[lang];
}

// ---------------------------------------------------------------- delivery

interface Delivery {
  conversationId: string;
  /** The ownership version the answer was written under. */
  version: number;
  /** The visitor message being answered; null when the visitor pressed a button. */
  answering: string | null;
  senderName: string;
  content: string;
  metadata: MessageAiMetadata;
  /** True when this message hands the conversation to a person. */
  handOver: boolean;
}

/**
 * Writes the reply if it is still wanted, in one short transaction.
 *
 * Everything that could have changed while the model was writing is checked
 * again under a row lock: who owns the conversation, whether it changed hands
 * in between, whether it is still open, whether this is still the visitor's
 * latest message, and whether the site is still in auto mode.
 */
async function deliver(io: Server, delivery: Delivery): Promise<boolean> {
  const messageId = await withTransaction(async (client) => {
    const { rows } = await client.query<{
      response_owner: ResponseOwner;
      ai_control_version: number;
      status: string;
      site_id: string;
    }>(
      `SELECT response_owner, ai_control_version, status, site_id
         FROM conversations WHERE id = $1 FOR UPDATE`,
      [delivery.conversationId]
    );
    const row = rows[0];
    if (
      !row ||
      row.response_owner !== 'ai' ||
      row.ai_control_version !== delivery.version ||
      !isActiveConversationStatus(row.status)
    ) {
      return null;
    }

    if (delivery.answering) {
      const latest = await client.query<{ id: string }>(
        `SELECT id FROM messages WHERE conversation_id = $1 AND sender_type = 'visitor'
          ORDER BY created_at DESC, id DESC LIMIT 1`,
        [delivery.conversationId]
      );
      if (latest.rows[0]?.id !== delivery.answering) return null;
    }

    const site = await client.query<{ mode: string | null }>(
      `SELECT ai_settings->>'mode' AS mode FROM sites WHERE id = $1`,
      [row.site_id]
    );
    if (site.rows[0]?.mode !== 'auto') return null;

    const id = generateId();
    await client.query(
      `INSERT INTO messages (id, conversation_id, sender_type, sender_id, sender_name, content,
                             message_type, is_read, ai_metadata, created_at, updated_at)
       VALUES ($1, $2, 'bot', $3, $4, $5, 'text', true, $6, now(), now())`,
      [
        id,
        delivery.conversationId,
        BOT_SENDER_ID,
        delivery.senderName,
        delivery.content,
        JSON.stringify(delivery.metadata)
      ]
    );
    // An automatic reply is not a first response: first_response_at stays
    // the agent's, so SLA figures keep measuring people.
    await client.query(
      delivery.handOver
        ? `UPDATE conversations SET last_message_at = now(), response_owner = 'human',
                  ai_control_version = ai_control_version + 1 WHERE id = $1`
        : `UPDATE conversations SET last_message_at = now() WHERE id = $1`,
      [delivery.conversationId]
    );
    return id;
  });
  if (!messageId) return false;

  const [message, conversation] = await Promise.all([
    Message.findById(messageId),
    Conversation.findById(delivery.conversationId)
  ]);
  if (!message || !conversation) return true;

  new WidgetNotifier(io).newMessage(conversation._id, message);
  const admin = new AdminNotifier(io);
  admin.messageAdded(conversation, message);
  if (delivery.handOver) {
    admin.responseOwnerChanged(conversation, 'human', conversation.aiControlVersion);
  }
  return true;
}

// ------------------------------------------------------------------ answer

async function answer(
  io: Server,
  conversationId: string,
  messageId: string,
  signal: AbortSignal
): Promise<void> {
  const started = Date.now();
  const conversation = await Conversation.findById(conversationId);
  if (
    !conversation ||
    conversation.responseOwner !== 'ai' ||
    !isActiveConversationStatus(conversation.status)
  ) {
    return;
  }
  const [site, message] = await Promise.all([
    Site.findById(conversation.siteId),
    Message.findById(messageId)
  ]);
  if (!site || !message || !assistantActive(site)) return;

  const persona = personaFor(site);
  const version = conversation.aiControlVersion;
  const question = String(message.content || '');
  let lang = guessLanguage(question);

  const base = { conversationId, version, answering: messageId, senderName: persona.botName };
  const metadata = (
    decision: string,
    extra: Partial<MessageAiMetadata> = {}
  ): MessageAiMetadata => ({
    decision,
    sourceIds: [],
    promptVersion: PROMPT_VERSION,
    durationMs: Date.now() - started,
    ...extra
  });
  const log = (decision: string, reason?: string | null) =>
    console.log(
      `[ai] auto-reply conversation=${conversationId} decision=${decision}${reason ? ` reason=${reason}` : ''} ms=${Date.now() - started}`
    );

  const handOff = async (reason: string, text?: string) => {
    if (signal.aborted) return;
    const content = text ?? (await handoffText(site, conversation, lang));
    const sent = await deliver(io, {
      ...base,
      content,
      metadata: metadata('handoff', { reason }),
      handOver: true
    });
    if (sent) log('handoff', reason);
  };

  // --- before the model: the budget and the rules that need no model.
  const recent = await Message.find({ conversationId, senderType: 'bot' })
    .sort({ createdAt: -1 })
    .limit(50);
  const aiReplies = recent.filter((m) => m.aiMetadata);
  const blocked = preCheck({
    text: question,
    botReplies: aiReplies.length,
    recentDecisions: aiReplies.map((m) => m.aiMetadata?.decision ?? ''),
    maxBotReplies: site.aiSettings.maxBotReplies || 8,
    blockedTerms: site.aiSettings.blockedTerms || []
  });
  if (blocked) {
    return handOff(blocked, blocked === 'sensitive_data' ? TEXT.sensitive[lang] : undefined);
  }

  new WidgetNotifier(io).toConversation(conversationId, 'agent-typing', {
    conversationId,
    durationMs: TYPING_MS
  });

  const [{ transcript }, sources] = await Promise.all([
    buildTranscript(conversationId, AUTO_REPLY_WINDOW),
    findSources(site._id, question, conversation.currentPage)
  ]);

  let output;
  try {
    const result = await getProvider().complete({
      system: autoReplySystem(persona),
      prompt: autoReplyPrompt({
        transcript,
        sources,
        question,
        customerVerified: verifiedUserId(conversation) !== null
      }),
      maxTokens: AUTO_REPLY_MAX_TOKENS,
      temperature: 0,
      responseSchema: AUTO_REPLY_SCHEMA,
      signal
    });
    output = parseAutoReply(result.text);
  } catch (error) {
    if (signal.aborted) return;
    return handOff((error as { code?: string })?.code || 'ai_error', TEXT.failure[lang]);
  }
  if (signal.aborted) return;

  lang = toLang(output.language, lang);
  if (output.language === 'other') return handOff('language');

  const send = async (
    decision: string,
    content: string,
    extra: Partial<MessageAiMetadata> = {}
  ) => {
    const sent = await deliver(io, {
      ...base,
      content,
      metadata: metadata(decision, extra),
      handOver: false
    });
    if (sent) log(decision, extra.reason);
  };

  switch (output.decision) {
    case 'handoff':
      return handOff('no_answer');

    case 'order_lookup':
      // Order data is only ever fetched for a customer the shop has vouched
      // for (see services/identity.ts). Anyone else is asked to sign in.
      if (!verifiedUserId(conversation)) {
        return send('order_lookup', TEXT.signIn[lang], { reason: 'not_signed_in' });
      }
      return handOff('order_lookup_unavailable');

    case 'decline': {
      const rejected = checkReply(limits('decline', output.answer, [], []));
      // A refusal that fails its checks is replaced by the fixed refusal,
      // never passed on and never escalated: there is nothing to answer.
      return send('decline', rejected ? DECLINE_TEXT[lang] : (output.answer as string), {
        reason: rejected ? `replaced:${rejected}` : null
      });
    }

    default: {
      const given = sources.map((s) => s.id);
      const rejected = checkReply(
        limits(
          output.decision,
          output.answer,
          output.sourceIds,
          given,
          sources.map((s) => s.answer),
          persona
        )
      );
      if (rejected) return handOff(`rejected:${rejected}`);
      const used = sources.filter((s) => output.sourceIds.includes(s.id));
      return send(output.decision, output.answer as string, {
        sourceIds: used.map((s) => s.id),
        sources: used.map((s) => s.question)
      });
    }
  }
}

/** The length rules for one kind of reply; see replyPolicy.checkReply. */
function limits(
  decision: 'small_talk' | 'answer' | 'clarify' | 'decline',
  answerText: string | null,
  sourceIds: readonly string[],
  allowedSourceIds: readonly string[],
  evidence: readonly string[] = [],
  persona?: AssistantPersona
): ReplyCheck {
  const sentences = decision === 'answer' ? (persona?.answerLength === 'normal' ? 3 : 2) : 2;
  return {
    decision,
    answer: answerText,
    sourceIds,
    allowedSourceIds,
    evidence,
    maxSentences: sentences,
    maxChars: decision === 'decline' ? 400 : 350
  };
}

// ------------------------------------------------------- changing hands

/**
 * Hands a conversation to a person or back to the assistant.
 *
 * One atomic statement, so two agents pressing "take over" at once cannot
 * both win, and the version bump is what makes an answer the model is still
 * writing recognisably stale when it tries to deliver. Returns null when the
 * conversation was already with that owner.
 */
export async function setResponseOwner(
  io: Server | null,
  conversation: { _id: unknown; siteId: unknown },
  owner: ResponseOwner
): Promise<{ responseOwner: ResponseOwner; aiControlVersion: number } | null> {
  if (owner === 'human') cancelAutoReply(conversation._id);
  const { rows } = await query<{ response_owner: ResponseOwner; ai_control_version: number }>(
    `UPDATE conversations
        SET response_owner = $2, ai_control_version = ai_control_version + 1
      WHERE id = $1 AND response_owner <> $2
      RETURNING response_owner, ai_control_version`,
    [String(conversation._id), owner]
  );
  const row = rows[0];
  if (!row) return null;
  if (io)
    new AdminNotifier(io).responseOwnerChanged(
      conversation,
      row.response_owner,
      row.ai_control_version
    );
  return { responseOwner: row.response_owner, aiControlVersion: row.ai_control_version };
}

/**
 * The visitor pressed "talk to a person": hand over with the usual note.
 * Nothing happens when a person already has the conversation.
 */
export async function requestHuman(
  io: Server,
  conversationId: string,
  language?: string
): Promise<boolean> {
  cancelAutoReply(conversationId);
  const conversation = await Conversation.findById(conversationId);
  if (!conversation || conversation.responseOwner !== 'ai') return false;
  const site = await Site.findById(conversation.siteId);
  if (!site) return false;
  const lang: Lang = language === 'en' ? 'en' : 'tr';
  return deliver(io, {
    conversationId,
    version: conversation.aiControlVersion,
    answering: null,
    senderName: personaFor(site).botName,
    content: await handoffText(site, conversation, lang),
    metadata: {
      decision: 'handoff',
      reason: 'human_requested',
      sourceIds: [],
      promptVersion: PROMPT_VERSION,
      durationMs: 0
    },
    handOver: true
  });
}
