// Per-event rate limits on the sockets.
//
// The HTTP API has had limits for a long time; the sockets had none, so one
// widget could send messages as fast as its connection allowed and each one
// became a row, a broadcast to every agent of the site and possibly an
// automation run. Every event now counts against a per-minute budget held in
// Redis (middleware/rateLimit.ts#createQuota, with the same in-process
// fallback), keyed by the widget session or by the agent:
//
//   visitor   30 messages and 300 events per minute, per widget session
//   agent    120 messages and 1200 events per minute, per account
//
// Over the budget the event is dropped: the sender gets an `error` with code
// RATE_LIMITED and, when it asked for one, a refused acknowledgement. Outside
// production the budgets are effectively unlimited unless set explicitly, as
// with the HTTP limits, so load tests and the e2e suite measure the server
// rather than the limiter.

import { createQuota } from '../middleware/rateLimit';
import type { Socket } from 'socket.io';

const isProduction = process.env.NODE_ENV === 'production';

const budget = (value: string | undefined, production: number): number =>
  Number(value) || (isProduction ? production : 1_000_000);

export interface EventBudget {
  /** `send-message` events per minute. */
  messages: number;
  /** Every other event per minute. */
  events: number;
}

export const VISITOR_BUDGET: EventBudget = {
  messages: budget(process.env.SOCKET_VISITOR_MESSAGES_PER_MIN, 30),
  events: budget(process.env.SOCKET_VISITOR_EVENTS_PER_MIN, 300)
};

export const AGENT_BUDGET: EventBudget = {
  messages: budget(process.env.SOCKET_AGENT_MESSAGES_PER_MIN, 120),
  events: budget(process.env.SOCKET_AGENT_EVENTS_PER_MIN, 1200)
};

const WINDOW_MS = 60 * 1000;

/** One pair of quotas per namespace, shared by all its sockets. */
export function eventLimiter(name: string, limits: EventBudget) {
  const messages = createQuota({ name: `${name}-msg`, windowMs: WINDOW_MS, max: limits.messages });
  const events = createQuota({ name: `${name}-evt`, windowMs: WINDOW_MS, max: limits.events });

  /** Installs the budget on one socket, counted under `key`. */
  return function limit(socket: Socket, key: string): void {
    socket.use((packet, next) => {
      const [event] = packet;
      const last = packet[packet.length - 1];
      const ack = typeof last === 'function' ? (last as (reply: unknown) => void) : null;
      const quota = event === 'send-message' ? messages : events;
      quota.take(key).then(
        (allowed) => {
          if (allowed) return next();
          socket.emit('error', { message: 'Too many requests, slow down', code: 'RATE_LIMITED' });
          ack?.({ ok: false, code: 'RATE_LIMITED' });
        },
        // A broken counter must not turn an expensive event budget off.
        () => {
          socket.emit('error', {
            message: 'Rate limit unavailable',
            code: 'RATE_LIMIT_UNAVAILABLE'
          });
          ack?.({ ok: false, code: 'RATE_LIMIT_UNAVAILABLE' });
        }
      );
    });
  };
}
