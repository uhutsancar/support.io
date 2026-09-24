'use strict';

// Provider abstraction for the AI assistant.
//
// Everything above this layer (aiService, autoReply, the routes, the admin
// panel) speaks only in terms of `complete()`. Swapping the model backend means
// adding one file next to this one and a branch in index.ts — no caller
// changes.
//
// Credentials never leave the server: the browser calls our own /api/ai
// endpoints, and only this layer talks to the model.

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

/** A JSON schema the model's output is constrained to, token by token. */
export interface AIResponseSchema {
  name: string;
  schema: Record<string, unknown>;
}

/** One single-shot request to a model. */
export interface AICompletionRequest {
  /** The system prompt, when the feature needs one. */
  system?: string;
  /** The already-assembled user turn. */
  prompt: string;
  maxTokens: number;
  temperature: number;
  /** vLLM structured output: tokens that would break the schema are never produced. */
  responseSchema?: AIResponseSchema;
  /** Lets the caller give up on a call it no longer needs, e.g. after a takeover. */
  signal?: AbortSignal;
}

/** Token counts, or null when the backend did not report them. */
export interface AIUsage {
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface AICompletion {
  text: string;
  model: string;
  usage: AIUsage;
}

/**
 * Where the model is right now, as the panel shows it.
 *
 *   disabled     AI is switched off or not configured on this server
 *   warming_up   the server answers but the model is not loaded yet
 *   ready        requests will be served
 *   unavailable  the model server cannot be reached
 */
export type AIState = 'disabled' | 'warming_up' | 'ready' | 'unavailable';

// What every provider must implement.
//
//   complete({ system, prompt, maxTokens, temperature, ... }) -> { text, model, usage }
//
// Providers are deliberately single-shot: every support feature here is one
// request, so no provider needs to own conversation state.
class AIProvider {
  get name(): string {
    throw new Error('provider must define a name');
  }

  // True when the provider has what it needs to reach a model. A provider that
  // is not configured reports false so callers can render "AI disabled"
  // instead of failing at request time.
  get isConfigured(): boolean {
    return false;
  }

  /** The served model's name, or null when there is none. */
  get model(): string | null {
    return null;
  }

  async state(): Promise<AIState> {
    return 'disabled';
  }

  async complete(_request: AICompletionRequest): Promise<AICompletion> {
    throw new Error('provider must implement complete()');
  }
}

// Used when no model is configured. It never fabricates an answer — a made-up
// summary is worse than no summary, because the agent cannot tell it apart from
// a real one.
class DisabledProvider extends AIProvider {
  override get name(): string {
    return 'disabled';
  }

  override async complete(_request?: AICompletionRequest): Promise<AICompletion> {
    throw new AIError('Yapay zekâ bu sunucuda etkin değil.', {
      code: 'ai_not_configured',
      status: 503
    });
  }
}

export { AIProvider, DisabledProvider, AIError };
