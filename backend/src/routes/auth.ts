// Registration, sign-in and the session's lifecycle.
//
// The session token is never returned in the response body: it is written to an
// httpOnly cookie the browser attaches by itself and JavaScript cannot read.
// The `csrfToken` that *is* returned grants nothing — it only proves a request
// came from the panel. See config/session.ts for both halves of that design.

import express from 'express';
import { body, validationResult } from 'express-validator';
import User from '../models/User';
import Team from '../models/Team';
import Organization from '../models/Organization';
import Site from '../models/Site';
import events from '../events';
import { auth } from '../middleware/auth';
import { startSession, endSession, SESSION_TTL_SECONDS } from '../config/session';
import { signSession } from '../config/tokens';
import { passwordProblem, burnVerification, needsRehash } from '../config/passwords';
import { PRESENCE_STATUSES, isPresenceStatus } from '../domain';
import { asyncHandler, badRequest, unauthorized } from '../http';
import type { Request, Response } from 'express';
import type { AuthTokenPayload, AuthenticatedUser, UserType } from '../types/auth';

const router = express.Router();

const validateRegistration = [
  body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
  // The policy lives in config/passwords.ts: at least 8 characters, at most 72
  // bytes (bcrypt silently ignores anything past that).
  body('password').custom((value) => {
    const problem = passwordProblem(value);
    if (problem) throw new Error(problem);
    return true;
  }),
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2-50 characters')
];

const validateLogin = [body('email').isEmail().normalizeEmail(), body('password').notEmpty()];

/** Throws the first validation message, or nothing when the body is fine. */
function assertValid(req: Request, genericMessage?: string): void {
  const errors = validationResult(req);
  if (errors.isEmpty()) return;
  // Sign-in reports a generic message: telling a caller which half of the
  // credentials was malformed helps enumerate accounts.
  throw badRequest(genericMessage ?? String(errors.array()[0].msg));
}

/**
 * The account, as every endpoint here returns it.
 *
 * The three handlers each built this object separately and they had drifted:
 * register returned `isOnboarded` and `_id`, login returned those plus
 * `avatar`, and `/me` returned a nested `organization` instead of
 * `organizationId`. The panel then had to cope with all three shapes.
 */
function accountResponse(
  user: AuthenticatedUser,
  userType: UserType,
  organization?: { _id: unknown; name: string; planType: string } | null
) {
  return {
    id: user._id,
    _id: user._id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatar: user.avatar ?? null,
    status: user.status,
    // Only a User account carries the onboarding flag; a Team agent is invited
    // into an organization that is already set up, so they are always done.
    isOnboarded: userType === 'team' ? true : 'isOnboarded' in user ? user.isOnboarded : false,
    organizationId: user.organizationId ?? null,
    userType,
    ...(organization !== undefined
      ? {
          organization: organization
            ? { id: organization._id, name: organization.name, planType: organization.planType }
            : null
        }
      : {})
  };
}

/** Every account belongs to an organization; one is created if it has none. */
async function organizationFor(user: AuthenticatedUser): Promise<unknown> {
  if (user.organizationId) return user.organizationId;
  const organization = new Organization({ name: `${user.name}'s Organization`, planType: 'FREE' });
  await organization.save();
  return organization._id;
}

/**
 * The organization behind the host a failed sign-in was aimed at.
 *
 * Best-effort: it only enriches an audit record, so it must never fail the
 * request. Unlike the empty catch this replaces, the reason is logged.
 */
async function organizationForHost(host: string | undefined): Promise<unknown> {
  if (!host) return null;
  try {
    const site = await Site.findOne({ domain: host }).select('organizationId');
    return site?.organizationId ?? null;
  } catch (error) {
    console.error('[auth] could not resolve organization for host', host, error);
    return null;
  }
}

router.post(
  '/register',
  validateRegistration,
  asyncHandler(async (req: Request, res: Response) => {
    assertValid(req);
    const { email, password, name } = req.body;

    if (await User.findOne({ email, isActive: true })) {
      throw badRequest('Bu e-posta adresi zaten kayıtlı');
    }

    const organization = new Organization({ name: `${name}'s Organization`, planType: 'FREE' });
    await organization.save();

    const user = await User.create({
      email,
      password,
      name,
      role: 'owner',
      organizationId: organization._id
    });

    organization.ownerUserId = user._id;
    await organization.save();

    const token = signSession(
      { userId: user._id, organizationId: organization._id, role: user.role, userType: 'user' },
      SESSION_TTL_SECONDS
    );

    res.status(201).json({
      user: accountResponse(user, 'user'),
      csrfToken: startSession(res, token)
    });
  })
);

router.post(
  '/login',
  validateLogin,
  asyncHandler(async (req: Request, res: Response) => {
    assertValid(req, 'Invalid input');
    const { email, password } = req.body;

    // The account can live in either table, so the variable holds both shapes.
    let user: AuthenticatedUser | null = await User.findOne({ email, isActive: true });
    let userType: UserType = 'user';
    if (!user) {
      user = await Team.findOne({ email, isActive: true });
      userType = 'team';
    }

    if (!user) {
      // An unregistered address still costs one bcrypt comparison, so the
      // response time does not reveal which addresses exist.
      await burnVerification(password);
      events.emit('auth.login.failure', {
        organizationId: await organizationForHost(req.get('host')),
        userId: null,
        metadata: { email },
        ip: req.ip,
        ua: req.get('user-agent')
      });
      throw unauthorized('Invalid credentials');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      events.emit('auth.login.failure', {
        organizationId: user.organizationId,
        userId: user._id,
        metadata: { reason: 'invalid_password' },
        ip: req.ip,
        ua: req.get('user-agent')
      });
      throw unauthorized('Invalid credentials');
    }

    // The password is in hand and the hash is out of date, so it is upgraded to
    // today's cost without the user doing anything.
    if (needsRehash(user.password)) user.password = password;

    user.organizationId = await organizationFor(user);
    user.status = 'online';
    await user.save();

    const tokenPayload: AuthTokenPayload = { userId: user._id, userType, role: user.role };
    if (user.organizationId) tokenPayload.organizationId = user.organizationId;

    events.emit('auth.login.success', {
      organizationId: user.organizationId,
      userId: user._id,
      metadata: { userType },
      ip: req.ip,
      ua: req.get('user-agent')
    });

    res.json({
      user: accountResponse(user, userType),
      csrfToken: startSession(res, signSession(tokenPayload, SESSION_TTL_SECONDS))
    });
  })
);

router.get(
  '/me',
  auth,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ user: accountResponse(req.user, req.userType, req.organization) });
  })
);

router.post(
  '/logout',
  auth,
  asyncHandler(async (req: Request, res: Response) => {
    req.user.status = 'offline';
    await req.user.save();
    // The cookie must not survive a sign-out, or the browser keeps presenting a
    // valid credential for a session the user believes they ended.
    endSession(res);
    res.json({ message: 'Logged out successfully' });
  })
);

router.put(
  '/status',
  auth,
  asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.body;
    if (!isPresenceStatus(status)) {
      throw badRequest(`status must be one of: ${PRESENCE_STATUSES.join(', ')}`);
    }
    req.user.status = status;
    await req.user.save();
    res.json({ message: 'Status updated successfully', status: req.user.status });
  })
);

router.delete(
  '/account',
  auth,
  asyncHandler(async (req: Request, res: Response) => {
    // A soft delete: the row stays so conversations keep a sender, but the
    // address is released and the account can no longer sign in.
    req.user.email = `deleted_${Date.now()}@deleted.com`;
    req.user.isActive = false;
    req.user.name = 'Deleted User';
    req.user.status = 'offline';
    await req.user.save();
    res.json({ message: 'Account deleted successfully' });
  })
);

export default router;
