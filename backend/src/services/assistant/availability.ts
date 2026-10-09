// Whether the assistant may answer at all right now, platform-wide
// (plan v10 AI-01, AI-07). Three things can stop it besides the settings in
// config/assistant.ts:
//
//   the model     checked once at boot and then every few hours: a model
//                 name the API does not know, a key it refuses, or a preview
//                 model switches the assistant off, with one clear log line.
//                 Live chat is not affected; /ready does not change.
//   the kill      an operator's emergency switch in Redis
//   switch        (`npm run assistant:kill -- on|off`), seen by every API
//                 process within KILL_POLL_MS without a restart; audited.
//
// While it is off, every site behaves as if its assistant were switched off:
// visitors write to people.

import { assistantConfig, isStableModel } from '../../config/assistant';
import { getRedisClient } from '../../config/redis';
import { logger } from '../../config/logger';
import { query } from '../../db/pool';
import { generateId } from '../../db/objectId';

export type ModelState = 'unchecked' | 'ok' | 'missing' | 'key_invalid' | 'preview' | 'unreachable';

const KILL_KEY = 'assistant:kill';
const KILL_POLL_MS = 15_000;
/** How often the model is checked again; sooner while it could not be reached. */
const RECHECK_MS = 6 * 60 * 60 * 1000;
const RETRY_MS = 10 * 60 * 1000;

let modelState: ModelState = 'unchecked';
let killed = false;
let timers: NodeJS.Timeout[] = [];

/** Why the assistant cannot answer anywhere now, or null if it can. */
export function platformBlock(): 'killed' | 'model' | null {
  if (killed) return 'killed';
  if (modelState === 'missing' || modelState === 'key_invalid' || modelState === 'preview') {
    return 'model';
  }
  return null;
}

export function currentModelState(): ModelState {
  return modelState;
}

/**
 * Asks the API whether the configured model exists for this key:
 * GET /models/<name>, the key in the header. A network failure leaves the
 * assistant on (it hands over per conversation if calls fail) and is retried.
 */
export async function checkModel(): Promise<ModelState> {
  const config = assistantConfig();
  if (!config) return modelState;
  if (!isStableModel(config.model)) {
    modelState = 'preview';
    logger.error(
      { model: config.model },
      'assistant off: GEMINI_MODEL is a preview or experimental model; set a stable one'
    );
    return modelState;
  }
  let status = 0;
  try {
    const res = await fetch(`${config.baseUrl}/models/${encodeURIComponent(config.model)}`, {
      headers: { 'x-goog-api-key': config.apiKey },
      signal: AbortSignal.timeout(10_000)
    });
    status = res.status;
    await res.arrayBuffer().catch(() => undefined);
  } catch {
    modelState = 'unreachable';
    logger.warn('assistant: the model API could not be reached; will check again');
    return modelState;
  }
  if (status === 200) {
    if (modelState !== 'ok') logger.info({ model: config.model }, 'assistant: model available');
    modelState = 'ok';
  } else if (status === 404) {
    modelState = 'missing';
    logger.error(
      { model: config.model },
      'assistant off: the API does not know GEMINI_MODEL; set an available model'
    );
  } else if (status === 400 || status === 401 || status === 403) {
    modelState = 'key_invalid';
    logger.error({ status }, 'assistant off: the API refused GEMINI_API_KEY');
  } else {
    modelState = 'unreachable';
    logger.warn({ status }, 'assistant: the model check failed; will check again');
  }
  return modelState;
}

/** Reads the kill switch from Redis (or keeps the last value without Redis). */
export async function refreshKillSwitch(): Promise<boolean> {
  const redis = await getRedisClient().catch(() => null);
  if (redis) {
    const value = await redis.get(KILL_KEY).catch(() => null);
    const next = value === '1';
    if (next !== killed) {
      logger.warn(
        { killed: next },
        next ? 'assistant kill switch ON' : 'assistant kill switch off'
      );
    }
    killed = next;
  }
  return killed;
}

/**
 * Throws the switch for every API process (CLI). Needs Redis: without it the
 * processes cannot hear it, and ASSISTANT_KILL_SWITCH=true plus a restart is
 * the way. Leaves an audit row with no organization.
 */
export async function setKillSwitch(on: boolean, operator: string | null): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) {
    throw new Error('Redis is not reachable; use ASSISTANT_KILL_SWITCH=true and restart instead');
  }
  if (on) await redis.set(KILL_KEY, '1');
  else await redis.del(KILL_KEY);
  killed = on;
  await query(
    `INSERT INTO audit_logs (id, organization_id, user_id, action, entity_type, entity_id, metadata)
     VALUES ($1, NULL, NULL, 'ASSISTANT_KILL_SWITCH', 'platform', NULL, $2)`,
    [generateId(), JSON.stringify({ on, source: 'script', operator })]
  );
}

/** Starts the model checks and the kill-switch poll (server.ts). */
export function startAssistantWatch(): void {
  stopAssistantWatch();
  void refreshKillSwitch();
  const poll = setInterval(() => void refreshKillSwitch(), KILL_POLL_MS);
  poll.unref();
  timers.push(poll);
  if (!assistantConfig()) return;
  const schedule = (ms: number) => {
    const timer = setTimeout(async () => {
      const state = await checkModel();
      schedule(state === 'unreachable' ? RETRY_MS : RECHECK_MS);
    }, ms);
    timer.unref();
    timers.push(timer);
  };
  schedule(0);
}

export function stopAssistantWatch(): void {
  for (const timer of timers) clearTimeout(timer);
  timers = [];
}

/** For tests: back to the boot state. */
export function resetAvailability(): void {
  modelState = 'unchecked';
  killed = false;
}
