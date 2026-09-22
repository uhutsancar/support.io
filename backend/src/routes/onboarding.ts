import express from 'express';
import { sendError } from '../middleware/errors';
import { auth } from '../middleware/auth';
import User from '../models/User';
import Site from '../models/Site';
import crypto from 'crypto';
import WidgetConfig from '../models/WidgetConfig';
import type { Request, Response } from 'express';

const router = express.Router();
router.post('/', auth, async (req: Request, res: Response) => {
  try {
    const { purpose, websiteUrl, phone, country, welcomeMessage, title, color } = req.body;
    if (req.user.role !== 'owner') {
      return res.status(403).json({ error: 'Only account owners can complete onboarding.' });
    }
    if (req.user.isOnboarded) {
      return res.status(400).json({ error: 'Already onboarded.' });
    }
    const organizationId = req.user.organizationId;
    let domain = 'unknown';
    if (websiteUrl) {
      try {
         const urlStr = websiteUrl.startsWith('http') ? websiteUrl : 'https://' + websiteUrl;
         const parsed = new URL(urlStr);
         domain = parsed.hostname;
      } catch (e) {
         domain = websiteUrl;
      }
    }
    const site = new Site({
      name: websiteUrl || 'My Website',
      domain: domain,
      siteKey: crypto.randomBytes(16).toString('hex'),
      userId: req.user._id,
      organizationId: organizationId,
      widgetSettings: {
        welcomeMessage: welcomeMessage || 'Merhaba! Size nasıl yardımcı olabiliriz? 👋',
        primaryColor: color || '#4F46E5',
        position: 'bottom-right'
      }
    });
    await site.save();
    // Kurulumda seçilen renk, başlık ve karşılama metni modelin gerçek
    // alanlarına yazılır. Eskiden modelde olmayan `theme`/`content` alanlarına
    // yazılıyordu; ORM onları yok sayıyor, config varsayılan renkle
    // oluşuyordu ve publicConfig sitenin rengine hiç düşmediği için
    // kullanıcının seçimi widget'a asla yansımıyordu.
    const primary = typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color) ? color : '#4F46E5';
    const widgetConfig = new WidgetConfig({
      siteId: site._id,
      organizationId: organizationId,
      colors: { primary, header: primary, visitorMessageBg: primary },
      branding: { brandName: typeof title === 'string' && title.trim() ? title.trim().slice(0, 60) : 'Destek Ekibi' },
      messages: {
        welcomeMessage: typeof welcomeMessage === 'string' && welcomeMessage.trim()
          ? welcomeMessage.trim().slice(0, 500)
          : 'Merhaba! Size nasıl yardımcı olabiliriz? 👋',
        placeholderText: 'Mesajınızı buraya yazın...'
      }
    });
    await widgetConfig.save();
    req.user.isOnboarded = true;
    await req.user.save();
    res.status(200).json({ message: 'Onboarding completed successfully', site });
  } catch (error) {
    sendError(res, error);
  }
});
export default router;