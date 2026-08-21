'use strict';

// Widget'in public API'si.
//
// Bu rotalar musteri sitesinden, tarayicidan, oturum acmadan cagrilir. Tek
// kimlik dogrulama site anahtaridir; bu yuzden buradan donen hicbir alan
// organizasyon ici bilgi icermemelidir (id'ler, e-postalar, plan, ic ayarlar).
// Asagidaki `publicConfig` fonksiyonu bunun tek gecis noktasidir.

const express = require('express');
const router = express.Router();
const Site = require('../models/Site');
const WidgetConfig = require('../models/WidgetConfig');
const FAQ = require('../models/FAQ');
const Team = require('../models/Team');
const User = require('../models/User');

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
  branding: { logo: null, logoWidth: 40, logoHeight: 40, brandName: 'Support', showBrandName: true },
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
  window: { width: 400, height: 640, borderRadius: 16, headerHeight: 64, showHeader: true, showCloseButton: true },
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

function merge(base, override) {
  const out = {};
  for (const key of Object.keys(base)) {
    const value = override && override[key];
    out[key] = value === undefined || value === null ? base[key] : value;
  }
  return out;
}

// Kaydedilmis config'i, widget'in anlayacagi ve HICBIR ic alan tasimayan bir
// nesneye indirger. Beyaz liste yaklasimi: modele yeni bir alan eklendiginde
// kazara public olmaz.
function publicConfig(site, saved) {
  const cfg = saved || {};
  const ws = site.widgetSettings || {};

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
  if (!(cfg.branding && cfg.branding.brandName)) branding.brandName = site.name || DEFAULTS.branding.brandName;

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
async function resolveAvailability(site) {
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

function safeUrlPart(url, part) {
  try {
    return url ? new URL(url)[part] : null;
  } catch (e) {
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
router.get('/bootstrap', async (req, res) => {
  try {
    const siteKey = String(req.query.siteKey || '').trim();
    if (!siteKey) {
      return res.status(400).json({ error: 'siteKey is required', code: 'VALIDATION_ERROR' });
    }

    const site = await Site.findOne({ siteKey, isActive: true });
    if (!site) {
      // Gecersiz anahtar ile pasif site ayni yaniti alir: anahtar denemesiyle
      // "bu site var ama kapali" bilgisi cikarilamaz.
      return res.status(404).json({ error: 'Widget not found', code: 'WIDGET_NOT_FOUND' });
    }

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
  } catch (error) {
    res.status(500).json({ error: error.message, code: 'INTERNAL_ERROR' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/widget/installed
//
// Kurulum dogrulamasi. Widget bir sayfada ilk kez calistiginda bir kez cagirir.
// Yalnizca site anahtari + sayfanin origin'i kaydedilir; ziyaretciye ait
// hicbir kimlik bilgisi burada tutulmaz.
// ---------------------------------------------------------------------------
router.post('/installed', async (req, res) => {
  try {
    const { siteKey, url, sdkVersion } = req.body || {};
    if (!siteKey) {
      return res.status(400).json({ error: 'siteKey is required', code: 'VALIDATION_ERROR' });
    }

    const site = await Site.findOne({ siteKey, isActive: true });
    if (!site) {
      return res.status(404).json({ error: 'Widget not found', code: 'WIDGET_NOT_FOUND' });
    }

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
  } catch (error) {
    res.status(500).json({ error: error.message, code: 'INTERNAL_ERROR' });
  }
});

// ---------------------------------------------------------------------------
// Geriye donuk uyumluluk: eski widget surumleri /api/widget/settings cagirir.
// ---------------------------------------------------------------------------
router.get('/settings', async (req, res) => {
  try {
    const { siteKey } = req.query;
    if (!siteKey) {
      return res.status(400).json({ error: 'siteKey is required', code: 'VALIDATION_ERROR' });
    }
    const site = await Site.findOne({ siteKey, isActive: true });
    if (!site) {
      return res.status(404).json({ error: 'Site not found or inactive', code: 'WIDGET_NOT_FOUND' });
    }
    const saved = await WidgetConfig.findOne({ siteId: site._id, isActive: true });
    res.json({
      site: { name: site.name, isActive: site.isActive, widgetSettings: site.widgetSettings },
      config: publicConfig(site, saved ? saved.toObject() : null)
    });
  } catch (error) {
    res.status(500).json({ error: error.message, code: 'INTERNAL_ERROR' });
  }
});

module.exports = router;
module.exports.WIDGET_VERSION = WIDGET_VERSION;
module.exports.publicConfig = publicConfig;
