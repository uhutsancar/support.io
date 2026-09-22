import express from 'express';
import { sendError } from '../middleware/errors';
import { startSession, endSession, SESSION_TTL_SECONDS } from '../config/session';
import { signSession } from '../config/tokens';
import { passwordProblem, burnVerification, needsRehash } from '../config/passwords';
import { body, validationResult } from 'express-validator';
import User from '../models/User';
import Team from '../models/Team';
import Organization from '../models/Organization';
import { auth } from '../middleware/auth';
import events from '../events';
import Site from '../models/Site';
import type { AuthTokenPayload, AuthenticatedUser } from '../types/auth';
import type { Request, Response } from 'express';

const router = express.Router();
const validateRegistration = [
  body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
  // Politika config/passwords.ts'te: en az 8 karakter, en çok 72 bayt
  // (bcrypt sonrasını sessizce yok sayar).
  body('password').custom((value) => {
    const problem = passwordProblem(value);
    if (problem) throw new Error(problem);
    return true;
  }),
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2-50 characters')
];
const validateLogin = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
];
router.post('/register', validateRegistration, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }
    const { email, password, name } = req.body;
    const existingUser = await User.findOne({ email, isActive: true });
    if (existingUser) {
      return res.status(400).json({ error: 'Bu e-posta adresi zaten kayıtlı' });
    }
    const organization = new Organization({
      name: `${name}'s Organization`,
      planType: 'FREE'
    });
    await organization.save();
    const user = new User({
      email,
      password,
      name,
      role: 'owner',
      organizationId: organization._id
    });
    await user.save();
    organization.ownerUserId = user._id;
    await organization.save();
    const token = signSession(
      { userId: user._id, organizationId: organization._id, role: user.role, userType: 'user' },
      SESSION_TTL_SECONDS
    );
    // isOnboarded burada da donmeli: panel bu alana bakip kullaniciyi kuruluma
    // yonlendiriyor. Eksik oldugunda deger `undefined` kalir, kontrol calismaz
    // ve yeni kullanici once panele girip sonra kuruluma atilir.
    // Token yanıt gövdesinde dönmüyor: panelin onu saklayabileceği bir yer
    // kalmasın diye yalnızca httpOnly çereze yazılıyor. Gövdede dönen csrfToken
    // bir yetki belgesi değil, yalnızca isteğin panelden geldiğinin kanıtı.
    const csrfToken = startSession(res, token);
    res.status(201).json({
      user: {
        id: user._id,
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
        isOnboarded: user.isOnboarded,
        userType: 'user'
      },
      csrfToken
    });
  } catch (error) {
    sendError(res, error, 400);
  }
});
router.post('/login', validateLogin, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid input' });
    }
    const { email, password } = req.body;
    // The account can live in either table, so the variable holds both shapes.
    let user: AuthenticatedUser | null = await User.findOne({ email, isActive: true });
    let userType: 'user' | 'team' = 'user';
    if (!user) {
      user = await Team.findOne({ email, isActive: true });
      userType = 'team';
    }
    if (!user) {
      // Kayıtlı olmayan bir e-posta için de bir bcrypt karşılaştırması
      // yapılır; yanıt süresi hangi e-postaların kayıtlı olduğunu söylemez.
      await burnVerification(password);
      const host = req.get('host');
      let orgId = null;
      try {
        const site = await Site.findOne({ domain: host }).select('organizationId');
        if (site && site.organizationId) orgId = site.organizationId;
      } catch (e) {
      }
      events.emit('auth.login.failure', { organizationId: orgId, userId: null, metadata: { email }, ip: req.ip, ua: req.get('user-agent') });
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const isMatch = await user.comparePassword(password);
    if (isMatch && needsRehash(user.password)) {
      // Eski maliyetle (10) üretilmiş hash, parola elimizdeyken bugünkü
      // maliyete yükseltilir; kullanıcının hiçbir şey yapması gerekmez.
      user.password = password;
    }
    if (!isMatch) {
      events.emit('auth.login.failure', { organizationId: user.organizationId, userId: user._id, metadata: { reason: 'invalid_password' }, ip: req.ip, ua: req.get('user-agent') });
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (!user.organizationId) {
      const newOrg = new Organization({
        name: `${user.name}'s Organization`,
        planType: 'FREE'
      });
      await newOrg.save();
      user.organizationId = newOrg._id;
    }
    const tokenPayload: AuthTokenPayload = { userId: user._id, userType, role: user.role };
    if (user.organizationId) tokenPayload.organizationId = user.organizationId;
    const token = signSession(tokenPayload, SESSION_TTL_SECONDS);
    user.status = 'online';
    await user.save();
    events.emit('auth.login.success', { organizationId: user.organizationId, userId: user._id, metadata: { userType }, ip: req.ip, ua: req.get('user-agent') });
    const csrfToken = startSession(res, token);
    res.json({
      user: {
        id: user._id,
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        organizationId: user.organizationId,
        // Temsilci hesaplarinda kurulum akisi yok; onlar icin daima tamamlanmis sayilir.
        isOnboarded: userType === 'team' ? true : 'isOnboarded' in user ? user.isOnboarded : false,
        userType
      },
      csrfToken
    });
  } catch (error) {
    sendError(res, error, 400);
  }
});
router.get('/me', auth, async (req: Request, res: Response) => {
  res.json({
    user: {
      id: req.user._id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
      avatar: req.user.avatar,
      status: req.user.status,
      // Only a User account carries the onboarding flag; a Team agent is
      // invited into an organization that is already set up.
      isOnboarded: 'isOnboarded' in req.user ? req.user.isOnboarded : undefined,
      organization: req.organization ? {
        id: req.organization._id,
        name: req.organization.name,
        planType: req.organization.planType
      } : null
    }
  });
});
router.post('/logout', auth, async (req: Request, res: Response) => {
  try {
    req.user.status = 'offline';
    await req.user.save();
    // Oturum çerezi tarayıcıda kalmamalı; aksi halde "çıkış yaptım" diyen
    // kullanıcının tarayıcısı yetkili bir çerez taşımaya devam ederdi.
    endSession(res);
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    sendError(res, error);
  }
});
router.put('/status', auth, async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (!['online', 'offline', 'busy', 'away'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    req.user.status = status;
    await req.user.save();
    res.json({ message: 'Status updated successfully', status: req.user.status });
  } catch (error) {
    sendError(res, error);
  }
});
router.delete('/account', auth, async (req: Request, res: Response) => {
  try {
    req.user.email = `deleted_${Date.now()}@deleted.com`;
    req.user.isActive = false;
    req.user.name = 'Deleted User';
    req.user.status = 'offline';
    await req.user.save();
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    sendError(res, error);
  }
});
export default router;