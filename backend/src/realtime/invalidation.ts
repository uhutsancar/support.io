import type { Server } from 'socket.io';
import { siteRoom, userRoom } from './rooms';

let socketServer: Server | null = null;

/** Registered once by the Socket.IO composition root in each replica. */
export function registerSocketServer(io: Server): void {
  socketServer = io;
}

/** Disconnect every live session for an account, across the Redis adapter. */
export function invalidateAdminAccount(userId: unknown): void {
  if (!socketServer || !userId) return;
  socketServer.of('/admin').in(userRoom(userId)).disconnectSockets(true);
}

/** Disconnect all admin and widget sockets that currently receive a site. */
export function invalidateSite(siteId: unknown): void {
  if (!socketServer || !siteId) return;
  socketServer.of('/admin').in(siteRoom(siteId)).disconnectSockets(true);
  socketServer.of('/widget').in(siteRoom(siteId)).disconnectSockets(true);
}

/** Disconnect all admin accounts in an organization. */
export function invalidateOrganization(organizationId: unknown): void {
  if (!socketServer || !organizationId) return;
  socketServer
    .of('/admin')
    .in(`org:${String(organizationId)}`)
    .disconnectSockets(true);
}
