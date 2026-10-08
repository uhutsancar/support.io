'use strict';

// Widget'in public API'si.
//
// Bu rotalar musteri sitesinden, tarayicidan, hesap oturumu olmadan cagrilir.
// Akis:
//
//   POST /session   site anahtari + (varsa) onceki token -> imzali widget
//                   oturumu, sunucunun urettigi visitorId ve widget'in
//                   acilista ihtiyac duydugu her sey (config, SSS, durum)
//   diger uclar     yalnizca o token ile (middleware/widgetSession.ts)
//
// Site anahtari tek basina yetki DEGILDIR: sayfa kaynaginda durur. Oturum
// yalnizca sitenin izinli origin'lerinden birindeki sayfaya verilir.
//
// Buradan donen hicbir alan organizasyon ici bilgi icermemelidir (id'ler,
// e-postalar, plan, ic ayarlar). `publicConfig` bunun tek gecis noktasidir.

import express from 'express';
import { plainString } from '../middleware/sanitize';
import { asyncHandler, badRequest, notFound } from '../http';
import Site from '../models/Site';
import WidgetConfig from '../models/WidgetConfig';
import Team from '../models/Team';
import User from '../models/User';
import { isProduction } from '../config/env';
import { open } from '../config/secretBox';
import {
  newVisitorId,
  newWidgetSessionId,
  renewableWidgetSession,
  signWidgetSession,
  siteKeyMatches,
  siteKeyVersion,
  verifyVisitorLink
} from '../config/tokens';
import Conversation from '../models/Conversation';
import { chatSettings, publicChatSettings } from '../services/chatSettings';
import { recordRating } from '../services/ratings';
import { sendActivation } from '../services/activation';
import { createLimiter } from '../middleware/rateLimit';
import { HttpError } from '../http';
import { requestOrigin, siteAcceptsOrigin } from '../config/siteOrigins';
import { originRefused, requireWidgetSession } from '../middleware/widgetSession';
import { widgetSessionLimiter } from '../middleware/rateLimit';
import { organizationVerified } from '../services/verification';
import { forbidden } from '../http';
import { userHashFor } from '../services/identity';
import { DEMO_CUSTOMER, DEMO_SITE_KEY } from '../db/demo';
import { assistantActiveFor } from '../services/assistant';
import { visitorCountry } from '../services/assistant/region';
import { isBlocked, VISITOR_BLOCKED } from '../services/visitorBlocks';
import { siteBundle } from '../services/widgetBundle';
import Visitor from '../models/Visitor';
import { ACTIVE_CONVERSATION_STATUSES } from '../domain';
import { ioFrom, siteRoom } from '../realtime';
import type { Request, Response } from 'express';
import type { Doc } from '../db/model';
import type { SiteDoc } from '../models/Site';
import type { SiteWidgetSettings } from '../domain';

const router = express.Router();

// Widget ve dokumantasyon bu kodu bekler; genel NOT_FOUND'u degil.
const widgetNotFound = () => notFound('Widget', 'WIDGET_NOT_FOUND');

// SDK surumu. Widget calisma zamani kendi surumunu gonderir; uyusmazlik
// panelde "eski surum" uyarisi gostermeyi mumkun kilar.
const WIDGET_VERSION = '4.0.0';
const API_VERSION = '1';

const DEFAULTS = {
  colors: {
    primary: '#4F46E5',
    header: '#4F46E5',
    background: '#FFFFFF',
    text: '#111827',
    textSecondary: '#6B7280',
    border: '#E5E7EB',
    visitorMessageBg: '#4F46E5',
    agentMessageBg: '#F3F4F6'
  },
  branding: {
    logo: null,
    logoWidth: 40,
    logoHeight: 40,
    brandName: 'Support',
    showBrandName: true
  },
  button: {
    position: 'bottom-right',
    size: 'medium',
    icon: 'message-circle',
    showLabel: false,
    labelText: '',
    borderRadius: 50,
    shadow: true,
    shadowColor: 'rgba(0,0,0,0.15)'
  },
  window: {
    width: 400,
    height: 640,
    borderRadius: 16,
    headerHeight: 64,
    showHeader: true,
    showCloseButton: true
  },
  messages: {
    welcomeMessage: '',
    placeholderText: '',
    showTimestamps: true,
    showAvatars: true,
    messageBubbleRadius: 14
  },
  behavior: {
    autoOpen: false,
    autoOpenDelay: 5000,
    showOnPages: [],
    hideOnPages: [],
    showUnreadBadge: true,
    enableSound: true,
    enableNotifications: true,
    titleAlert: true,
    hideOnMobile: false
  },
  typography: { fontFamily: '', fontSize: 'medium', fontWeight: 'normal' },
  advanced: { customCSS: null, zIndex: 2147483000, animationSpeed: 'normal' }
};

// Fills each declared key from the override when it has a real value, and from
// the default otherwise. The result keeps the default's shape, which is what
// makes the whitelist below meaningful.
function merge<TShape extends Record<string, any>>(
  base: TShape,
  override: Partial<TShape> | null | undefined
): TShape {
  const out = {} as TShape;
  for (const key of Object.keys(base) as Array<keyof TShape>) {
    const value = override && override[key];
    out[key] = value === undefined || value === null ? base[key] : (value as TShape[keyof TShape]);
  }
  return out;
}

// Kaydedilmis config'i, widget'in anlayacagi ve HICBIR ic alan tasimayan bir
// nesneye indirger. Beyaz liste yaklasimi: modele yeni bir alan eklendiginde
// kazara public olmaz.
function publicConfig(site: Doc<SiteDoc> | SiteDoc, saved: Record<string, any> | null | undefined) {
  const cfg: Record<string, any> = saved || {};
  const ws: Partial<SiteWidgetSettings> = site.widgetSettings || {};

  const messages = merge(DEFAULTS.messages, cfg.messages);
  // Karsilama mesaji iki yerde tutulabiliyor (site ayarlari ve widget config).
  // Widget config bossa site ayarina dusulur, o da bossa widget kendi
  // yerellestirilmis varsayilanini kullanir.
  if (!messages.welcomeMessage) messages.welcomeMessage = ws.welcomeMessage || '';
  if (!messages.placeholderText) messages.placeholderText = ws.placeholderText || '';

  const button = merge(DEFAULTS.button, cfg.button);
  if (!(cfg.button && cfg.button.position) && ws.position) button.position = ws.position;

  const colors = merge(DEFAULTS.colors, cfg.colors);
  if (!(cfg.colors && cfg.colors.primary) && ws.primaryColor) {
    colors.primary = ws.primaryColor;
    if (!(cfg.colors && cfg.colors.header)) colors.header = ws.primaryColor;
    if (!(cfg.colors && cfg.colors.visitorMessageBg)) colors.visitorMessageBg = ws.primaryColor;
  }

  const behavior = merge(DEFAULTS.behavior, cfg.behavior);
  if (!(cfg.behavior && cfg.behavior.autoOpen !== undefined) && ws.autoOpen !== undefined) {
    behavior.autoOpen = ws.autoOpen;
    behavior.autoOpenDelay = ws.autoOpenDelay || behavior.autoOpenDelay;
  }

  const branding = merge(DEFAULTS.branding, cfg.branding);
  if (!(cfg.branding && cfg.branding.brandName))
    branding.brandName = site.name || DEFAULTS.branding.brandName;

  return {
    colors,
    branding,
    button,
    window: merge(DEFAULTS.window, cfg.window),
    messages,
    behavior,
    typography: merge(DEFAULTS.typography, cfg.typography),
    advanced: merge(DEFAULTS.advanced, cfg.advanced)
  };
}

// Ziyaretciye "biri var mi" sorusunun gercek cevabi. Sahte bir "Online"
// gostermek, yanit alamayan ziyaretciyi bekletmekten daha kotudur.
async function resolveAvailability(
  site: Doc<SiteDoc> | SiteDoc
): Promise<'online' | 'away' | 'offline'> {
  const orgId = site.organizationId;
  if (!orgId) return 'offline';

  const [teamOnline, userOnline, teamAway, userAway] = await Promise.all([
    Team.countDocuments({ organizationId: orgId, isActive: true, status: 'online' }),
    User.countDocuments({ organizationId: orgId, isActive: true, status: 'online' }),
    Team.countDocuments({ organizationId: orgId, isActive: true, status: 'away' }),
    User.countDocuments({ organizationId: orgId, isActive: true, status: 'away' })
  ]);

  if (teamOnline + userOnline > 0) return 'online';
  if (teamAway + userAway > 0) return 'away';
  return 'offline';
}

function safeUrlPart(
  url: unknown,
  part: 'origin' | 'pathname' | 'host' | 'hostname'
): string | null {
  try {
    return url ? new URL(String(url))[part] : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// POST /api/widget/session   { siteKey, token? }
//
// Widget'in acilista ihtiyac duydugu HER SEY tek yanitta doner: imzali oturum
// ve eskiden GET /bootstrap'in dondurdugu config + SSS + musaitlik.
//
// Gecerli (ya da yenileme penceresi icinde suresi dolmus) bir token
// gonderilirse ayni ziyaretci devam eder; aksi halde sunucu yeni bir visitorId
// uretir. Istemcinin onerdigi bir visitorId yoktur.
// ---------------------------------------------------------------------------
router.post(
  '/session',
  widgetSessionLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const siteKey = plainString(req.body?.siteKey, 128);
    if (!siteKey) throw badRequest('siteKey is required');

    const site = await Site.findOne({ siteKey, isActive: true });
    // An invalid key, a disabled site and a site over the plan's limit after
    // a downgrade (BIL-04) answer identically, so probing keys cannot reveal
    // "this site exists but is switched off".
    if (!site || site.suspendedAt || site.blockedAt) throw widgetNotFound();

    // The widget goes live once the organization's owner has verified their
    // address (plan §7.2); until then the panel works but no page does.
    if (!(await organizationVerified(site.organizationId))) {
      throw forbidden(
        'The account behind this site has not verified its e-mail',
        'ACCOUNT_NOT_VERIFIED'
      );
    }

    // A session is the one thing that must come from a page on the site: a
    // browser always sends Origin on this POST, so a missing one is refused.
    const origin = requestOrigin(req.headers);
    if (!origin || !siteAcceptsOrigin(site, origin)) throw originRefused();

    const keyVersion = siteKeyVersion(site.siteKey);
    const previous = renewableWidgetSession(req.body?.token);
    const continues =
      previous !== null &&
      previous.siteId === String(site._id) &&
      siteKeyMatches(site.siteKey, previous.kv);
    // The link in a reply mail (PRD-01) brings the visitor back to their
    // conversation, even from another browser: it names the visitor, signed.
    const resumed = verifyVisitorLink('resume', req.body?.resumeToken);
    const resumesHere = resumed !== null && resumed.siteId === String(site._id);

    const visitorId = resumesHere
      ? resumed.visitorId
      : continues
        ? previous.visitorId
        : newVisitorId();

    // A blocked visitor (SEC-09) gets no session — by their id, or by their
    // address when the browser forgot the id. The look of the widget comes
    // along, so it can still draw its bubble and say, politely, that the
    // chat is not available.
    if (await isBlocked({ siteId: String(site._id), visitorId, ip: req.ip })) {
      const saved = await WidgetConfig.findOne({ siteId: site._id, isActive: true });
      throw new HttpError(403, 'Chat is not available', VISITOR_BLOCKED, {
        config: publicConfig(site, saved ? saved.toObject() : null)
      });
    }

    const { token, expiresAt } = signWidgetSession({
      siteId: String(site._id),
      visitorId,
      sid: continues && !resumesHere ? previous.sid : newWidgetSessionId(),
      kv: keyVersion
    });

    // The look, the FAQ list and the plan's branding change only when the
    // owner edits them: kept for a minute in the shared cache (PERF-04).
    const [bundle, availability, openConversation] = await Promise.all([
      siteBundle(String(site._id), String(site.organizationId)),
      resolveAvailability(site),
      // A returning visitor with a conversation still open connects at once,
      // so a reply reaches them; everyone else only when they open the
      // widget (PERF-02).
      continues || resumesHere
        ? Conversation.findOne({
            siteId: site._id,
            visitorId,
            status: { $in: [...ACTIVE_CONVERSATION_STATUSES] }
          })
        : Promise.resolve(null)
    ]);

    res.json({
      token,
      // The free plan's widget shows "Powered by Support.io".
      branding: bundle.branding,
      expiresAt: expiresAt.toISOString(),
      visitorId,
      renewed: continues,
      resumed: resumesHere,
      conversationOpen: Boolean(openConversation),
      version: WIDGET_VERSION,
      apiVersion: API_VERSION,
      serverTime: new Date().toISOString(),
      site: { name: site.name, key: site.siteKey },
      availability,
      // True when the site's FAQ assistant answers first; the widget then says
      // so and offers a way to a person. Nothing else about it is public.
      assistant: assistantActiveFor(site, visitorCountry(req.get('cf-ipcountry'))),
      config: publicConfig(site, bundle.saved),
      // Forms and ratings (services/chatSettings.ts): what the widget shows,
      // nothing about who on the team gets mailed.
      chat: publicChatSettings(chatSettings(site.chatSettings)),
      faqs: bundle.faqs
    });
  })
);

// ---------------------------------------------------------------------------
// POST /api/widget/installed
//
// Kurulum dogrulamasi. Widget her sayfa acilisinda bir kez cagirir; panel
// "Kurulu degil / Bagli / Son gorulme" durumunu buradan okur. Yalnizca
// sayfanin origin'i ve yolu kaydedilir; ziyaretciye ait hicbir kimlik bilgisi
// burada tutulmaz.
// ---------------------------------------------------------------------------
router.post(
  '/installed',
  requireWidgetSession,
  asyncHandler(async (req: Request, res: Response) => {
    const { url, sdkVersion } = req.body || {};
    const site = req.site;

    const now = new Date().toISOString();
    const previous = site.installation || {};
    site.installation = {
      ...previous,
      // Ilk dogrulama zamani korunur: "ne zaman kuruldu" bilgisi her
      // heartbeat'te sifirlanmamali.
      verifiedAt: previous.verifiedAt || now,
      lastSeenAt: now,
      // The origin the request actually came from (already checked against the
      // site's list), not the one the body claims.
      origin: requestOrigin(req.headers) ?? safeUrlPart(url, 'origin'),
      // Tam URL yerine yalnizca yol saklanir; query string kisisel veri
      // tasiyabilir.
      path: safeUrlPart(url, 'pathname'),
      sdkVersion: typeof sdkVersion === 'string' ? sdkVersion.slice(0, 20) : null
    };
    await site.save();
    // The first sight of the widget on any page: tell the owner it is live.
    if (!previous.verifiedAt) {
      void sendActivation(String(site.organizationId), 'widget_live').catch(() => undefined);
    }

    res.json({ ok: true, verifiedAt: site.installation.verifiedAt });
  })
);

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// POST /api/widget/presence   { currentPage, browser?, os?, referrer?, language? }
//
// The widget opens its socket only when the visitor opens it or has a
// conversation going (PERF-02). Until then this keeps the panel's live
// visitor list right: one small request when a page loads or changes, and
// one every few minutes while the page is visible. It upserts the same
// visitor record the socket join writes and tells the panel.
// ---------------------------------------------------------------------------
const bounded = (value: unknown, max: number): string | null =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;

router.post(
  '/presence',
  requireWidgetSession,
  asyncHandler(async (req: Request, res: Response) => {
    const site = req.site;
    const body = (req.body || {}) as Record<string, unknown>;
    const visitor = await Visitor.findOneAndUpdate(
      { visitorId: req.widget.visitorId, siteId: site._id },
      {
        organizationId: site.organizationId,
        ip: req.ip ?? null,
        browser: bounded(body.browser, 100),
        os: bounded(body.os, 100),
        currentPage: bounded(body.currentPage, 2048) ?? '/',
        referrer: bounded(body.referrer, 2048),
        isActive: true,
        lastActiveAt: new Date()
      },
      { new: true, upsert: true }
    );
    ioFrom(req)?.of('/admin').to(siteRoom(site._id)).emit('visitor-updated', visitor);
    res.status(204).end();
  })
);

// Links mailed to a visitor (plan v10 PRD-01, PRD-04). No session: the
// signed token in the link is the proof, and it names one conversation.
// ---------------------------------------------------------------------------

const linkLimiter = createLimiter({
  name: 'visitor-link',
  code: 'TOO_MANY_REQUESTS',
  message: 'Too many requests, please slow down.',
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.VISITOR_LINK_RATE_MAX) || 60
});

const page = (title: string, body: string) => `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${title}</title></head>
<body style="margin:0;padding:48px 16px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f6f7f9;color:#111827">
<main style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:28px">
<h1 style="font-size:20px;margin:0 0 12px">${title}</h1><p style="margin:0;line-height:1.5">${body}</p></main></body></html>`;

// One click from the reply mail: no more e-mails about this conversation.
router.get(
  '/email-optout',
  linkLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const claims = verifyVisitorLink('email-optout', req.query.t);
    res.set('Cache-Control', 'no-store');
    if (!claims) {
      res
        .status(400)
        .type('html')
        .send(
          page(
            'Bağlantı geçersiz / Invalid link',
            'Bu bağlantı geçersiz ya da süresi dolmuş. / This link is invalid or has expired.'
          )
        );
      return;
    }
    await Conversation.updateOne(
      { _id: claims.conversationId, siteId: claims.siteId, visitorId: claims.visitorId },
      { $set: { emailRepliesOptOut: true } }
    );
    res
      .type('html')
      .send(
        page(
          'E-postalar durduruldu / E-mails stopped',
          'Bu sohbetle ilgili size artık e-posta gönderilmeyecek. / You will get no more e-mails about this chat.'
        )
      );
  })
);

// The rating page the CSAT mail opens (panel /rate) reads and writes here.
router.get(
  '/rating',
  linkLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const claims = verifyVisitorLink('csat', req.query.t);
    if (!claims) throw new HttpError(400, 'This link is invalid or has expired', 'INVALID_TOKEN');
    const [site, conversation] = await Promise.all([
      Site.findById(claims.siteId).select('name chatSettings'),
      Conversation.findOne({ _id: claims.conversationId, siteId: claims.siteId })
    ]);
    if (!site || !conversation) {
      throw new HttpError(400, 'This link is invalid or has expired', 'INVALID_TOKEN');
    }
    res.set('Cache-Control', 'no-store').json({
      site: site.name,
      style: chatSettings(site.chatSettings).csat.style,
      rated: Boolean(conversation.rating?.score)
    });
  })
);

router.post(
  '/rating',
  linkLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const claims = verifyVisitorLink('csat', req.body?.t);
    if (!claims) throw new HttpError(400, 'This link is invalid or has expired', 'INVALID_TOKEN');
    const rating = await recordRating(req.app.get('io'), {
      conversationId: claims.conversationId,
      siteId: claims.siteId,
      visitorId: claims.visitorId,
      score: req.body?.score,
      feedback: req.body?.feedback,
      channel: 'email'
    });
    res.json({ rating });
  })
);

// ---------------------------------------------------------------------------
// GET /api/widget/demo-identity?siteKey=...  (yalnizca gelistirmede)
//
// Demo sayfasinin "Demo musteri olarak giris yap" dugmesi. Gercek bir magazada
// userHash'i magazanin kendi sunucusu uretir; demo magazanin sunucusu olmadigi
// icin bu uc onun yerine gecer. Uretimde hic baglanmaz ve yalnizca tohum
// kiracisinin sitesi icin cevap verir.
// ---------------------------------------------------------------------------
if (!isProduction) {
  router.get(
    '/demo-identity',
    asyncHandler(async (req: Request, res: Response) => {
      const siteKey = plainString(req.query.siteKey, 128);
      if (siteKey !== DEMO_SITE_KEY) throw widgetNotFound();
      const site = await Site.findOne({ siteKey, isActive: true });
      const secret = open(site?.integrations?.identitySecret);
      if (!secret) throw widgetNotFound();
      res.json({ ...DEMO_CUSTOMER, userHash: userHashFor(secret, DEMO_CUSTOMER.userId) });
    })
  );
}

export { WIDGET_VERSION, publicConfig };
export default router;
