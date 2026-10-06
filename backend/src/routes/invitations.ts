// Inviting agents (plan §7.3).
//
//   GET    /api/invitations              open and recent invitations
//   POST   /api/invitations              invite { email, role, assignedSites }
//   POST   /api/invitations/:id/resend   a fresh link, a fresh week
//   DELETE /api/invitations/:id          revoke
//   GET    /api/invitations/accept?token what the invitation is for (no account needed)
//   POST   /api/invitations/accept       { token, name, password } → a signed-in agent
//
// The invited person chooses their own password; nobody types it for them.
// A seat is taken when the invitation is sent (it holds the place it will
// fill) and checked again, under the organization's lock, when it is
// accepted — so neither many invitations nor many acceptances at once can pass
// the plan's agent limit.

import crypto from 'crypto';
import express from 'express';
import Team from '../models/Team';
import User from '../models/User';
import Organization from '../models/Organization';
import events from '../events';
import { auth } from '../middleware/auth';
import { checkPermission } from '../middleware/rbac';
import { canAssignRole, isTeamRole, ownedSiteIds } from '../middleware/teamPolicy';
import { passwordProblem } from '../config/passwords';
import { signSession } from '../config/tokens';
import { SESSION_TTL_SECONDS, startSession } from '../config/session';
import { query, withTransaction } from '../db/pool';
import { generateId, isValidObjectId } from '../db/objectId';
import { appBaseUrl, mail } from '../services/mail';
import { assertCanAddAgent, lockOrganization } from '../services/entitlements';
import { createLimiter, invitationLimiter } from '../middleware/rateLimit';
import {
  HttpError,
  asyncHandler,
  badRequest,
  conflict,
  forbidden,
  notFound,
  orgId,
  requireOrganization
} from '../http';
import type { Request, Response } from 'express';
import type { MailLocale } from '../services/mail';
import type { TeamRole } from '../domain';

const router = express.Router();

/** How long an invitation link works. */
const INVITATION_TTL_DAYS = 7;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const hashOf = (token: string): string => crypto.createHash('sha256').update(token).digest('hex');

const invalidInvitation = () =>
  new HttpError(400, 'This invitation is invalid, expired or already used', 'INVALID_INVITATION');

interface InvitationRow {
  id: string;
  organization_id: string;
  email: string;
  role: string;
  assigned_sites: string[];
  expires_at: Date;
  accepted_at: Date | null;
  revoked_at: Date | null;
  invited_by: string | null;
  created_at: Date;
}

function present(row: InvitationRow) {
  const now = Date.now();
  return {
    _id: row.id,
    email: row.email,
    role: row.role,
    assignedSites: row.assigned_sites,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    status: row.accepted_at
      ? 'accepted'
      : row.revoked_at
        ? 'revoked'
        : new Date(row.expires_at).getTime() <= now
          ? 'expired'
          : 'pending'
  };
}

function mailLocale(req: Request): MailLocale {
  const asked = String(req.body?.locale || req.get('accept-language') || '').toLowerCase();
  return asked.startsWith('en') ? 'en' : 'tr';
}

/** Whether an address already belongs to an active account anywhere. */
async function addressTaken(email: string): Promise<boolean> {
  return Boolean(
    (await User.findOne({ email, isActive: true })) ||
    (await Team.findOne({ email, isActive: true }))
  );
}

async function sendInvitationMail(req: Request, email: string, token: string): Promise<boolean> {
  const organization = await Organization.findById(orgId(req));
  return mail.sendInvitation(email, {
    organization: organization?.name || 'Support.io',
    inviter: req.user.name,
    link: `${appBaseUrl()}/invite/accept?token=${encodeURIComponent(token)}`,
    locale: mailLocale(req)
  });
}

// ----------------------------------------------------- accepting (no account)

// Declared before the authenticated routes: the invited person has no session.
const acceptLimiter = createLimiter({
  name: 'invitation-accept',
  code: 'TOO_MANY_REQUESTS',
  message: 'Too many attempts, please try again later.',
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 30 : 100000
});

/** The open invitation behind a token, or null; does not spend it. */
async function openInvitation(token: unknown, client?: { query: typeof query }) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 200) return null;
  const run = client ?? { query };
  const { rows } = await run.query<InvitationRow>(
    `SELECT * FROM invitations
      WHERE token_hash = $1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()
      ${client ? 'FOR UPDATE' : ''}`,
    [hashOf(token)]
  );
  return rows[0] ?? null;
}

router.get(
  '/accept',
  acceptLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const invitation = await openInvitation(req.query.token);
    if (!invitation) throw invalidInvitation();
    const organization = await Organization.findById(invitation.organization_id);
    res.json({
      email: invitation.email,
      role: invitation.role,
      organization: organization?.name ?? null,
      expiresAt: invitation.expires_at
    });
  })
);

router.post(
  '/accept',
  acceptLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name || name.length > 100) throw badRequest('Invalid name');
    const problem = passwordProblem(req.body?.password);
    if (problem) throw badRequest(problem);

    const member = await withTransaction(async (client) => {
      const invitation = await openInvitation(req.body?.token, client);
      if (!invitation) throw invalidInvitation();

      // The seat this invitation held is converted, not added: it is left out
      // of the count, and everything else is checked under the lock.
      await lockOrganization(client, invitation.organization_id);
      await assertCanAddAgent(invitation.organization_id, client, {
        exceptInvitation: invitation.id
      });
      if (await addressTaken(invitation.email)) {
        throw conflict('An account already uses this address; sign in instead');
      }

      // Sites deleted since the invitation was sent are dropped, not fatal.
      const sites = invitation.assigned_sites.length
        ? (
            await client.query<{ id: string }>(
              'SELECT id FROM sites WHERE organization_id = $1 AND id = ANY($2)',
              [invitation.organization_id, invitation.assigned_sites]
            )
          ).rows.map((r) => r.id)
        : [];

      const team = new Team({
        email: invitation.email,
        password: req.body.password,
        name,
        role: invitation.role as TeamRole,
        organizationId: invitation.organization_id,
        assignedSites: sites,
        isActive: true,
        status: 'offline',
        // The link reached this inbox, which proves the address.
        emailVerifiedAt: new Date()
      });
      await team.save({ client });
      await client.query('UPDATE invitations SET accepted_at = now() WHERE id = $1', [
        invitation.id
      ]);
      return { team, invitation };
    });

    events.emit('invitation.accepted', {
      organizationId: member.invitation.organization_id,
      userId: member.team._id,
      entityId: member.invitation.id,
      metadata: { role: member.invitation.role },
      ip: req.ip,
      ua: req.get('user-agent')
    });
    events.emit('agent.created', {
      organizationId: member.invitation.organization_id,
      userId: member.invitation.invited_by,
      entityId: member.team._id,
      metadata: { name: member.team.name, email: member.team.email, via: 'invitation' }
    });

    const token = signSession(
      {
        userId: member.team._id,
        userType: 'team',
        role: member.team.role,
        organizationId: member.invitation.organization_id,
        sv: member.team.sessionVersion ?? 0
      },
      SESSION_TTL_SECONDS
    );
    res.status(201).json({
      user: {
        id: member.team._id,
        _id: member.team._id,
        email: member.team.email,
        name: member.team.name,
        role: member.team.role,
        userType: 'team',
        isOnboarded: true,
        emailVerified: true,
        organizationId: member.invitation.organization_id
      },
      csrfToken: startSession(res, token)
    });
  })
);

// ------------------------------------------------------------ managing them

router.use(auth, requireOrganization, checkPermission('manage_users'));

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { rows } = await query<InvitationRow>(
      `SELECT * FROM invitations
        WHERE organization_id = $1
          AND (accepted_at IS NULL OR accepted_at > now() - interval '30 days')
        ORDER BY created_at DESC
        LIMIT 200`,
      [orgId(req)]
    );
    res.json({ invitations: rows.map(present) });
  })
);

router.post(
  '/',
  invitationLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = orgId(req);
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const role = req.body?.role ?? 'agent';
    if (!EMAIL.test(email) || email.length > 254) throw badRequest('Invalid email address');
    if (!isTeamRole(role)) throw badRequest('Invalid role');
    if (!canAssignRole(req.user.role, role)) throw forbidden('You cannot assign this role');

    const siteIds = await ownedSiteIds(organizationId, req.body?.assignedSites);
    if (!siteIds) throw badRequest('Unknown site in assignedSites');
    if (await addressTaken(email)) throw conflict('An account already uses this address');

    const token = crypto.randomBytes(32).toString('base64url');
    const invitation = await withTransaction(async (client) => {
      await lockOrganization(client, organizationId);
      // Re-inviting an address replaces its open invitation (and frees that
      // seat before counting).
      await client.query(
        `UPDATE invitations SET revoked_at = now()
          WHERE organization_id = $1 AND lower(email) = $2
            AND accepted_at IS NULL AND revoked_at IS NULL`,
        [organizationId, email]
      );
      await assertCanAddAgent(organizationId, client);
      const { rows } = await client.query<InvitationRow>(
        `INSERT INTO invitations
           (id, organization_id, email, role, assigned_sites, token_hash, expires_at, invited_by)
         VALUES ($1, $2, $3, $4, $5, $6, now() + make_interval(days => $7), $8)
         RETURNING *`,
        [
          generateId(),
          organizationId,
          email,
          role,
          siteIds,
          hashOf(token),
          INVITATION_TTL_DAYS,
          req.userId
        ]
      );
      return rows[0];
    });

    const sent = await sendInvitationMail(req, email, token);
    events.emit('invitation.sent', {
      organizationId,
      userId: req.userId,
      entityId: invitation.id,
      metadata: { email, role },
      ip: req.ip,
      ua: req.get('user-agent')
    });
    res.status(201).json({ invitation: present(invitation), sent });
  })
);

/** One of this organization's open invitations. */
async function ownOpenInvitation(req: Request, id: unknown): Promise<InvitationRow> {
  if (!isValidObjectId(id)) throw notFound('Invitation');
  const { rows } = await query<InvitationRow>(
    `SELECT * FROM invitations
      WHERE id = $1 AND organization_id = $2 AND accepted_at IS NULL AND revoked_at IS NULL`,
    [id, orgId(req)]
  );
  if (!rows[0]) throw notFound('Invitation');
  return rows[0];
}

router.post(
  '/:id/resend',
  invitationLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const invitation = await ownOpenInvitation(req, req.params.id);
    if (!canAssignRole(req.user.role, invitation.role as TeamRole)) {
      throw forbidden('You cannot assign this role');
    }
    const token = crypto.randomBytes(32).toString('base64url');
    const { rows } = await query<InvitationRow>(
      `UPDATE invitations
          SET token_hash = $2, expires_at = now() + make_interval(days => $3)
        WHERE id = $1
        RETURNING *`,
      [invitation.id, hashOf(token), INVITATION_TTL_DAYS]
    );
    const sent = await sendInvitationMail(req, invitation.email, token);
    res.json({ invitation: present(rows[0]), sent });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const invitation = await ownOpenInvitation(req, req.params.id);
    await query('UPDATE invitations SET revoked_at = now() WHERE id = $1', [invitation.id]);
    events.emit('invitation.revoked', {
      organizationId: orgId(req),
      userId: req.userId,
      entityId: invitation.id,
      metadata: { email: invitation.email },
      ip: req.ip,
      ua: req.get('user-agent')
    });
    res.json({ revoked: true });
  })
);

export default router;
