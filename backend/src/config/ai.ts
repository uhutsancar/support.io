// The self-hosted model's configuration, read and checked in one place.
//
// Every AI_* variable comes from the root .env through docker compose; the
// backend's own .env holds none of them. A missing or malformed value turns the
// feature off with one line in the log instead of stopping the server: chat,
// the inbox and the panel must keep working when the model is not there.

export interface AIConfig {
  /** Base of the OpenAI-compatible API, e.g. http://llm:8000/v1. */
  baseUrl: string;
  /** Shared secret between this backend and the vLLM container. */
  apiKey: string;
  /** The served model name, which is also its directory under /models. */
  model: string;
  /** Upper bound for one model call. */
  timeoutMs: number;
  /** Model calls one process may have in flight at once. */
  concurrency: number;
  /** How long a call may wait for a free slot before it counts as busy. */
  queueMaxWaitMs: number;
  /** The widget auto-reply, switched separately from the panel copilot. */
  autoReplyEnabled: boolean;
}

const MIN_KEY_LENGTH = 32;

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

let cached: { config: AIConfig | null } | null = null;

/**
 * The model configuration, or null when AI is off or cannot be used.
 *
 * Read once per process: the values come from the environment, which does not
 * change underneath a running server, and the reason for a refusal is logged
 * only the first time rather than on every request.
 */
export function aiConfig(): AIConfig | null {
  if (cached) return cached.config;
  cached = { config: readConfig() };
  return cached.config;
}

function readConfig(): AIConfig | null {
  const env = process.env;
  if (env.AI_ENABLED !== 'true') return null;

  const apiKey = env.AI_API_KEY || '';
  const model = env.AI_MODEL || '';
  // Names the variable, never its value: this line ends up in shared logs.
  const problem =
    apiKey.length < MIN_KEY_LENGTH
      ? `AI_API_KEY must be at least ${MIN_KEY_LENGTH} characters`
      : !/^[a-z0-9._-]+$/i.test(model)
        ? 'AI_MODEL is missing or not a plain directory name'
        : null;
  if (problem) {
    console.error(`[ai] disabled: ${problem}`);
    return null;
  }

  return {
    baseUrl: (env.AI_BASE_URL || 'http://llm:8000/v1').replace(/\/+$/, ''),
    apiKey,
    model,
    timeoutMs: positiveInt(env.AI_TIMEOUT_MS, 20000),
    concurrency: positiveInt(env.AI_CONCURRENCY, 2),
    queueMaxWaitMs: positiveInt(env.AI_QUEUE_MAX_WAIT_MS, 8000),
    autoReplyEnabled: env.AI_AUTO_REPLY_ENABLED === 'true'
  };
}

/** Test seam: forgets the cached reading so a test can change the environment. */
export function resetAIConfig(): void {
  cached = null;
}
