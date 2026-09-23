'use strict';

// Unit cover for the AI provider abstraction and the service's parsing rules.
//
// Runs in-process with a stub provider, so it needs no API key, no network and
// no running server. What it pins is the logic that would otherwise only be
// exercised on a live call: error translation, JSON handling, value clamping,
// and transcript assembly.

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import { AIProvider, DisabledProvider } from '../src/services/ai/provider';
import type { AICompletion, AICompletionRequest } from '../src/services/ai/provider';
import { setProvider, resetProvider } from '../src/services/ai';
import * as aiService from '../src/services/aiService';
import Message from '../src/models/Message';
import FAQ from '../src/models/FAQ';
import Organization from '../src/models/Organization';
import Site from '../src/models/Site';
import { findSources } from '../src/services/ai/knowledge';
import { generateId } from '../src/db/objectId';
import { getPool, query } from '../src/db/pool';

/** A scripted reply: a fixed completion, fixed text, or a function of the request. */
type StubReply =
  string | AICompletion | ((request: AICompletionRequest) => AICompletion | Promise<AICompletion>);

// Records what it was asked and answers with a scripted reply.
class StubProvider extends AIProvider {
  reply: StubReply;
  calls: AICompletionRequest[];

  constructor(reply: StubReply) {
    super();
    this.reply = reply;
    this.calls = [];
  }
  override get name(): string {
    return 'stub';
  }
  override get isConfigured(): boolean {
    return true;
  }
  override async complete(request: AICompletionRequest): Promise<AICompletion> {
    this.calls.push(request);
    if (typeof this.reply === 'function') return this.reply(request);
    return {
      text: this.reply as string,
      model: 'stub-model',
      usage: { inputTokens: 1, outputTokens: 1 }
    };
  }
}

test('the disabled provider refuses instead of returning content', async () => {
  const provider = new DisabledProvider();
  assert.equal(provider.isConfigured, false);

  await assert.rejects(
    () => provider.complete({ prompt: 'anything', maxTokens: 8, temperature: 0 }),
    (err: any) => {
      assert.equal(err.name, 'AIError');
      assert.equal(err.code, 'ai_not_configured');
      assert.equal(err.status, 503);
      return true;
    }
  );
});

test('the base provider refuses to be used directly', async () => {
  const provider = new AIProvider();
  assert.equal(provider.isConfigured, false);
  await assert.rejects(
    () => provider.complete({ prompt: '', maxTokens: 8, temperature: 0 }),
    /must implement complete/
  );
  assert.throws(() => provider.name, /must define a name/);
});

test('analyze clamps model output to values the rest of the system accepts', async (t) => {
  // A model answering with labels outside the enum must not reach the
  // Conversation model, which would reject them.
  const stub = new StubProvider(
    JSON.stringify({
      sentiment: 'furious',
      intent: 'x'.repeat(500),
      category: 'refund',
      suggestedPriority: 'catastrophic',
      suggestedTags: ['a', 'b', 'c', 'd', 'e'],
      reason: 'test'
    })
  );
  setProvider(stub);
  t.after(() => resetProvider());

  const conversation = {
    _id: 'c1',
    siteId: 's1',
    ticketId: '#0001',
    status: 'open',
    priority: 'normal',
    channel: 'web-chat'
  };

  // Transcript loading is stubbed out via a fake conversation with messages
  // already in the database is unnecessary — analyze only needs a non-empty
  // transcript, so the message lookup is patched for this test.
  const original = aiService.buildTranscript;
  const { analysis } = await (async () => {
    const originalFind = Message.find;
    // A stub stands in for the query builder; only the shape the service walks
    // matters here, so the assignment is deliberately untyped.
    Message.find = (() => ({
      sort: () => ({ limit: async () => [{ senderType: 'visitor', content: 'iade istiyorum' }] })
    })) as any;
    try {
      return await aiService.analyze(conversation);
    } finally {
      Message.find = originalFind;
    }
  })();

  assert.equal(
    analysis.sentiment,
    'neutral',
    'an unknown sentiment must fall back, not pass through'
  );
  assert.equal(analysis.suggestedPriority, null, 'an unknown priority must not be suggested');
  assert.ok(analysis.intent.length <= 80, 'intent must be bounded');
  assert.equal(analysis.suggestedTags.length, 3, 'at most three tags');
  assert.ok(original);
});

test('analyze reports a clear error when the model does not return JSON', async (t) => {
  setProvider(new StubProvider('Buyurun, elbette yardımcı olayım!'));
  t.after(() => resetProvider());

  const originalFind = Message.find;
  Message.find = (() => ({
    sort: () => ({ limit: async () => [{ senderType: 'visitor', content: 'merhaba' }] })
  })) as any;

  try {
    await assert.rejects(
      () =>
        aiService.analyze({
          _id: 'c1',
          siteId: 's1',
          status: 'open',
          priority: 'normal',
          channel: 'web-chat'
        }),
      (err: any) => {
        assert.equal(err.code, 'ai_bad_format');
        assert.equal(err.retryable, true, 'a formatting miss is worth retrying');
        return true;
      }
    );
  } finally {
    Message.find = originalFind;
  }
});

test('a JSON reply wrapped in a code fence is still parsed', async (t) => {
  setProvider(
    new StubProvider('```json\n{"answered": true, "answer": "14 gün", "usedEntries": [2]}\n```')
  );
  t.after(() => resetProvider());

  const originalFind = FAQ.find;
  FAQ.find = (() => ({
    sort: () => ({
      limit: async () => [{ question: 'İade süresi?', answer: '14 gün içinde iade edebilirsiniz.' }]
    })
  })) as any;

  try {
    const result = await aiService.knowledgeAnswer(
      { _id: 'c1', siteId: 's1' },
      { question: 'İade süresi nedir?' }
    );
    assert.equal(result.answered, true);
    assert.equal(result.answer, '14 gün');
  } finally {
    FAQ.find = originalFind;
  }
});

test('knowledge answer reports honestly when there is nothing to answer from', async (t) => {
  const stub = new StubProvider('{"answered": true, "answer": "uydurma"}');
  setProvider(stub);
  t.after(() => resetProvider());

  const originalFind = FAQ.find;
  const originalCount = FAQ.countDocuments;
  FAQ.find = (() => ({ sort: () => ({ limit: async () => [] }) })) as any;
  FAQ.countDocuments = (async () => 0) as any;

  try {
    const result = await aiService.knowledgeAnswer(
      { _id: 'c1', siteId: 's1' },
      { question: 'herhangi bir soru' }
    );
    assert.equal(result.answered, false);
    assert.equal(result.answer, null);
    assert.equal(stub.calls.length, 0, 'with no knowledge base there is nothing to ask the model');
  } finally {
    FAQ.find = originalFind;
    FAQ.countDocuments = originalCount;
  }
});

test('the suggested reply prompt carries the knowledge base and the transcript', async (t) => {
  const stub = new StubProvider('Merhaba, iade talebinizi oluşturdum.');
  setProvider(stub);
  t.after(() => resetProvider());

  const originalMessageFind = Message.find;
  const originalFaqFind = FAQ.find;
  Message.find = (() => ({
    sort: () => ({
      limit: async () => [{ senderType: 'visitor', senderName: 'Ali', content: 'iade istiyorum' }]
    })
  })) as any;
  FAQ.find = (() => ({
    sort: () => ({ limit: async () => [{ question: 'İade?', answer: '14 gün içinde iade.' }] })
  })) as any;

  try {
    const result = await aiService.suggestReply(
      {
        _id: 'c1',
        siteId: 's1',
        ticketId: '#0007',
        status: 'open',
        priority: 'high',
        channel: 'web-chat',
        visitorName: 'Ali'
      },
      { instruction: 'Kısa tut' }
    );

    assert.equal(result.reply, 'Merhaba, iade talebinizi oluşturdum.');
    const prompt = stub.calls[0].prompt;
    assert.match(prompt, /iade istiyorum/, 'the transcript must reach the prompt');
    assert.match(prompt, /14 gün içinde iade/, 'the knowledge base must reach the prompt');
    assert.match(prompt, /Kısa tut/, "the agent's instruction must reach the prompt");
    assert.match(prompt, /#0007/, 'conversation context must reach the prompt');
  } finally {
    Message.find = originalMessageFind;
    FAQ.find = originalFaqFind;
  }
});

test('an empty transcript is refused before the provider is called', async (t) => {
  const stub = new StubProvider('should never be produced');
  setProvider(stub);
  t.after(() => resetProvider());

  const originalFind = Message.find;
  Message.find = (() => ({ sort: () => ({ limit: async () => [] }) })) as any;

  try {
    await assert.rejects(
      () =>
        aiService.summarize({
          _id: 'c1',
          siteId: 's1',
          status: 'open',
          priority: 'normal',
          channel: 'web-chat'
        }),
      (err: any) => {
        assert.equal(err.code, 'ai_no_messages');
        return true;
      }
    );
    assert.equal(stub.calls.length, 0, 'no model call may be spent on an empty conversation');
  } finally {
    Message.find = originalFind;
  }
});

test('a long thread is read from its newest end', async () => {
  // 250 messages, oldest first. The previous reader loaded the first 200 and
  // never saw the last fifty — the ones a reply has to answer.
  const thread = Array.from({ length: 250 }, (_, i) => ({
    senderType: i % 2 ? 'agent' : 'visitor',
    content: `mesaj-${i}`,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i))
  }));

  const originalFind = Message.find;
  // Honours the sort and limit the reader asks for, like the database would.
  Message.find = (() => {
    let rows = [...thread];
    const chain = {
      sort(spec: { createdAt: number }) {
        rows.sort((a, b) => (a.createdAt.getTime() - b.createdAt.getTime()) * spec.createdAt);
        return chain;
      },
      async limit(n: number) {
        rows = rows.slice(0, n);
        return rows;
      }
    };
    return chain;
  }) as any;

  try {
    const result = await aiService.buildTranscript('c1');
    const lines = result.transcript.split('\n');
    assert.equal(lines.at(-1), 'Temsilci: mesaj-249', 'the newest message must be last');
    assert.ok(result.transcript.includes('mesaj-248'));
    assert.ok(!result.transcript.includes('mesaj-0\n'), 'the oldest messages are the ones dropped');
    assert.equal(result.lastVisitorMessage, 'mesaj-248');
    assert.equal(result.truncated, true);

    const narrow = await aiService.buildTranscript('c1', { messages: 10, chars: 3000 });
    assert.equal(narrow.messageCount, 10);
    assert.equal(narrow.transcript.split('\n')[0], 'Müşteri: mesaj-240');
  } finally {
    Message.find = originalFind;
  }
});

test('FAQ sources are chosen by the question, from this site only', async (t) => {
  const org = await new Organization({ name: `ai-knowledge-${Date.now()}` }).save();
  t.after(async () => {
    await query('DELETE FROM organizations WHERE id = $1', [org._id]);
  });
  const site = await new Site({
    name: 'Bilgi',
    domain: 'bilgi.test',
    siteKey: `k-${generateId()}`,
    organizationId: org._id
  }).save();
  const other = await new Site({
    name: 'Başka',
    domain: 'baska.test',
    siteKey: `k-${generateId()}`,
    organizationId: org._id
  }).save();

  const entries = [
    ['Kargo ne kadar sürede gelir?', '1-3 iş günü içinde kargoya verilir.', ['kargo']],
    ['İade koşulları nelerdir?', '14 gün içinde iade edebilirsiniz.', ['iade']],
    ['Ürün garantisi ne kadar?', 'Ürünler 24 ay garantilidir.', ['garanti']]
  ] as const;
  for (const [i, [question, answer, keywords]] of entries.entries()) {
    await new FAQ({ siteId: site._id, question, answer, keywords: [...keywords], order: i }).save();
  }
  await new FAQ({
    siteId: other._id,
    question: 'İade ücreti var mı?',
    answer: 'Başka sitenin iade cevabı.',
    keywords: ['iade']
  }).save();

  // A capital dotted İ, which JavaScript's default lower-casing breaks.
  const byQuestion = await findSources(site._id, 'İADE süresi kaç gün?');
  assert.equal(byQuestion[0]?.question, 'İade koşulları nelerdir?');
  assert.ok(
    byQuestion.every((s) => !s.answer.includes('Başka sitenin')),
    "another site's entry must never be a source"
  );

  // A typo matches nothing indexed; a small site is then given whole.
  const fallback = await findSources(site._id, 'gnderi takp');
  assert.equal(fallback.length, 3);

  // A site with nothing published has no sources at all.
  const empty = await new Site({
    name: 'Boş',
    domain: 'bos.test',
    siteKey: `k-${generateId()}`,
    organizationId: org._id
  }).save();
  assert.deepEqual(await findSources(empty._id, 'iade'), []);
});

test.after(async () => {
  await getPool().end();
});
