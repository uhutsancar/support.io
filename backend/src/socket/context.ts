// What every socket handler needs: the two namespaces, the authorised lookups,
// and one way to refuse.
//
// These were methods on a 1455-line class that also held every event handler,
// the authentication middleware and a background timer. Pulled out, they are
// the socket layer's equivalent of `src/http/guards.ts`: the single place where
// "may this socket act on this row" is decided, so a handler is left with just
// its own logic.

import { captureError } from '../services/errorReporting';
import Conversation from '../models/Conversation';
import Site from '../models/Site';
import Team from '../models/Team';
import User from '../models/User';
import Organization from '../models/Organization';
import TeamChat from '../models/TeamChat';
import { verifyUploadProof } from '../config/tokens';
import { siteKeyMatches } from '../config/tokens';
import { query } from '../db/pool';
import { isDevelopment } from '../config/env';
import { mayAccessSite } from '../http/guards';
import { conversationRoom, siteRoom, teamChatRoom, userRoom } from '../realtime/rooms';
import type { Namespace, Server, Socket } from 'socket.io';
import type { Doc } from '../db/model';
import type { ConversationDoc } from '../models/Conversation';
import type { SiteDoc } from '../models/Site';
import type { TeamChatDoc } from '../models/TeamChat';
import type { AdminSocket, UploadedFilePayload, VerifiedFile, WidgetSocket } from './types';

/** The largest attachment a message may reference. */
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** Hosts whose plain-http attachment URLs are acceptable in development. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function isAcceptableAttachmentUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol === 'https:') return true;
  return isDevelopment && url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname);
}

/**
 * The shared surface handlers are built against.
 *
 * Holding the namespaces here rather than reaching for `io.of('/admin')` inside
 * each handler is what makes the room names checkable — see realtime/rooms.ts.
 */
export class SocketContext {
  readonly io: Server;
  readonly widget: Namespace;
  readonly admin: Namespace;

  constructor(io: Server) {
    this.io = io;
    this.widget = io.of('/widget');
    this.admin = io.of('/admin');
  }

  /**
   * Revalidates the security state captured at the handshake. A database or
   * cache error fails closed. Mutations also publish immediate invalidations,
   * while this check is the recovery path for a lost Redis notification.
   */
  async socketIsCurrent(socket: AdminSocket | WidgetSocket): Promise<boolean> {
    try {
      if (!socket.tokenExpiresAt || Date.now() >= socket.tokenExpiresAt) return false;
      if ('userId' in socket && socket.userId) {
        const Account = socket.userType === 'team' ? Team : User;
        const account = await Account.findOne({ _id: socket.userId, isActive: true });
        if (!account?.organizationId) return false;
        if (String(account.organizationId) !== String(socket.organizationId)) return false;
        if ((account.sessionVersion ?? 0) !== socket.sessionVersion) return false;
        const organization = await Organization.findOne({
          _id: account.organizationId,
          isActive: true
        });
        if (!organization) return false;
        if (organization.enforce2fa && !(account.totpEnabledAt && account.totpSecretEnc)) {
          return false;
        }

        const nextSites = new Set((account.assignedSites || []).map(String));
        const sitesChanged =
          nextSites.size !== socket.allowedSiteIds.size ||
          [...nextSites].some((siteId) => !socket.allowedSiteIds.has(siteId));
        const privilegeChanged =
          account.role !== socket.role ||
          Boolean(account.seatSuspendedAt) !== Boolean(socket.seatSuspended) ||
          sitesChanged;
        if (privilegeChanged) return false;
        return true;
      }

      if (!('widgetKeyVersion' in socket)) return false;
      const site = await Site.findOne({ _id: socket.siteId, isActive: true });
      return Boolean(
        site &&
        !site.suspendedAt &&
        !site.blockedAt &&
        siteKeyMatches(site.siteKey, socket.widgetKeyVersion)
      );
    } catch {
      return false;
    }
  }

  /** Applies current-auth checks to every incoming packet and token expiry. */
  installLiveAuthorization(socket: AdminSocket | WidgetSocket): void {
    socket.use((_packet, next) => {
      void this.socketIsCurrent(socket).then((current) => {
        if (current) next();
        else {
          socket.disconnect(true);
          next(new Error('Authentication required'));
        }
      });
    });

    const tokenExpiresAt = socket.tokenExpiresAt;
    if (!tokenExpiresAt) {
      socket.disconnect(true);
      return;
    }
    const expiryDelay = Math.max(0, tokenExpiresAt - Date.now());
    const expiry = setTimeout(() => socket.disconnect(true), expiryDelay);
    expiry.unref();
    const lifetime = setTimeout(
      () => socket.disconnect(true),
      Math.min(expiryDelay, Number(process.env.SOCKET_MAX_LIFETIME_MS) || 12 * 60 * 60 * 1000)
    );
    lifetime.unref();

    // Every socket is periodically checked even if it only receives data.
    // Immediate room invalidation is the fast path; this is the recovery path
    // for a lost Redis notification or an operator changing the database from
    // another process.
    const interval = setInterval(
      () => {
        void this.socketIsCurrent(socket).then((current) => {
          if (!current) socket.disconnect(true);
        });
      },
      Math.min(60_000, Math.max(5_000, Number(process.env.SOCKET_AUTH_RECHECK_MS) || 30_000))
    );
    interval.unref();
    socket.once('disconnect', () => {
      clearTimeout(expiry);
      clearTimeout(lifetime);
      clearInterval(interval);
    });
  }

  // ------------------------------------------------------------- broadcasting

  toAdminSite(siteId: unknown, event: string, payload: unknown): void {
    this.admin.to(siteRoom(siteId)).emit(event, payload);
  }

  toAdminUser(userId: unknown, event: string, payload: unknown): void {
    this.admin.to(userRoom(userId)).emit(event, payload);
  }

  toAdminConversation(conversationId: unknown, event: string, payload: unknown): void {
    this.admin.to(conversationRoom(conversationId)).emit(event, payload);
  }

  toWidgetConversation(conversationId: unknown, event: string, payload: unknown): void {
    this.widget.to(conversationRoom(conversationId)).emit(event, payload);
  }

  toTeamChat(chatId: unknown, event: string, payload: unknown): void {
    this.admin.to(teamChatRoom(chatId)).emit(event, payload);
  }

  // ----------------------------------------------------------------- refusals

  /**
   * Reports a failure without its internals.
   *
   * Database errors name tables and constraints; the full error stays in the
   * server log, and the client is told only that the request failed.
   */
  fail(socket: Socket, error: unknown): void {
    console.error('[socket]', error);
    captureError(error, { source: 'socket' });
    socket.emit('error', { message: 'Request failed' });
  }

  /**
   * The answer for anything the socket may not touch.
   *
   * Deliberately the same message for "no such row" and "not yours", so an id
   * that resolves for somebody else is indistinguishable from one that does not
   * exist at all.
   */
  reject(socket: Socket): void {
    socket.emit('error', { message: 'Resource not found or access denied' });
  }

  /**
   * Wraps a handler so a rejected promise cannot become an unhandled rejection.
   *
   * Socket.IO does not await a listener, so a throw inside an async one used to
   * vanish — which is why every handler carried its own try/catch, and why the
   * few that forgot simply stopped responding. The return type is `unknown`
   * because handlers commonly end with `return socket.emit(...)`, which is a
   * readable early exit and returns a boolean.
   */
  guard<T extends unknown[]>(
    socket: Socket,
    handler: (...args: T) => Promise<unknown> | unknown
  ): (...args: T) => void {
    return (...args: T) => {
      // An event sent with an acknowledgement carries the callback last; a
      // failure must answer it too, or the sender waits out its timeout.
      const last = args[args.length - 1];
      const ack = typeof last === 'function' ? (last as (reply: unknown) => void) : null;
      Promise.resolve()
        .then(() => handler(...args))
        .catch((error) => {
          this.fail(socket, error);
          ack?.({ ok: false, code: 'SERVER_ERROR' });
        });
    };
  }

  // ------------------------------------------------------- authorised lookups

  /** The site, if this admin socket's organization owns it and may see it. */
  async siteFor(socket: AdminSocket, siteId: unknown): Promise<Doc<SiteDoc> | null> {
    if (!siteId) return null;

    const site = await Site.findOne({
      _id: siteId,
      organizationId: socket.organizationId,
      isActive: true
    });
    if (!site) return null;

    // The inbox rule, shared with the HTTP routes: see http/guards.ts.
    return mayAccessSite(socket.role, socket.allowedSiteIds, site._id) ? site : null;
  }

  /** The conversation, if this admin socket may work on it. */
  async conversationFor(
    socket: AdminSocket,
    conversationId: unknown,
    { populateDepartment = false }: { populateDepartment?: boolean } = {}
  ): Promise<Doc<ConversationDoc> | null> {
    if (!conversationId) return null;

    let query = Conversation.findOne({
      _id: conversationId,
      organizationId: socket.organizationId
    });
    if (populateDepartment) query = query.populate('department');

    const conversation = await query;
    if (!conversation) return null;

    // The organization filter alone is not enough: an agent restricted to some
    // sites must not reach a conversation on one of the others.
    return (await this.siteFor(socket, conversation.siteId)) ? conversation : null;
  }

  /** The conversation this widget socket is actually in. */
  async widgetConversationFor(
    socket: WidgetSocket,
    conversationId: unknown
  ): Promise<Doc<ConversationDoc> | null> {
    if (!conversationId || !socket.siteId || !socket.visitorId) return null;
    // Scoped to the visitor as well as the site: knowing a conversation id must
    // not be enough to read somebody else's chat.
    return Conversation.findOne({
      _id: conversationId,
      siteId: socket.siteId,
      visitorId: socket.visitorId
    });
  }

  /** The team chat, if this socket takes part in it. */
  async chatFor(socket: AdminSocket, chatId: unknown): Promise<Doc<TeamChatDoc> | null> {
    if (!chatId) return null;
    return TeamChat.findOne({ chatId, participants: socket.userId });
  }

  /**
   * Checks the signed proof that accompanies an attachment.
   *
   * The upload endpoint is public — a visitor uploads before any conversation
   * exists — so the URL it returns is public too. Without this the client could
   * claim any URL it liked as an attachment. The proof is signed with its own
   * derived key and names the exact file, so it cannot be re-pointed or reused
   * for another site. See config/tokens.ts.
   */
  async verifyAttachment(
    fileData: UploadedFilePayload | undefined,
    siteId: unknown,
    conversationId: unknown,
    principal: {
      type: 'widget' | 'user' | 'team';
      id: string;
      sessionId: string | null;
    }
  ): Promise<VerifiedFile | null> {
    if (!fileData || typeof fileData !== 'object' || typeof fileData.uploadToken !== 'string') {
      return null;
    }

    try {
      const proof = verifyUploadProof(fileData.uploadToken);
      const matches =
        proof.kind === 'chat-upload' &&
        String(proof.siteId) === String(siteId) &&
        proof.principalType === principal.type &&
        proof.principalId === principal.id &&
        proof.sessionId === principal.sessionId &&
        proof.filename === fileData.filename &&
        proof.url === fileData.url &&
        Number(proof.size) === Number(fileData.size) &&
        proof.mimeType === fileData.mimeType;
      if (!matches) return null;

      // An attachment URL is embedded in a page we do not control, so it must
      // not be plain http in production — a mixed-content link either fails to
      // load or downgrades the customer's page. Development serves uploads from
      // the local disk over http on localhost, which is the one case where
      // there is nothing to downgrade.
      if (!isAcceptableAttachmentUrl(String(fileData.url))) return null;

      // The first valid send binds a pending upload to this conversation. A
      // retry in the same conversation is allowed; moving it to another
      // conversation, visitor, widget session or account is not.
      const { rows } = await query<{ id: string }>(
        `UPDATE upload_records
            SET conversation_id = COALESCE(conversation_id, $2),
                status = 'bound', updated_at = now()
          WHERE id = $1 AND site_id = $3 AND principal_type = $4
            AND principal_id = $5 AND session_id IS NOT DISTINCT FROM $6
            AND object_key = $7 AND mime_type = $8 AND byte_size = $9
            AND expires_at > now() AND status IN ('pending', 'bound')
            AND (conversation_id IS NULL OR conversation_id = $2)
          RETURNING id`,
        [
          proof.uploadId,
          String(conversationId),
          String(siteId),
          principal.type,
          principal.id,
          principal.sessionId,
          proof.filename,
          proof.mimeType,
          Number(proof.size)
        ]
      );
      if (!rows[0]) return null;

      return {
        // The storage key; a private attachment is shown through a link
        // signed from it whenever the message is read (models/Message.ts).
        key: String(fileData.filename).slice(0, 500),
        filename: String(fileData.filename).slice(0, 500),
        originalName: String(fileData.originalName || 'attachment').slice(0, 255),
        mimeType: String(fileData.mimeType || 'application/octet-stream').slice(0, 150),
        size: Math.max(0, Math.min(Number(fileData.size) || 0, MAX_ATTACHMENT_BYTES)),
        // The proof was signed over this exact string, so it is stored as it
        // was verified rather than re-serialised through `URL`.
        url: String(fileData.url)
      };
    } catch {
      // An unverifiable proof is simply not an attachment.
      return null;
    }
  }
}
