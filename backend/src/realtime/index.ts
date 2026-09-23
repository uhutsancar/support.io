// The realtime layer: rooms, and the named broadcasts that go to them.

import { AdminNotifier, WidgetNotifier, adminNotifier } from './notifier';
import type { Request } from 'express';
import type { Server } from 'socket.io';

export { AdminNotifier, WidgetNotifier, adminNotifier };
export * from './rooms';

/**
 * The socket server the app was started with.
 *
 * `server.ts` stores it with `app.set('io', io)`, and `app.get` is typed `any`,
 * so every call site was an untyped read. Narrowing it here means a route that
 * mistypes a notifier method is caught at compile time.
 */
export function ioFrom(req: Request): Server | null {
  return (req.app.get('io') as Server | undefined) ?? null;
}

/**
 * The admin notifier for this request, or null when the server has no io.
 *
 * Routes used to write `const io = req.app.get('io'); if (io) { ... }` around
 * every broadcast — ten copies of a null check whose only purpose was to let
 * route modules be imported without a running socket server.
 */
export function notifyAdmin(req: Request): AdminNotifier | null {
  return adminNotifier(ioFrom(req));
}
