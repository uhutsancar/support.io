// One call to the Gemini API: a prompt in, a JSON object out.
//
// Plain HTTPS (generateContent), no SDK. The key travels in the
// x-goog-api-key header, never in a URL that a proxy might log. Every failure
// becomes a GeminiError with a short code, which is all the rest of the
// assistant needs to decide on a handoff:
//
//   quota        429, or our own per-minute / per-day budget is spent
//   auth         400 API_KEY_INVALID, 401, 403
//   unavailable  5xx, a network error, or the breaker is open after one
//   timeout      no answer within GEMINI_TIMEOUT_MS
//   blocked      Gemini refused the content (safety)
//   bad_response anything that is not the JSON we asked for
//
// After a quota or availability failure the breaker stays open for a short
// while, so a burst of visitors during an outage is handed over at once
// instead of each waiting out the timeout.

import { createQuota } from '../../middleware/rateLimit';
import type { AssistantConfig } from '../../config/assistant';

export type GeminiErrorCode =
  'quota' | 'auth' | 'unavailable' | 'timeout' | 'blocked' | 'bad_response';

export class GeminiError extends Error {
  readonly code: GeminiErrorCode;
  constructor(code: GeminiErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'GeminiError';
    this.code = code;
  }
}

/** How long the breaker stays open after each kind of failure. */
const BREAKER_MS: Partial<Record<GeminiErrorCode, number>> = {
  quota: 60_000,
  unavailable: 30_000,
  timeout: 15_000,
  auth: 5 * 60_000
};

let openUntil = 0;
let openCode: GeminiErrorCode = 'unavailable';

function trip(code: GeminiErrorCode): void {
  const ms = BREAKER_MS[code];
  if (!ms) return;
  openUntil = Date.now() + ms;
  openCode = code;
}

/** For tests: forget a previous failure. */
export function resetBreaker(): void {
  openUntil = 0;
}

let budgets: {
  minute: ReturnType<typeof createQuota>;
  day: ReturnType<typeof createQuota>;
} | null = null;
let budgetKey = '';

function budgetsFor(config: AssistantConfig) {
  const key = `${config.rpm}/${config.rpd}`;
  if (!budgets || budgetKey !== key) {
    budgets = {
      minute: createQuota({ name: 'gemini-rpm', windowMs: 60_000, max: config.rpm }),
      day: createQuota({ name: 'gemini-rpd', windowMs: 24 * 60 * 60_000, max: config.rpd })
    };
    budgetKey = key;
  }
  return budgets;
}

export interface GenerateRequest {
  system: string;
  prompt: string;
  /** An OpenAPI-subset schema the answer must follow. */
  schema: Record<string, unknown>;
  maxOutputTokens?: number;
  signal?: AbortSignal;
}

/** Calls the model and returns the parsed JSON it produced. */
export async function generateJson(
  config: AssistantConfig,
  request: GenerateRequest
): Promise<unknown> {
  if (Date.now() < openUntil) throw new GeminiError(openCode, 'breaker open');

  const { minute, day } = budgetsFor(config);
  if (!(await minute.take('all')) || !(await day.take('all'))) {
    throw new GeminiError('quota', 'local budget');
  }

  const timeout = AbortSignal.timeout(config.timeoutMs);
  const signal = request.signal ? AbortSignal.any([request.signal, timeout]) : timeout;

  let res: Response;
  try {
    res = await fetch(
      `${config.baseUrl}/models/${encodeURIComponent(config.model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: request.system }] },
          contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: request.maxOutputTokens ?? 400,
            responseMimeType: 'application/json',
            responseSchema: request.schema
          }
        }),
        signal
      }
    );
  } catch (error) {
    if (request.signal?.aborted) throw error;
    const code: GeminiErrorCode = timeout.aborted ? 'timeout' : 'unavailable';
    trip(code);
    throw new GeminiError(code);
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { status?: string; details?: Array<{ reason?: string }> };
    } | null;
    const reason = body?.error?.details?.map((d) => d.reason).find(Boolean);
    let code: GeminiErrorCode;
    if (res.status === 429) code = 'quota';
    else if (res.status === 401 || res.status === 403 || reason === 'API_KEY_INVALID')
      code = 'auth';
    else if (res.status >= 500) code = 'unavailable';
    else code = 'bad_response';
    trip(code);
    // The status only: Google's error text can echo parts of the request.
    throw new GeminiError(
      code,
      `HTTP ${res.status}${body?.error?.status ? ` ${body.error.status}` : ''}`
    );
  }

  const data = (await res.json().catch(() => null)) as {
    candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }>;
    promptFeedback?: { blockReason?: string };
  } | null;
  if (data?.promptFeedback?.blockReason) throw new GeminiError('blocked');
  const candidate = data?.candidates?.[0];
  if (candidate?.finishReason === 'SAFETY') throw new GeminiError('blocked');
  const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  try {
    return JSON.parse(text);
  } catch {
    throw new GeminiError('bad_response', 'not JSON');
  }
}
