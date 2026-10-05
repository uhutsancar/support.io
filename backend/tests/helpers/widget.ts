// The visitor's side of the e2e suites: a widget session and a widget socket,
// the way the embed obtains them (POST /api/widget/session, then the /widget
// namespace with the signed token).
//
// The API under test runs with NODE_ENV=development, where localhost origins
// are accepted for every site (config/siteOrigins.ts). Tests that are about
// origins pass their own.

import { io as connect } from 'socket.io-client';
import type { Socket } from 'socket.io-client';

export const BASE = process.env.E2E_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

/** A page the development API accepts for any site. */
export const LOCAL_ORIGIN = 'http://localhost:3001';

export interface WidgetSessionResponse {
  status: number;
  body: any;
}

/** POST /api/widget/session as a page on `origin` would. */
export async function widgetSession(
  siteKey: unknown,
  { origin = LOCAL_ORIGIN, token }: { origin?: string | null; token?: string } = {}
): Promise<WidgetSessionResponse> {
  const res = await fetch(`${BASE}/api/widget/session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(origin ? { Origin: origin } : {})
    },
    body: JSON.stringify({ siteKey, ...(token ? { token } : {}) })
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, body };
}

/** A fresh session's token, failing loudly when the API refuses one. */
export async function widgetToken(
  siteKey: string,
  options: { origin?: string | null; token?: string } = {}
): Promise<{ token: string; visitorId: string }> {
  const res = await widgetSession(siteKey, options);
  if (res.status !== 200) {
    throw new Error(`widget session refused: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { token: res.body.token, visitorId: res.body.visitorId };
}

/** A /widget socket carrying `token`, as a page on `origin`. */
export function widgetSocket(
  token: string | undefined,
  { origin = LOCAL_ORIGIN }: { origin?: string | null } = {}
): Socket {
  return connect(`${BASE}/widget`, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    auth: token ? { token } : {},
    extraHeaders: origin ? { Origin: origin } : {}
  });
}

/** Resolves on connect, rejects with the server's refusal message. */
export function connected(socket: Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', (error: Error) => reject(error));
  });
}

/**
 * A new visitor on `siteKey`: session, socket, join. Resolves with the socket
 * and the server's `conversation-joined` answer.
 */
export async function joinAsVisitor(
  siteKey: string,
  join: Record<string, unknown> = {},
  options: { origin?: string | null; token?: string } = {}
): Promise<{ socket: Socket; joined: any; token: string; visitorId: string }> {
  const session = await widgetToken(siteKey, options);
  const socket = widgetSocket(session.token, { origin: options.origin });
  await connected(socket);
  const joined: any = await new Promise((resolve) => {
    socket.once('conversation-joined', resolve);
    socket.emit('join-conversation', join);
  });
  return { socket, joined, token: session.token, visitorId: session.visitorId };
}
