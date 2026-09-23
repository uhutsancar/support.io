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
import { getPool } from '../src/db/pool';


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
    () => provider.complete({ prompt: 'anything' }),
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
  await assert.rejects(() => provider.complete({ prompt: '' }), /must implement complete/);
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
  FAQ.find = (() => ({ sort: () => ({ limit: async () => [] }) })) as any;

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

test.after(async () => {
  await getPool().end();
});
