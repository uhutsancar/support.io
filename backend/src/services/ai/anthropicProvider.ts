'use strict';

// Anthropic implementation of AIProvider.

// The SDK ships as ESM with a CommonJS interop default export; the default
// import unwraps it, which is what esModuleInterop emits for this project.

import { AIProvider, AIError } from './provider';
import type { AICompletion, AICompletionRequest } from './provider';
import Anthropic from '@anthropic-ai/sdk';

const DEFAULT_MODEL = 'claude-opus-5';

// Support replies and summaries are short. 4k leaves ample room for the longest
// suggested reply while keeping a single request cheap; the summary prompts cap
// their own output further in the instructions.
const DEFAULT_MAX_TOKENS = 4096;

/** How the provider is constructed; the key is the only required part. */
export interface AnthropicProviderOptions {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
}

class AnthropicProvider extends AIProvider {
  model: string;
  apiKey: string | undefined;
  /** null when no key was supplied, which is what isConfigured reports. */
  client: Anthropic | null;

  constructor({ apiKey, model = DEFAULT_MODEL, timeoutMs = 30000 }: AnthropicProviderOptions = {}) {
    super();
    this.model = model;
    this.apiKey = apiKey;
    this.client = apiKey ? new Anthropic({ apiKey, timeout: timeoutMs, maxRetries: 2 }) : null;
  }

  override get name(): string {
    return 'anthropic';
  }

  override get isConfigured(): boolean {
    return Boolean(this.client);
  }

  override async complete(
    { system, prompt, maxTokens = DEFAULT_MAX_TOKENS, effort = 'low' }: AICompletionRequest = { prompt: '' }
  ): Promise<AICompletion> {
    if (!this.client) {
      throw new AIError('Anthropic sağlayıcısı API anahtarı olmadan çağrıldı.', {
        code: 'ai_not_configured',
        status: 503
      });
    }

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: maxTokens,
        system,
        // These are short, well-specified classification and drafting tasks, so
        // the cheapest effort level is the right default; callers that need
        // more reasoning pass a higher one.
        output_config: { effort },
        messages: [{ role: 'user', content: prompt }]
      });

      // A safety decline arrives as HTTP 200 with stop_reason 'refusal', so it
      // has to be checked before the content is read.
      if (response.stop_reason === 'refusal') {
        throw new AIError('Model bu içeriği yanıtlamayı reddetti.', {
          code: 'ai_refused',
          status: 422
        });
      }

      // Only text blocks carry the answer; anything else contributes nothing,
      // which is what the previous filter/map pair did.
      const text = (response.content || [])
        .map((block) => (block.type === 'text' ? block.text : ''))
        .join('')
        .trim();

      if (!text) {
        throw new AIError('Model boş yanıt döndürdü.', { code: 'ai_empty_response' });
      }

      return {
        text,
        model: response.model,
        usage: {
          inputTokens: response.usage?.input_tokens ?? null,
          outputTokens: response.usage?.output_tokens ?? null
        }
      };
    } catch (error) {
      if (error instanceof AIError) throw error;
      throw this.translateError(error);
    }
  }

  // Maps SDK errors onto the shape the routes answer with. Checked most
  // specific first, and never by string matching on the message.
  translateError(error: unknown): AIError {
    if (error instanceof Anthropic.AuthenticationError) {
      return new AIError('AI sağlayıcı kimlik doğrulaması başarısız (API anahtarını kontrol edin).', {
        code: 'ai_auth_failed',
        status: 502
      });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return new AIError('AI sağlayıcı hız sınırına takıldı, birazdan tekrar deneyin.', {
        code: 'ai_rate_limited',
        status: 429,
        retryable: true
      });
    }
    if (error instanceof Anthropic.BadRequestError) {
      return new AIError(`AI isteği reddedildi: ${error.message}`, {
        code: 'ai_bad_request',
        status: 400
      });
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return new AIError('AI sağlayıcısına ulaşılamadı.', {
        code: 'ai_unreachable',
        status: 503,
        retryable: true
      });
    }
    if (error instanceof Anthropic.APIError) {
      return new AIError(`AI sağlayıcı hatası (${error.status}).`, {
        code: 'ai_provider_error',
        status: 502,
        retryable: error.status >= 500
      });
    }
    return new AIError((error as Error)?.message || 'Bilinmeyen AI hatası.', { code: 'ai_error' });
  }
}

export { AnthropicProvider, DEFAULT_MODEL };