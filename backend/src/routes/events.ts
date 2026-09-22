import express from 'express';
import { getEngine as getProactiveEngine } from '../services/proactiveEngine';
import Site from '../models/Site';
import type { Request, Response } from 'express';

const router = express.Router();

function boundedPayload(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  try {
    const serialized = JSON.stringify(value);
    return serialized.length <= 10000 ? JSON.parse(serialized) : null;
  } catch (error) {
    return null;
  }
}

// Batch ingestion endpoint for the tracking SDK
router.post('/track', async (req: Request, res: Response) => {
  try {
    const { siteKey, visitorId, sessionId, events, context } = req.body;

    if (typeof siteKey !== 'string' || !siteKey || siteKey.length > 128 ||
        typeof visitorId !== 'string' || !visitorId || visitorId.length > 100 ||
        (sessionId != null && (typeof sessionId !== 'string' || sessionId.length > 100)) ||
        !Array.isArray(events) || events.length === 0 || events.length > 50) {
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }

    const site = await Site.findOne({ siteKey: siteKey, isActive: true });
    if (!site) {
      return res.status(404).json({ success: false, message: 'Site not found or inactive' });
    }

    const proactiveEngine = getProactiveEngine();

    // Deduplicate events by type within this batch — only process the LATEST value per type
    // This prevents e.g. 3 time_on_page events in one batch from all triggering the same rule
    const latestEventByType = new Map();
    for (const event of events) {
      if (!event || typeof event.type !== 'string' || !event.type || event.type.length > 80) continue;
      latestEventByType.set(event.type, event);
    }

    if (latestEventByType.size === 0) {
      return res.status(400).json({ success: false, message: 'No valid events' });
    }

    // Process events SEQUENTIALLY so the memory lock is set before the next event evaluates
    for (const event of latestEventByType.values()) {
      const eventData = {
        siteId: site._id,
        visitorId,
        sessionId,
        eventType: event.type,
        url: typeof event.url === 'string' ? event.url.slice(0, 2048) : null,
        timeOnPage: Math.max(0, Math.min(Number(event.timeOnPage) || 0, 86400)),
        scrollDepth: Math.max(0, Math.min(Number(event.scrollDepth) || 0, 100)),
        customEventName: typeof event.customEventName === 'string' ? event.customEventName.slice(0, 100) : null,
        audienceContext: {
          userAgent: typeof context?.userAgent === 'string' ? context.userAgent.slice(0, 500) : null,
          country: typeof context?.country === 'string' ? context.country.slice(0, 100) : null,
          referrer: typeof context?.referrer === 'string' ? context.referrer.slice(0, 2048) : null
        },
        payload: boundedPayload(event.payload)
      };

      if (proactiveEngine) {
        // AWAIT each event so locks are respected between evaluations
        try {
          await proactiveEngine.evaluateEvent(eventData);
        } catch (err) {
          console.error('Proactive Engine error on feed:', err);
        }
      }
    }

    return res.status(200).json({ success: true, processed: events.length });
  } catch (error) {
    console.error('Events track API error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;