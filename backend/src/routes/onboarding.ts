// First-run setup: the owner names their website and picks the widget's look,
// and we create the site plus its widget configuration in one step.

import express from 'express';
import crypto from 'crypto';
import Site from '../models/Site';
import WidgetConfig from '../models/WidgetConfig';
import { auth } from '../middleware/auth';
import { asyncHandler, conflict, forbidden, orgId, requireOrganization } from '../http';
import type { Request, Response } from 'express';

const router = express.Router();

const DEFAULT_PRIMARY_COLOR = '#4F46E5';
const DEFAULT_WELCOME = 'Merhaba! Size nasıl yardımcı olabiliriz? 👋';
const DEFAULT_BRAND_NAME = 'Destek Ekibi';
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** The hostname behind whatever the user typed, or the raw text if it is not a URL. */
function hostnameOf(websiteUrl: unknown): string {
  if (typeof websiteUrl !== 'string' || !websiteUrl.trim()) return 'unknown';
  try {
    const withScheme = websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`;
    return new URL(withScheme).hostname;
  } catch {
    // Not parseable as a URL — keep what they typed rather than losing it.
    return websiteUrl;
  }
}

/** A trimmed, length-capped string, or the fallback when there is nothing usable. */
function text(value: unknown, maxLength: number, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, maxLength) : fallback;
}

router.post(
  '/',
  auth,
  requireOrganization,
  asyncHandler(async (req: Request, res: Response) => {
    const { websiteUrl, welcomeMessage, title, color } = req.body;

    if (req.user.role !== 'owner') {
      throw forbidden('Only account owners can complete onboarding.');
    }
    if (req.user.isOnboarded) {
      throw conflict('Already onboarded.');
    }

    const organizationId = orgId(req);
    const primary =
      typeof color === 'string' && HEX_COLOR.test(color) ? color : DEFAULT_PRIMARY_COLOR;
    const welcome = text(welcomeMessage, 500, DEFAULT_WELCOME);

    const site = new Site({
      name: websiteUrl || 'My Website',
      domain: hostnameOf(websiteUrl),
      siteKey: crypto.randomBytes(16).toString('hex'),
      userId: req.user._id,
      organizationId,
      widgetSettings: {
        welcomeMessage: welcome,
        primaryColor: primary,
        position: 'bottom-right'
      }
    });
    await site.save();

    // The colour, title and welcome text are written to the widget config's real
    // fields. An earlier version wrote them to `theme` and `content`, which the
    // model does not declare: the ORM dropped them, the config was created with
    // default colours, and the user's choice never reached the widget at all.
    const widgetConfig = new WidgetConfig({
      siteId: site._id,
      organizationId,
      colors: { primary, header: primary, visitorMessageBg: primary },
      branding: { brandName: text(title, 60, DEFAULT_BRAND_NAME) },
      messages: { welcomeMessage: welcome, placeholderText: 'Mesajınızı buraya yazın...' }
    });
    await widgetConfig.save();

    req.user.isOnboarded = true;
    await req.user.save();

    res.status(200).json({ message: 'Onboarding completed successfully', site });
  })
);

export default router;
