'use strict';

// The AI copilot's support operations.
//
// Every task here is advisory. Nothing in this file sends a message to a
// visitor, changes a conversation's status or writes a tag: the routes hand the
// result back to the agent, who accepts, edits, regenerates or rejects it. That
// boundary is deliberate — an automated reply that reaches a customer without a
// human reading it is a support incident, not a feature.

const { getProvider, AIError } = require('./ai');
const Message = require('../models/Message');
const FAQ = require('../models/FAQ');

// How much transcript to send. Long threads are truncated from the front so the
// most recent exchange — the part a reply must respond to — always survives.
const MAX_TRANSCRIPT_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 2000;

const SPEAKER = { visitor: 'Müşteri', agent: 'Temsilci', bot: 'Bot' };

// Renders a conversation as a plain transcript for the prompt.
async function buildTranscript(conversationId) {
  const messages = await Message.find({ conversationId })
    .sort({ createdAt: 1 })
    .limit(200);

  if (!messages.length) return { transcript: '', messageCount: 0 };

  const recent = messages.slice(-MAX_TRANSCRIPT_MESSAGES);
  const transcript = recent
    .map((m) => {
      const who = SPEAKER[m.senderType] || m.senderType;
      const body = String(m.content || '').slice(0, MAX_MESSAGE_CHARS);
      return `${who}: ${body}`;
    })
    .join('\n');

  return { transcript, messageCount: messages.length, truncated: messages.length > recent.length };
}

// Conversation metadata worth giving the model alongside the transcript.
function describeConversation(conversation) {
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

// Pulls the site's published answers in so a suggested reply can reuse the
// wording support already stands behind rather than inventing policy. This is
// the knowledge-base hook: the same shape works when articles replace FAQs.
async function buildKnowledgeContext(siteId, limit = 12) {
  const faqs = await FAQ.find({ siteId, isActive: true })
    .sort({ order: 1 })
    .limit(limit);

  if (!faqs.length) return '';

  return faqs
    .map((f, i) => `${i + 1}. S: ${f.question}\n   C: ${String(f.answer).slice(0, 600)}`)
    .join('\n');
}

const BASE_SYSTEM = [
  'Sen bir müşteri destek ekibine yardım eden asistansın.',
  'Yanıtların doğrudan müşteriye gitmez; bir destek temsilcisi önce okur ve onaylar.',
  'Türkçe yaz. Kısa, net ve profesyonel ol.',
  'Emin olmadığın bilgiyi uydurma; bilgi eksikse bunu açıkça belirt.'
].join(' ');

// Strips code fences a model sometimes wraps JSON in.
function parseJsonResponse(text) {
  const cleaned = text
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    throw new AIError('Model beklenen JSON biçiminde yanıt vermedi.', {
      code: 'ai_bad_format',
      status: 502,
      retryable: true
    });
  }
}

// Guards every task: an empty thread has nothing to reason about, and calling
// the model anyway spends money to produce a confident hallucination.
function assertHasTranscript(transcript) {
  if (!transcript || !transcript.trim()) {
    throw new AIError('Bu konuşmada henüz mesaj yok.', {
      code: 'ai_no_messages',
      status: 400
    });
  }
}

// --- tasks -----------------------------------------------------------------

async function summarize(conversation) {
  const { transcript } = await buildTranscript(conversation._id);
  assertHasTranscript(transcript);

  const result = await getProvider().complete({
    system: BASE_SYSTEM,
    prompt: [
      'Aşağıdaki destek konuşmasını temsilci için özetle.',
      '',
      describeConversation(conversation),
      '',
      'Konuşma:',
      transcript,
      '',
      'Biçim:',
      '- En fazla 3 madde.',
      '- İlk madde müşterinin asıl talebi.',
      '- Son madde bekleyen aksiyon (yoksa "Bekleyen aksiyon yok").'
    ].join('\n'),
    maxTokens: 700
  });

  return { summary: result.text, model: result.model, usage: result.usage };
}

async function suggestReply(conversation, { instruction = null } = {}) {
  const { transcript } = await buildTranscript(conversation._id);
  assertHasTranscript(transcript);

  const knowledge = await buildKnowledgeContext(conversation.siteId);

  const prompt = [
    'Temsilcinin müşteriye göndereceği yanıtı taslak olarak yaz.',
    '',
    describeConversation(conversation),
    '',
    'Konuşma:',
    transcript
  ];

  if (knowledge) {
    prompt.push(
      '',
      'Sitenin yayınlanmış cevapları (uygunsa bunlarla tutarlı ol, çelişme):',
      knowledge
    );
  }
  if (instruction) {
    prompt.push('', `Temsilcinin ek talimatı: ${instruction}`);
  }

  prompt.push(
    '',
    'Kurallar:',
    '- Sadece gönderilecek mesajı yaz, başlık veya açıklama ekleme.',
    '- Bilmediğin bir bilgiyi uydurma; gerekirse bilgiyi kontrol edeceğini söyle.',
    '- Söz verme (kesin tarih, iade garantisi vb.) yetkin yoksa verme.'
  );

  const result = await getProvider().complete({
    system: BASE_SYSTEM,
    prompt: prompt.join('\n'),
    maxTokens: 1000,
    effort: 'medium'
  });

  return { reply: result.text, model: result.model, usage: result.usage };
}

async function rewrite(conversation, { draft, tone = 'professional' } = {}) {
  if (!draft || !String(draft).trim()) {
    throw new AIError('Yeniden yazılacak metin boş.', { code: 'ai_missing_draft', status: 400 });
  }

  const tones = {
    professional: 'profesyonel ve nötr',
    friendly: 'sıcak ve samimi',
    concise: 'mümkün olduğunca kısa',
    apologetic: 'özür dileyen ve empatik'
  };

  const result = await getProvider().complete({
    system: BASE_SYSTEM,
    prompt: [
      `Aşağıdaki taslağı ${tones[tone] || tones.professional} bir tonda yeniden yaz.`,
      'Anlamı değiştirme, yeni bilgi ekleme. Sadece yeni metni döndür.',
      '',
      'Taslak:',
      String(draft).slice(0, 4000)
    ].join('\n'),
    maxTokens: 1000
  });

  return { reply: result.text, model: result.model, usage: result.usage };
}

async function translate(conversation, { text, targetLanguage }) {
  if (!text || !String(text).trim()) {
    throw new AIError('Çevrilecek metin boş.', { code: 'ai_missing_text', status: 400 });
  }
  if (!targetLanguage || !String(targetLanguage).trim()) {
    throw new AIError('Hedef dil belirtilmedi.', { code: 'ai_missing_language', status: 400 });
  }

  const result = await getProvider().complete({
    system: 'Sen bir çevirmensin. Yalnızca çeviriyi döndür, açıklama ekleme.',
    prompt: [
      `Aşağıdaki metni ${targetLanguage} diline çevir.`,
      'Ton ve nezaket seviyesini koru.',
      '',
      String(text).slice(0, 4000)
    ].join('\n'),
    maxTokens: 1000
  });

  return { text: result.text, model: result.model, usage: result.usage };
}

// Sentiment, intent, category and a suggested priority in one request: they all
// need the same transcript, so asking four times would cost four times as much
// for the same reading.
async function analyze(conversation) {
  const { transcript } = await buildTranscript(conversation._id);
  assertHasTranscript(transcript);

  const result = await getProvider().complete({
    system: BASE_SYSTEM,
    prompt: [
      'Aşağıdaki destek konuşmasını sınıflandır.',
      '',
      describeConversation(conversation),
      '',
      'Konuşma:',
      transcript,
      '',
      'Yalnızca şu JSON şemasında yanıt ver, başka hiçbir şey yazma:',
      '{',
      '  "sentiment": "positive" | "neutral" | "negative",',
      '  "intent": "<kısa niyet etiketi>",',
      '  "category": "<kısa kategori>",',
      '  "suggestedPriority": "low" | "normal" | "high" | "urgent",',
      '  "suggestedTags": ["<en fazla 3 etiket>"],',
      '  "reason": "<tek cümle gerekçe>"',
      '}'
    ].join('\n'),
    maxTokens: 600
  });

  const parsed = parseJsonResponse(result.text);

  // The model's labels are constrained to the values the rest of the system
  // understands; anything else falls back rather than propagating a value the
  // Conversation model would reject.
  const sentiments = ['positive', 'neutral', 'negative'];
  const priorities = ['low', 'normal', 'high', 'urgent'];

  return {
    analysis: {
      sentiment: sentiments.includes(parsed.sentiment) ? parsed.sentiment : 'neutral',
      intent: String(parsed.intent || '').slice(0, 80),
      category: String(parsed.category || '').slice(0, 80),
      suggestedPriority: priorities.includes(parsed.suggestedPriority) ? parsed.suggestedPriority : null,
      suggestedTags: Array.isArray(parsed.suggestedTags)
        ? parsed.suggestedTags.slice(0, 3).map((t) => String(t).slice(0, 40))
        : [],
      reason: String(parsed.reason || '').slice(0, 300)
    },
    model: result.model,
    usage: result.usage
  };
}

// Answers a question from the site's own published answers only, so the copilot
// cannot invent policy. Returns `answered: false` when the knowledge base does
// not cover it.
async function knowledgeAnswer(conversation, { question }) {
  if (!question || !String(question).trim()) {
    throw new AIError('Soru boş.', { code: 'ai_missing_question', status: 400 });
  }

  const knowledge = await buildKnowledgeContext(conversation.siteId, 20);
  if (!knowledge) {
    return {
      answered: false,
      answer: null,
      reason: 'Bu site için yayınlanmış bilgi bankası içeriği yok.'
    };
  }

  const result = await getProvider().complete({
    system: BASE_SYSTEM,
    prompt: [
      'Aşağıdaki soruyu YALNIZCA verilen bilgi bankası içeriğine dayanarak yanıtla.',
      'İçerikte cevap yoksa uydurma; answered alanını false yap.',
      '',
      `Soru: ${String(question).slice(0, 1000)}`,
      '',
      'Bilgi bankası:',
      knowledge,
      '',
      'Yalnızca şu JSON ile yanıt ver:',
      '{ "answered": true | false, "answer": "<cevap veya null>", "usedEntries": [<kullanılan madde numaraları>] }'
    ].join('\n'),
    maxTokens: 800
  });

  const parsed = parseJsonResponse(result.text);
  return {
    answered: Boolean(parsed.answered),
    answer: parsed.answered ? String(parsed.answer || '') : null,
    usedEntries: Array.isArray(parsed.usedEntries) ? parsed.usedEntries.slice(0, 10) : [],
    model: result.model,
    usage: result.usage
  };
}

module.exports = {
  summarize,
  suggestReply,
  rewrite,
  translate,
  analyze,
  knowledgeAnswer,
  buildTranscript,
  AIError
};
