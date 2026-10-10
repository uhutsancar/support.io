// The FAQ assistant's settings, read from the environment.
//
//   GEMINI_API_KEY          required; without it the assistant is simply off
//                           and live chat works exactly as before. Server-side
//                           only: never sent to the panel or the widget,
//                           never logged.
//   GEMINI_MODEL            default gemini-3.5-flash-lite (stable; a preview or
//                           experimental model is refused, AI-01)
//   GEMINI_TIER             free (default) or paid: which Gemini API terms the
//                           key's project is under. On free, visitors from the
//                           EEA, Switzerland and the UK are never sent to the
//                           model (AI-02).
//   GEMINI_TIMEOUT_MS       one call's deadline, default 15 s
//   GEMINI_RPM              calls per minute across all processes, default 10
//   GEMINI_RPD              calls per day across all processes, default 900
//   GEMINI_COST_PER_ANSWER  estimated cost of one answer, for org:list (AI-07)
//   ASSISTANT_ENABLED       'false' switches the assistant off platform-wide
//   ASSISTANT_KILL_SWITCH   'true' does the same in an emergency; the same
//                           switch can be thrown without a restart with
//                           `npm run assistant:kill -- on` (AI-07)
//
// The two budgets keep usage inside Google's free tier (whose own limits are
// per project and change over time; set these at or below what the project's
// "Rate limit" page shows). Over a budget, or on any API or quota error, the
// conversation is handed to a person — never left waiting.
//
// GEMINI_BASE_URL exists for the test suite, which points it at a local mock.

export type GeminiTier = 'free' | 'paid';

export interface AssistantConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  tier: GeminiTier;
  timeoutMs: number;
  rpm: number;
  rpd: number;
}

const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

const positive = (value: string | undefined, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

/** The configuration, or null when the assistant cannot run on this server. */
export function assistantConfig(): AssistantConfig | null {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || String(process.env.ASSISTANT_ENABLED).toLowerCase() === 'false') return null;
  if (String(process.env.ASSISTANT_KILL_SWITCH).toLowerCase() === 'true') return null;
  const baseUrl = (process.env.GEMINI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
  if (process.env.NODE_ENV === 'production' && baseUrl !== DEFAULT_BASE_URL) return null;
  return {
    apiKey,
    model: (process.env.GEMINI_MODEL || DEFAULT_MODEL).trim(),
    baseUrl,
    tier: String(process.env.GEMINI_TIER).toLowerCase() === 'paid' ? 'paid' : 'free',
    timeoutMs: positive(process.env.GEMINI_TIMEOUT_MS, 15_000),
    rpm: positive(process.env.GEMINI_RPM, 10),
    rpd: positive(process.env.GEMINI_RPD, 900)
  };
}

/** A model name the plan allows in production: not a preview or an experiment. */
export function isStableModel(model: string): boolean {
  return !/(preview|exp(erimental)?\b|-exp-|latest)/i.test(model);
}
