'use strict';

// The self-hosted model, served by vLLM's OpenAI-compatible API.
//
// Plain `fetch`, no SDK: the surface used here is two endpoints, and an SDK
// would bring retries, streaming and a client pool this backend does not want.
// Two rules shape the whole file:
//
//   * The GPU is shared by every tenant, so a process never has more than
//     `concurrency` calls in flight, and a call that cannot get a slot within
//     `queueMaxWaitMs` fails as busy rather than joining an unbounded queue.
//     For a visitor that means a handoff to a person, which is the right
//     outcome when the model is saturated.
//   * Neither a prompt, an answer nor a raw error body is logged or returned.
//     They carry customer text; only codes and statuses leave this file.

import { AIProvider, AIError } from './provider';
import type { AICompletion, AICompletionRequest, AIState } from './provider';
import type { AIConfig } from '../../config/ai';

/** How long a status reading is reused before the model server is asked again. */
const STATE_CACHE_MS = 15000;
const STATE_TIMEOUT_MS = 3000;
/** A refused connection is retried once after this pause, and only once. */
const RETRY_DELAY_MS = 300;

type Release = () => void;

/**
 * A counting semaphore with a bounded wait.
 *
 * Kept in this file because it exists for one reason — protecting the GPU —
 * and nothing else in the backend queues work in-process.
 */
class Slots {
  private active = 0;
  private readonly waiting: Array<{ grant: (release: Release) => void }> = [];

  constructor(private readonly size: number) {}

  acquire(maxWaitMs: number, signal?: AbortSignal): Promise<Release> {
    if (this.active < this.size) {
      this.active++;
      return Promise.resolve(this.releaser());
    }

    return new Promise<Release>((resolve, reject) => {
      const entry = {
        grant: (release: Release) => {
          clearTimeout(timer);
          signal?.removeEventListener('abort', onAbort);
          resolve(release);
        }
      };
      const leave = () => {
        const index = this.waiting.indexOf(entry);
        if (index >= 0) this.waiting.splice(index, 1);
      };
      const timer = setTimeout(() => {
        leave();
        signal?.removeEventListener('abort', onAbort);
        reject(
          new AIError('Model şu anda meşgul.', { code: 'ai_busy', status: 429, retryable: true })
        );
      }, maxWaitMs);
      const onAbort = () => {
        clearTimeout(timer);
        leave();
        reject(abortedError());
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      this.waiting.push(entry);
    });
  }

  private releaser(): Release {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = this.waiting.shift();
      // The slot passes straight to the next caller, so `active` is unchanged.
      if (next) next.grant(this.releaser());
      else this.active--;
    };
  }
}

function abortedError(): AIError {
  return new AIError('İstek iptal edildi.', { code: 'ai_aborted', status: 499 });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Reads the one completion out of a chat response, or says why it cannot. */
function readCompletion(data: unknown, fallbackModel: string): AICompletion {
  const choice = isRecord(data) && Array.isArray(data.choices) ? data.choices[0] : null;
  const message = isRecord(choice) ? choice.message : null;
  const text =
    isRecord(message) && typeof message.content === 'string' ? message.content.trim() : '';

  // A cut-off answer is as unusable as an empty one: a half sentence to a
  // customer, or JSON that stops before its closing brace.
  if (!text || (isRecord(choice) && choice.finish_reason === 'length')) {
    throw new AIError('Model kullanılabilir bir yanıt üretmedi.', {
      code: 'ai_bad_format',
      status: 502,
      retryable: true
    });
  }

  const usage = isRecord(data) && isRecord(data.usage) ? data.usage : {};
  const count = (value: unknown) => (typeof value === 'number' ? value : null);
  return {
    text,
    model: isRecord(data) && typeof data.model === 'string' ? data.model : fallbackModel,
    usage: { inputTokens: count(usage.prompt_tokens), outputTokens: count(usage.completion_tokens) }
  };
}

function statusError(status: number): AIError {
  if (status === 401 || status === 403) {
    // Logged: it means the two sides disagree on AI_API_KEY, which only an
    // operator can fix.
    console.error(`[ai] model server rejected the API key (HTTP ${status})`);
    return new AIError('Model sunucusu kimlik doğrulamasını reddetti.', {
      code: 'ai_auth_failed',
      status: 502
    });
  }
  if (status === 429) {
    return new AIError('Model şu anda meşgul.', { code: 'ai_busy', status: 429, retryable: true });
  }
  if (status >= 500) {
    return new AIError('Model şu anda kullanılamıyor.', {
      code: 'ai_unreachable',
      status: 503,
      retryable: true
    });
  }
  return new AIError(`Model isteği reddetti (HTTP ${status}).`, {
    code: 'ai_bad_request',
    status: 502
  });
}

class VllmProvider extends AIProvider {
  private readonly config: AIConfig;
  private readonly slots: Slots;
  private stateCache: { state: AIState; at: number } | null = null;

  constructor(config: AIConfig) {
    super();
    this.config = config;
    this.slots = new Slots(config.concurrency);
  }

  override get name(): string {
    return 'vllm';
  }

  override get isConfigured(): boolean {
    return true;
  }

  override get model(): string {
    return this.config.model;
  }

  override async state(): Promise<AIState> {
    if (this.stateCache && Date.now() - this.stateCache.at < STATE_CACHE_MS) {
      return this.stateCache.state;
    }
    const state = await this.readState();
    this.stateCache = { state, at: Date.now() };
    return state;
  }

  private async readState(): Promise<AIState> {
    try {
      const res = await fetch(`${this.config.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
        signal: AbortSignal.timeout(STATE_TIMEOUT_MS)
      });
      // vLLM answers 503 while the engine is still starting.
      if (res.status === 503) return 'warming_up';
      if (!res.ok) return 'unavailable';
      const data: unknown = await res.json();
      const listed =
        isRecord(data) &&
        Array.isArray(data.data) &&
        data.data.some((entry) => isRecord(entry) && entry.id === this.config.model);
      return listed ? 'ready' : 'warming_up';
    } catch {
      // Refused or timed out: the container is down, or has not bound its port
      // yet, which vLLM only does once the weights are loaded.
      return 'unavailable';
    }
  }

  override async complete(request: AICompletionRequest): Promise<AICompletion> {
    if (request.signal?.aborted) throw abortedError();
    const release = await this.slots.acquire(this.config.queueMaxWaitMs, request.signal);
    try {
      return await this.send(request);
    } finally {
      release();
    }
  }

  private async send(request: AICompletionRequest): Promise<AICompletion> {
    const messages = [
      ...(request.system ? [{ role: 'system', content: request.system }] : []),
      { role: 'user', content: request.prompt }
    ];
    const body = JSON.stringify({
      model: this.config.model,
      messages,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      stream: false,
      ...(request.responseSchema
        ? {
            response_format: {
              type: 'json_schema',
              json_schema: {
                name: request.responseSchema.name,
                schema: request.responseSchema.schema,
                strict: true
              }
            }
          }
        : {})
    });

    const timeout = AbortSignal.timeout(this.config.timeoutMs);
    const signal = request.signal ? AbortSignal.any([timeout, request.signal]) : timeout;

    const post = () =>
      fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body,
        signal
      });

    let res: Response;
    try {
      try {
        res = await post();
      } catch (error) {
        // One short retry, for a refused connection only: a container that
        // is restarting refuses for a moment. Anything that already reached
        // the model is never sent twice.
        if (signal.aborted) throw error;
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        res = await post();
      }
    } catch {
      if (request.signal?.aborted) throw abortedError();
      if (timeout.aborted) {
        throw new AIError('Model zamanında yanıt vermedi.', {
          code: 'ai_timeout',
          status: 504,
          retryable: true
        });
      }
      throw new AIError('Model sunucusuna ulaşılamadı.', {
        code: 'ai_unreachable',
        status: 503,
        retryable: true
      });
    }

    if (!res.ok) {
      // The body is dropped unread: it can echo the prompt back.
      await res.body?.cancel().catch(() => undefined);
      throw statusError(res.status);
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      throw new AIError('Model yanıtı okunamadı.', {
        code: 'ai_bad_format',
        status: 502,
        retryable: true
      });
    }
    return readCompletion(data, this.config.model);
  }
}

export { VllmProvider };
