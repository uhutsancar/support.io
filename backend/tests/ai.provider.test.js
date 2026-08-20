'use strict';

// Unit cover for the AI provider abstraction and the service's parsing rules.
//
// Runs in-process with a stub provider, so it needs no API key, no network and
// no running server. What it pins is the logic that would otherwise only be
// exercised on a live call: error translation, JSON handling, value clamping,
// and transcript assembly.
//
// The one test that does hit Anthropic is skipped unless ANTHROPIC_API_KEY is
// set, so a normal run never spends money.

require('dotenv').config();

const test = require('node:test');
const assert = require('node:assert/strict');

const { AIProvider, DisabledProvider, AIError } = require('../src/services/ai/provider');
const { getProvider, setProvider, resetProvider } = require('../src/services/ai');

// Records what it was asked and answers with a scripted reply.
class StubProvider extends AIProvider {
  constructor(reply) {
    super();
    this.reply = reply;
    this.calls = [];
  }
  get name() { return 'stub'; }
  get isConfigured() { return true; }
  async complete(request) {
    this.calls.push(request);
    if (typeof this.reply === 'function') return this.reply(request);
    return { text: this.reply, model: 'stub-model', usage: { inputTokens: 1, outputTokens: 1 } };
  }
}

test('the disabled provider refuses instead of returning content', async () => {
  const provider = new DisabledProvider();
  assert.equal(provider.isConfigured, false);

  await assert.rejects(
    () => provider.complete({ prompt: 'anything' }),
    (err) => {
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
  await assert.rejects(() => provider.complete({}), /must implement complete/);
  assert.throws(() => provider.name, /must define a name/);
});

test('provider selection falls back to disabled without a key', () => {
  const original = { key: process.env.ANTHROPIC_API_KEY, provider: process.env.AI_PROVIDER, enabled: process.env.AI_ENABLED };
  try {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.AI_PROVIDER;
    delete process.env.AI_ENABLED;
    resetProvider();
    assert.equal(getProvider().isConfigured, false);
    assert.equal(getProvider().name, 'disabled');

    // A key alone is enough to select Anthropic; no extra configuration.
    process.env.ANTHROPIC_API_KEY = 'sk-ant-not-a-real-key';
    resetProvider();
    assert.equal(getProvider().name, 'anthropic');
    assert.equal(getProvider().isConfigured, true);

    // The explicit off switch wins over a present key.
    process.env.AI_ENABLED = 'false';
    resetProvider();
    assert.equal(getProvider().name, 'disabled');
  } finally {
    if (original.key === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = original.key;
    if (original.provider === undefined) delete process.env.AI_PROVIDER; else process.env.AI_PROVIDER = original.provider;
    if (original.enabled === undefined) delete process.env.AI_ENABLED; else process.env.AI_ENABLED = original.enabled;
    resetProvider();
  }
});

test('analyze clamps model output to values the rest of the system accepts', async (t) => {
  const aiService = require('../src/services/aiService');

  // A model answering with labels outside the enum must not reach the
  // Conversation model, which would reject them.
  const stub = new StubProvider(JSON.stringify({
    sentiment: 'furious',
    intent: 'x'.repeat(500),
    category: 'refund',
    suggestedPriority: 'catastrophic',
    suggestedTags: ['a', 'b', 'c', 'd', 'e'],
    reason: 'test'
  }));
  setProvider(stub);
  t.after(() => resetProvider());

  const conversation = { _id: 'c1', siteId: 's1', ticketId: '#0001', status: 'open', priority: 'normal', channel: 'web-chat' };

  // Transcript loading is stubbed out via a fake conversation with messages
  // already in the database is unnecessary — analyze only needs a non-empty
  // transcript, so the message lookup is patched for this test.
  const original = aiService.buildTranscript;
  const { analysis } = await (async () => {
    const Message = require('../src/models/Message');
    const originalFind = Message.find;
    Message.find = () => ({
      sort: () => ({ limit: async () => ([{ senderType: 'visitor', content: 'iade istiyorum' }]) })
    });
    try {
      return await aiService.analyze(conversation);
    } finally {
      Message.find = originalFind;
    }
  })();

  assert.equal(analysis.sentiment, 'neutral', 'an unknown sentiment must fall back, not pass through');
  assert.equal(analysis.suggestedPriority, null, 'an unknown priority must not be suggested');
  assert.ok(analysis.intent.length <= 80, 'intent must be bounded');
  assert.equal(analysis.suggestedTags.length, 3, 'at most three tags');
  assert.ok(original);
});

test('analyze reports a clear error when the model does not return JSON', async (t) => {
  const aiService = require('../src/services/aiService');
  setProvider(new StubProvider('Buyurun, elbette yardımcı olayım!'));
  t.after(() => resetProvider());

  const Message = require('../src/models/Message');
  const originalFind = Message.find;
  Message.find = () => ({
    sort: () => ({ limit: async () => ([{ senderType: 'visitor', content: 'merhaba' }]) })
  });

  try {
    await assert.rejects(
      () => aiService.analyze({ _id: 'c1', siteId: 's1', status: 'open', priority: 'normal', channel: 'web-chat' }),
      (err) => {
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
  const aiService = require('../src/services/aiService');
  setProvider(new StubProvider('```json\n{"answered": true, "answer": "14 gün", "usedEntries": [2]}\n```'));
  t.after(() => resetProvider());

  const FAQ = require('../src/models/FAQ');
  const originalFind = FAQ.find;
  FAQ.find = () => ({
    sort: () => ({ limit: async () => ([{ question: 'İade süresi?', answer: '14 gün içinde iade edebilirsiniz.' }]) })
  });

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
  const aiService = require('../src/services/aiService');
  const stub = new StubProvider('{"answered": true, "answer": "uydurma"}');
  setProvider(stub);
  t.after(() => resetProvider());

  const FAQ = require('../src/models/FAQ');
  const originalFind = FAQ.find;
  FAQ.find = () => ({ sort: () => ({ limit: async () => ([]) }) });

  try {
    const result = await aiService.knowledgeAnswer({ _id: 'c1', siteId: 's1' }, { question: 'herhangi bir soru' });
    assert.equal(result.answered, false);
    assert.equal(result.answer, null);
    assert.equal(stub.calls.length, 0, 'with no knowledge base there is nothing to ask the model');
  } finally {
    FAQ.find = originalFind;
  }
});

test('the suggested reply prompt carries the knowledge base and the transcript', async (t) => {
  const aiService = require('../src/services/aiService');
  const stub = new StubProvider('Merhaba, iade talebinizi oluşturdum.');
  setProvider(stub);
  t.after(() => resetProvider());

  const Message = require('../src/models/Message');
  const FAQ = require('../src/models/FAQ');
  const originalMessageFind = Message.find;
  const originalFaqFind = FAQ.find;
  Message.find = () => ({
    sort: () => ({ limit: async () => ([{ senderType: 'visitor', senderName: 'Ali', content: 'iade istiyorum' }]) })
  });
  FAQ.find = () => ({
    sort: () => ({ limit: async () => ([{ question: 'İade?', answer: '14 gün içinde iade.' }]) })
  });

  try {
    const result = await aiService.suggestReply(
      { _id: 'c1', siteId: 's1', ticketId: '#0007', status: 'open', priority: 'high', channel: 'web-chat', visitorName: 'Ali' },
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
  const aiService = require('../src/services/aiService');
  const stub = new StubProvider('should never be produced');
  setProvider(stub);
  t.after(() => resetProvider());

  const Message = require('../src/models/Message');
  const originalFind = Message.find;
  Message.find = () => ({ sort: () => ({ limit: async () => ([]) }) });

  try {
    await assert.rejects(
      () => aiService.summarize({ _id: 'c1', siteId: 's1', status: 'open', priority: 'normal', channel: 'web-chat' }),
      (err) => {
        assert.equal(err.code, 'ai_no_messages');
        return true;
      }
    );
    assert.equal(stub.calls.length, 0, 'no model call may be spent on an empty conversation');
  } finally {
    Message.find = originalFind;
  }
});

test('a live Anthropic call returns usable text', { skip: !process.env.ANTHROPIC_API_KEY }, async () => {
  const { AnthropicProvider } = require('../src/services/ai/anthropicProvider');
  const provider = new AnthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY });

  assert.equal(provider.isConfigured, true);

  const result = await provider.complete({
    system: 'Yalnızca istenen kelimeyi yaz, başka hiçbir şey yazma.',
    prompt: 'Sadece şu kelimeyi yaz: tamam',
    maxTokens: 64
  });

  assert.ok(result.text.length > 0);
  assert.match(result.text.toLowerCase(), /tamam/);
  assert.ok(result.model, 'the response should report which model answered');
});

test('an invalid key surfaces as a typed auth error, not a crash', { skip: !process.env.ANTHROPIC_API_KEY }, async () => {
  const { AnthropicProvider } = require('../src/services/ai/anthropicProvider');
  const provider = new AnthropicProvider({ apiKey: 'sk-ant-definitely-invalid' });

  await assert.rejects(
    () => provider.complete({ system: 'x', prompt: 'y', maxTokens: 16 }),
    (err) => {
      assert.equal(err.name, 'AIError');
      assert.ok(['ai_auth_failed', 'ai_bad_request'].includes(err.code), `unexpected code ${err.code}`);
      return true;
    }
  );
});

test.after(async () => {
  const { getPool } = require('../src/db/pool');
  await getPool().end();
});
