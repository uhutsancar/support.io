'use strict';

// Widget'in public API'si.
//
// Bu rotalar musteri sitesinden, tarayicidan, oturum acmadan cagrilir. Tek
// kimlik dogrulama site anahtaridir; bu yuzden buradan donen hicbir alan
// organizasyon ici bilgi icermemelidir (id'ler, e-postalar, plan, ic ayarlar).
// Asagidaki `publicConfig` fonksiyonu bunun tek gecis noktasidir.

import express from 'express';
import { plainString } from '../middleware/sanitize';
import { asyncHandler, badRequest, notFound } from '../http';
import Site from '../models/Site';
import WidgetConfig from '../models/WidgetConfig';
import FAQ from '../models/FAQ';
import Team from '../models/Team';
import User from '../models/User';
import { isProduction } from '../config/env';
import { open } from '../config/secretBox';
import { userHashFor } from '../services/identity';
import { DEMO_CUSTOMER, DEMO_SITE_KEY } from '../db/demo';
import type { Request, Response } from 'express';
import type { Doc } from '../db/model';
import type { SiteDoc } from '../models/Site';
import type { SiteWidgetSettings } from '../domain';

const router = express.Router();

// SDK surumu. Widget calisma zamani kendi surumunu gonderir; uyusmazlik
// panelde "eski surum" uyarisi gostermeyi mumkun kilar.
const WIDGET_VERSION = '3.0.0';
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
    enableNotifications: true
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
// GET /api/widget/bootstrap?siteKey=...
//
// Widget'in acilista ihtiyac duydugu HER SEY tek yanitta doner. Eski widget uc
// ayri istek atiyordu (config + settings + faqs); ucu de ayri gecikme ekliyor,
// ikisi de ayni siteyi yeniden okuyordu.
// ---------------------------------------------------------------------------
router.get(
  '/bootstrap',
  asyncHandler(async (req: Request, res: Response) => {
    const siteKey = String(req.query.siteKey || '').trim();
    if (!siteKey) throw badRequest('siteKey is required');

    const site = await Site.findOne({ siteKey, isActive: true });
    // An invalid key and a disabled site answer identically, so probing keys
    // cannot reveal "this site exists but is switched off".
    if (!site) throw notFound('Widget');

    const [saved, faqs, availability] = await Promise.all([
      WidgetConfig.findOne({ siteId: site._id, isActive: true }),
      FAQ.find({ siteId: site._id, isActive: true }).sort({ order: 1 }).limit(50).lean(),
      resolveAvailability(site)
    ]);

    res.set('Cache-Control', 'public, max-age=30');
    res.json({
      version: WIDGET_VERSION,
      apiVersion: API_VERSION,
      serverTime: new Date().toISOString(),
      site: { name: site.name, key: site.siteKey },
      availability,
      config: publicConfig(site, saved ? saved.toObject() : null),
      faqs: (faqs || []).map((f) => ({
        id: String(f._id),
        question: f.question,
        answer: f.answer,
        category: f.category || null
      }))
    });
  })
);

// ---------------------------------------------------------------------------
// POST /api/widget/installed
//
// Kurulum dogrulamasi. Widget bir sayfada ilk kez calistiginda bir kez cagirir.
// Yalnizca site anahtari + sayfanin origin'i kaydedilir; ziyaretciye ait
// hicbir kimlik bilgisi burada tutulmaz.
// ---------------------------------------------------------------------------
router.post(
  '/installed',
  asyncHandler(async (req: Request, res: Response) => {
    const { url, sdkVersion } = req.body || {};
    const siteKey = plainString(req.body?.siteKey, 128);
    if (!siteKey) throw badRequest('siteKey is required');

    const site = await Site.findOne({ siteKey, isActive: true });
    if (!site) throw notFound('Widget');

    const now = new Date().toISOString();
    const previous = site.installation || {};
    site.installation = {
      ...previous,
      // Ilk dogrulama zamani korunur: "ne zaman kuruldu" bilgisi her
      // heartbeat'te sifirlanmamali.
      verifiedAt: previous.verifiedAt || now,
      lastSeenAt: now,
      origin: safeUrlPart(url, 'origin'),
      // Tam URL yerine yalnizca yol saklanir; query string kisisel veri
      // tasiyabilir.
      path: safeUrlPart(url, 'pathname'),
      sdkVersion: typeof sdkVersion === 'string' ? sdkVersion.slice(0, 20) : null
    };
    await site.save();

    res.json({ ok: true, verifiedAt: site.installation.verifiedAt });
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
      if (siteKey !== DEMO_SITE_KEY) throw notFound('Widget');
      const site = await Site.findOne({ siteKey, isActive: true });
      const secret = open(site?.integrations?.identitySecret);
      if (!secret) throw notFound('Widget');
      res.json({ ...DEMO_CUSTOMER, userHash: userHashFor(secret, DEMO_CUSTOMER.userId) });
    })
  );
}

// ---------------------------------------------------------------------------
// Geriye donuk uyumluluk: eski widget surumleri /api/widget/settings cagirir.
// ---------------------------------------------------------------------------
router.get(
  '/settings',
  asyncHandler(async (req: Request, res: Response) => {
    const siteKey = plainString(req.query.siteKey, 128);
    if (!siteKey) throw badRequest('siteKey is required');
    const site = await Site.findOne({ siteKey, isActive: true });
    if (!site) throw notFound('Widget');
    const saved = await WidgetConfig.findOne({ siteId: site._id, isActive: true });
    res.json({
      site: { name: site.name, isActive: site.isActive, widgetSettings: site.widgetSettings },
      config: publicConfig(site, saved ? saved.toObject() : null)
    });
  })
);

export { WIDGET_VERSION, publicConfig };
export default router;
