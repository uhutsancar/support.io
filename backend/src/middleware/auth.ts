import User from '../models/User';
import Team from '../models/Team';
import Organization from '../models/Organization';
import { readToken, csrfOk } from '../config/session';
import { verifySession } from '../config/tokens';
import { forbidden, unauthorized } from '../http/errors';
import { HttpError } from '../http/errors';
import type { AuthenticatedUser } from '../types/auth';
import type { NextFunction, Request, Response } from 'express';

/**
 * Establishes who is calling.
 *
 * Any failure here answers the same way — 401, no detail — so a caller cannot
 * learn from the response whether a token was malformed, expired, or simply
 * belonged to a deactivated account. The two exceptions carry their own status
 * because they describe a request that was understood and refused rather than
 * one that could not be identified.
 */
const auth = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    // Token httpOnly çerezden okunur; Authorization başlığı tarayıcı dışı
    // istemciler için durur. Ayrıntı ve CSRF gerekçesi: config/session.ts
    const { token, fromCookie } = readToken(req);
    if (!token) throw unauthorized();
    if (!csrfOk(req, fromCookie)) {
      throw forbidden('CSRF token missing or invalid', 'CSRF_FAILED');
    }
    // Amaç (aud), algoritma, süre ve userId birlikte doğrulanır. Ayrıntı ve
    // bu kontrolün neden şart olduğu: config/tokens.ts
    const decoded = verifySession(token);
    let user: AuthenticatedUser | null;
    if (decoded.userType === 'team') {
      user = await Team.findOne({ _id: decoded.userId, isActive: true });
    } else {
      user = await User.findOne({ _id: decoded.userId, isActive: true });
    }
    if (!user) throw unauthorized();
    // Kimlik doğrulama burada biter; kiracılığı değiştirmek bu katmanın işi
    // değil. Eskiden organizasyonu olmayan bir hesap her istekte, atandığı
    // ilk sitenin şirketine sessizce katılıyor (o liste doğrulanmıyordu, yani
    // yabancı bir site kimliği başka bir şirkete üyelik demekti) ya da ona
    // yeni bir şirket açılıyordu — hatalar boş bir catch'te yutularak.
    // Organizasyonsuz bir hesap artık olduğu gibi geçer; kiracıya bağlı her
    // rota requireOrgId ile onu reddeder. Kayıt ve giriş hâlâ eksik
    // organizasyonu oluşturur.
    // Organizasyon veritabanından gelir, token'dan değil. Token'daki iddia
    // önce okunuyordu: şirketten çıkarılan (organizationId'si boşaltılan) bir
    // kullanıcının elindeki token, süresi dolana kadar o şirkete erişmeye
    // devam ediyordu, çünkü karşılaştırma boş organizationId'de atlanıyordu.
    // Token bugün başka bir şirket iddia ediyorsa oturum geçersizdir.
    const orgId = user.organizationId ? String(user.organizationId) : null;
    if (decoded.organizationId && String(decoded.organizationId) !== orgId) {
      throw unauthorized();
    }
    let organization = null;
    if (orgId) {
      organization = await Organization.findOne({ _id: orgId, isActive: true });
      if (!organization) {
        throw forbidden('Organization not found or inactive', 'ORGANIZATION_INACTIVE');
      }
    }
    req.user = user;
    req.userId = user._id;
    req.userType = decoded.userType || 'user';
    req.organization = organization;
    req.token = token;
    req.tokenPayload = decoded;
    next();
  } catch (error) {
    // A deliberate refusal keeps its own status; anything else — a bad
    // signature, an expired token, a malformed claim — is indistinguishable
    // from the outside, on purpose.
    next(error instanceof HttpError ? error : unauthorized());
  }
};
// Rol kontrolleri middleware/rbac.ts (checkPermission) üzerinden yapılır.
export { auth };
