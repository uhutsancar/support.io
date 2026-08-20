'use strict';

// Provider abstraction for the AI assistant.
//
// Everything above this layer (aiService, the routes, the admin panel) speaks
// only in terms of `complete()`. Swapping or adding a vendor means adding one
// file next to this one and a branch in index.js — no caller changes.
//
// The API key never leaves the server: the browser calls our own /api/ai
// endpoints, and only this layer holds credentials.

class AIError extends Error {
  constructor(message, { code = 'ai_error', status = 502, retryable = false } = {}) {
    super(message);
    this.name = 'AIError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

// What every provider must implement.
//
//   complete({ system, prompt, maxTokens, effort }) -> { text, model, usage }
//
// `prompt` is the already-assembled user turn. Providers are deliberately
// single-shot: the support features here (summary, suggested reply, sentiment)
// are one request each, so no provider needs to own conversation state.
class AIProvider {
  get name() {
    throw new Error('provider must define a name');
  }

  // True when the provider can actually reach a model. A provider that is
  // configured but keyless reports false so callers can render "AI disabled"
  // instead of failing at request time.
  get isConfigured() {
    return false;
  }

  async complete() {
    throw new Error('provider must implement complete()');
  }
}

// Used when no key is configured. It never fabricates an answer — a made-up
// summary is worse than no summary, because the agent cannot tell it apart from
// a real one.
class DisabledProvider extends AIProvider {
  get name() {
    return 'disabled';
  }

  get isConfigured() {
    return false;
  }

  async complete() {
    throw new AIError(
      'AI asistanı yapılandırılmamış. Sunucuda ANTHROPIC_API_KEY tanımlayın.',
      { code: 'ai_not_configured', status: 503 }
    );
  }
}

module.exports = { AIProvider, DisabledProvider, AIError };
