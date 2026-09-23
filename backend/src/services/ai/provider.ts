'use strict';

// Provider abstraction for the AI assistant.
//
// Everything above this layer (aiService, the routes, the admin panel) speaks
// only in terms of `complete()`. Swapping or adding a vendor means adding one
// file next to this one and a branch in index.js — no caller changes.
//
// The API key never leaves the server: the browser calls our own /api/ai
// endpoints, and only this layer holds credentials.

/** How a provider failure is reported to the routes above. */
export interface AIErrorOptions {
  code?: string;
  /** The HTTP status the route should answer with. */
  status?: number;
  /** True when the same call is worth trying again. */
  retryable?: boolean;
}

class AIError extends Error {
  code: string;
  status: number;
  retryable: boolean;

  constructor(
    message: string,
    { code = 'ai_error', status = 502, retryable = false }: AIErrorOptions = {}
  ) {
    super(message);
    this.name = 'AIError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

/** The reasoning levels the vendors accept. */
export type AIEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

/** One single-shot request to a model. */
export interface AICompletionRequest {
  /** The system prompt, when the feature needs one. */
  system?: string;
  /** The already-assembled user turn. */
  prompt: string;
  maxTokens?: number;
  /** How hard the model should think, where the vendor supports it. */
  effort?: AIEffort;
}

/** Token counts, or null when the vendor did not report them. */
export interface AIUsage {
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface AICompletion {
  text: string;
  model: string;
  usage: AIUsage;
}

// What every provider must implement.
//
//   complete({ system, prompt, maxTokens, effort }) -> { text, model, usage }
//
// `prompt` is the already-assembled user turn. Providers are deliberately
// single-shot: the support features here (summary, suggested reply, sentiment)
// are one request each, so no provider needs to own conversation state.
class AIProvider {
  get name(): string {
    throw new Error('provider must define a name');
  }

  // True when the provider can actually reach a model. A provider that is
  // configured but keyless reports false so callers can render "AI disabled"
  // instead of failing at request time.
  get isConfigured(): boolean {
    return false;
  }

  async complete(_request: AICompletionRequest): Promise<AICompletion> {
    throw new Error('provider must implement complete()');
  }
}

// Used when no key is configured. It never fabricates an answer — a made-up
// summary is worse than no summary, because the agent cannot tell it apart from
// a real one.
class DisabledProvider extends AIProvider {
  override get name(): string {
    return 'disabled';
  }

  override get isConfigured(): boolean {
    return false;
  }

  override async complete(_request?: AICompletionRequest): Promise<AICompletion> {
    throw new AIError('AI asistanı yapılandırılmamış. Sunucuda ANTHROPIC_API_KEY tanımlayın.', {
      code: 'ai_not_configured',
      status: 503
    });
  }
}

export { AIProvider, DisabledProvider, AIError };
