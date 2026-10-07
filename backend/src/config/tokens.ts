'use strict';

// İmzalı token'ların tek kaynağı.
//
// İki farklı amaçlı token aynı anahtarla, aynı algoritmayla imzalanıyordu:
//
//   oturum         panelin kimliği (userId, rol, organizasyon)
//   yükleme kanıtı widget'ın herkese açık yükleme uç noktasının verdiği,
//                  "bu dosyayı biz yükledik" diyen 15 dakikalık kanıt
//
// Doğrulayan taraf token'ın amacına hiç bakmıyordu. Bir web sitesinin anonim
// ziyaretçisi bir dosya yükleyip aldığı kanıtı Authorization başlığına
// koyduğunda imza geçiyordu; kanıtta userId olmadığı için sorgu
// `User.findOne({ _id: undefined, isActive: true })` oluyor, ORM tanımsız
// koşulu düşürüyor ve çağıran veritabanındaki ilk aktif kullanıcı — herhangi
// bir şirketin sahibi — olarak kimlik kazanıyordu.
//
// Artık iki katman var:
//   - Her amaç kendi türetilmiş anahtarıyla imzalanır. Bir yükleme kanıtı
//     oturum anahtarıyla hiçbir koşulda doğrulanamaz; claim kontrolü
//     unutulsa bile.
//   - Her token bir `aud` taşır ve doğrulayıcı onu ister. Oturum ayrıca
//     geçerli bir userId ve userType taşımak zorunda.

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { jwtSecret } from './jwt';
import { isValidObjectId } from '../db/objectId';
import type { AuthTokenPayload } from '../types/auth';

const SESSION_AUDIENCE = 'support-chat:session';
const UPLOAD_AUDIENCE = 'support-chat:upload-proof';

/** Tek kök gizli anahtardan amaca özgü bir anahtar türetir (HMAC-SHA256). */
export function derivedKey(purpose: string): Buffer {
  return crypto.createHmac('sha256', jwtSecret()).update(`support-chat/${purpose}/v1`).digest();
}

// ------------------------------------------------------------------ oturum

export function signSession(payload: AuthTokenPayload, expiresInSeconds: number): string {
  return jwt.sign({ ...payload }, derivedKey('session'), {
    algorithm: 'HS256',
    audience: SESSION_AUDIENCE,
    expiresIn: expiresInSeconds
  });
}

/**
 * Bir oturum token'ını doğrular. Amaç, algoritma, süre ve kimlik alanları
 * birlikte kontrol edilir; herhangi biri tutmazsa fırlatır.
 */
export function verifySession(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, derivedKey('session'), {
    algorithms: ['HS256'],
    audience: SESSION_AUDIENCE
  }) as AuthTokenPayload & { aud?: unknown };

  // Kimliği olmayan bir oturum olamaz. Bu kontrol ORM'e tanımsız bir koşul
  // ulaşmasını da imza katmanından bağımsız olarak engeller.
  if (!isValidObjectId(decoded.userId)) throw new Error('Session carries no user');
  if (
    decoded.userType !== undefined &&
    decoded.userType !== 'user' &&
    decoded.userType !== 'team'
  ) {
    throw new Error('Session carries an unknown user type');
  }
  if (
    decoded.organizationId !== undefined &&
    decoded.organizationId !== null &&
    !isValidObjectId(decoded.organizationId)
  ) {
    throw new Error('Session carries a malformed organization');
  }
  if (decoded.sv !== undefined && !Number.isInteger(decoded.sv)) {
    throw new Error('Session carries a malformed version');
  }
  return decoded;
}

/**
 * Whether a verified session is still current for its account: a password
 * reset (or any future "sign out everywhere") raises the account's
 * session_version, and every session signed with an older one ends.
 * Sessions issued before versions existed carry none and count as 0.
 */
export function sessionIsCurrent(
  decoded: AuthTokenPayload,
  account: { sessionVersion?: number | null }
): boolean {
  return (decoded.sv ?? 0) === (account.sessionVersion ?? 0);
}

// ------------------------------------------------------------ e-mailed links

/**
 * Links mailed to a visitor (plan v10 PRD-01, PRD-04): back to the chat,
 * no more e-mails about it, rate it. Each purpose has its own key and
 * audience, so one can never be traded for another — or for a session.
 */
export type VisitorLinkPurpose = 'resume' | 'email-optout' | 'csat';

export interface VisitorLinkClaims {
  siteId: string;
  conversationId: string;
  visitorId: string;
}

const VISITOR_LINK_TTL: Record<VisitorLinkPurpose, number> = {
  resume: 14 * 24 * 60 * 60,
  'email-optout': 90 * 24 * 60 * 60,
  csat: 7 * 24 * 60 * 60
};

export function signVisitorLink(purpose: VisitorLinkPurpose, claims: VisitorLinkClaims): string {
  return jwt.sign({ ...claims, purpose }, derivedKey(`visitor-link-${purpose}`), {
    algorithm: 'HS256',
    audience: `support-chat:${purpose}`,
    expiresIn: VISITOR_LINK_TTL[purpose]
  });
}

export function verifyVisitorLink(
  purpose: VisitorLinkPurpose,
  token: unknown
): VisitorLinkClaims | null {
  if (typeof token !== 'string' || !token || token.length > 2048) return null;
  try {
    const decoded = jwt.verify(token, derivedKey(`visitor-link-${purpose}`), {
      algorithms: ['HS256'],
      audience: `support-chat:${purpose}`
    }) as VisitorLinkClaims & { purpose?: string };
    if (decoded.purpose !== purpose) return null;
    if (!isValidObjectId(decoded.siteId) || !isValidObjectId(decoded.conversationId)) return null;
    if (typeof decoded.visitorId !== 'string' || !WIDGET_VISITOR_ID.test(decoded.visitorId)) {
      return null;
    }
    return {
      siteId: decoded.siteId,
      conversationId: decoded.conversationId,
      visitorId: decoded.visitorId
    };
  } catch {
    return null;
  }
}

// -------------------------------------------------- two-step sign-in pending

const MFA_AUDIENCE = 'support-chat:mfa-pending';
export const MFA_PENDING_TTL_SECONDS = 5 * 60;

/**
 * What a correct password earns when the account has two-step sign-in on:
 * not a session, only five minutes to present the second step. Signed with
 * its own key and audience, so it can never pass as a session.
 */
export interface MfaPendingClaims {
  purpose: 'mfa';
  userId: string;
  userType: 'user' | 'team';
  sv: number;
}

export function signMfaPending(claims: Omit<MfaPendingClaims, 'purpose'>): string {
  return jwt.sign({ ...claims, purpose: 'mfa' }, derivedKey('mfa-pending'), {
    algorithm: 'HS256',
    audience: MFA_AUDIENCE,
    expiresIn: MFA_PENDING_TTL_SECONDS
  });
}

export function verifyMfaPending(token: unknown): MfaPendingClaims | null {
  if (typeof token !== 'string' || !token || token.length > 2048) return null;
  try {
    const decoded = jwt.verify(token, derivedKey('mfa-pending'), {
      algorithms: ['HS256'],
      audience: MFA_AUDIENCE
    }) as MfaPendingClaims;
    if (decoded.purpose !== 'mfa' || !isValidObjectId(decoded.userId)) return null;
    if (decoded.userType !== 'user' && decoded.userType !== 'team') return null;
    if (!Number.isInteger(decoded.sv)) return null;
    return decoded;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------- yükleme kanıtı

export interface UploadProofClaims {
  kind: 'chat-upload';
  siteId: string;
  filename: string;
  url: string;
  size: number;
  mimeType: string;
}

export function signUploadProof(claims: UploadProofClaims): string {
  return jwt.sign({ ...claims }, derivedKey('upload-proof'), {
    algorithm: 'HS256',
    audience: UPLOAD_AUDIENCE,
    expiresIn: '15m'
  });
}

export function verifyUploadProof(token: string): UploadProofClaims {
  const decoded = jwt.verify(token, derivedKey('upload-proof'), {
    algorithms: ['HS256'],
    audience: UPLOAD_AUDIENCE
  }) as UploadProofClaims;
  if (decoded.kind !== 'chat-upload') throw new Error('Not an upload proof');
  return decoded;
}

// ----------------------------------------------------------- widget session

const WIDGET_AUDIENCE = 'support-chat:widget';

/**
 * What a visitor's widget carries instead of an id it made up itself.
 *
 * The widget used to send `siteKey` + a `visitorId` it generated and kept in
 * localStorage, and the server believed both: anyone who learned another
 * visitor's id (it is in that browser's storage and in every page the widget
 * runs on) could join that visitor's conversation and read it. Now the server
 * mints the visitor id, signs it into this token together with the site, and
 * reads both back from the signature only. A payload that names a site or a
 * visitor is ignored.
 */
export interface WidgetSessionClaims {
  purpose: 'widget';
  siteId: string;
  /** Server-generated, crypto-random. */
  visitorId: string;
  /** One per issued session chain; keys the per-session limits. */
  sid: string;
  /**
   * A fingerprint of the site key the session was issued under. Regenerating
   * the key changes it, so every session issued before is refused at once.
   */
  kv: string;
}

export interface VerifiedWidgetSession extends WidgetSessionClaims {
  iat: number;
  exp: number;
}

/** How long a widget token is accepted for API and socket use. */
export const WIDGET_SESSION_TTL_SECONDS =
  Number(process.env.WIDGET_SESSION_TTL_SECONDS) || 24 * 60 * 60;

/**
 * How long after expiry a token may still be traded for a fresh one. A visitor
 * who returns within this window keeps their visitor id — and with it their
 * open conversation; after it they start as a new visitor.
 */
export const WIDGET_SESSION_RENEW_SECONDS =
  Number(process.env.WIDGET_SESSION_RENEW_SECONDS) || 30 * 24 * 60 * 60;

/** Visitor ids the server mints: `v_` and 32 hex characters. */
export const WIDGET_VISITOR_ID = /^v_[0-9a-f]{32}$/;

export function newVisitorId(): string {
  return `v_${crypto.randomBytes(16).toString('hex')}`;
}

export function newWidgetSessionId(): string {
  return crypto.randomBytes(12).toString('hex');
}

/** The site-key fingerprint a widget token is bound to. */
export function siteKeyVersion(siteKey: string): string {
  return crypto
    .createHmac('sha256', derivedKey('widget-site-key'))
    .update(siteKey)
    .digest('hex')
    .slice(0, 16);
}

export function signWidgetSession(claims: Omit<WidgetSessionClaims, 'purpose'>): {
  token: string;
  expiresAt: Date;
} {
  const token = jwt.sign({ ...claims, purpose: 'widget' }, derivedKey('widget-session'), {
    algorithm: 'HS256',
    audience: WIDGET_AUDIENCE,
    expiresIn: WIDGET_SESSION_TTL_SECONDS
  });
  return { token, expiresAt: new Date(Date.now() + WIDGET_SESSION_TTL_SECONDS * 1000) };
}

function checkWidgetClaims(decoded: VerifiedWidgetSession): VerifiedWidgetSession {
  if (decoded.purpose !== 'widget') throw new Error('Not a widget session');
  if (!isValidObjectId(decoded.siteId)) throw new Error('Widget session carries no site');
  if (typeof decoded.visitorId !== 'string' || !WIDGET_VISITOR_ID.test(decoded.visitorId)) {
    throw new Error('Widget session carries no visitor');
  }
  if (typeof decoded.sid !== 'string' || !/^[0-9a-f]{24}$/.test(decoded.sid)) {
    throw new Error('Widget session carries no session id');
  }
  if (typeof decoded.kv !== 'string' || !decoded.kv) {
    throw new Error('Widget session carries no key version');
  }
  return decoded;
}

/**
 * A widget token that is valid right now. Signed with its own derived key, so
 * an admin session (or an upload proof) can never pass as one, and the reverse.
 */
export function verifyWidgetSession(token: string): VerifiedWidgetSession {
  const decoded = jwt.verify(token, derivedKey('widget-session'), {
    algorithms: ['HS256'],
    audience: WIDGET_AUDIENCE
  }) as VerifiedWidgetSession;
  return checkWidgetClaims(decoded);
}

/**
 * A widget token that may be renewed: signature, purpose and claims must all
 * hold, but it may have expired up to WIDGET_SESSION_RENEW_SECONDS ago.
 * Returns null for anything else — the caller then starts a new visitor.
 */
export function renewableWidgetSession(token: unknown): VerifiedWidgetSession | null {
  if (typeof token !== 'string' || !token || token.length > 2048) return null;
  try {
    const decoded = jwt.verify(token, derivedKey('widget-session'), {
      algorithms: ['HS256'],
      audience: WIDGET_AUDIENCE,
      ignoreExpiration: true
    }) as VerifiedWidgetSession;
    checkWidgetClaims(decoded);
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (
      typeof decoded.exp !== 'number' ||
      decoded.exp + WIDGET_SESSION_RENEW_SECONDS < nowSeconds
    ) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}
