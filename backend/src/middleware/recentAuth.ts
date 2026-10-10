import { forbidden } from '../http/errors';
import { bindSessionForStepUp, verifyRecentAuth } from '../config/tokens';
import type { RecentAuthPurpose } from '../config/tokens';
import type { NextFunction, Request, Response } from 'express';

/** Critical changes require a password/MFA proof bound to this exact session. */
export function requireRecentAuth(purpose: RecentAuthPurpose) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const raw = req.get('x-recent-auth');
      if (!raw) throw new Error('missing proof');
      const proof = verifyRecentAuth(raw);
      const matches =
        proof.purpose === purpose &&
        proof.userId === String(req.user._id) &&
        proof.userType === req.userType &&
        proof.sv === (req.user.sessionVersion ?? 0) &&
        proof.sessionBinding === bindSessionForStepUp(req.token);
      if (!matches) throw new Error('wrong proof');
      next();
    } catch {
      throw forbidden(
        'Sign in again before changing account sign-in methods',
        'RECENT_AUTH_REQUIRED'
      );
    }
  };
}
