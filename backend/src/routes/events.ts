import express from 'express';
import { getEngine as getProactiveEngine } from '../services/proactiveEngine';
import Site from '../models/Site';
import { asyncHandler, badRequest, notFound } from '../http';
import type { Request, Response } from 'express';

const router = express.Router();

const MAX_EVENTS_PER_BATCH = 50;
const MAX_URL_LENGTH = 2048;
const SECONDS_PER_DAY = 86400;
const MAX_PAYLOAD_BYTES = 10000;

/** A finite number inside [min, max]; anything else becomes `min`. */
function clamp(value: unknown, min: number, max: number): number {
  return Math.max(min, Math.min(Number(value) || min, max));
}

function boundedPayload(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  try {
    const serialized = JSON.stringify(value);
    return serialized.length <= MAX_PAYLOAD_BYTES ? JSON.parse(serialized) : null;
  } catch {
    return null;
  }
}

// Batch ingestion endpoint for the tracking SDK
router.post(
  '/track',
  asyncHandler(async (req: Request, res: Response) => {
    const { siteKey, visitorId, sessionId, events, context } = req.body;

    if (
      typeof siteKey !== 'string' ||
      !siteKey ||
      siteKey.length > 128 ||
      typeof visitorId !== 'string' ||
      !visitorId ||
      visitorId.length > 100 ||
      (sessionId != null && (typeof sessionId !== 'string' || sessionId.length > 100)) ||
      !Array.isArray(events) ||
      events.length === 0 ||
      events.length > MAX_EVENTS_PER_BATCH
    ) {
      throw badRequest('Invalid payload');
    }

    const site = await Site.findOne({ siteKey, isActive: true });
    if (!site) throw notFound('Site');

    const proactiveEngine = getProactiveEngine();

    // Only the latest value per event type is evaluated. A batch carrying three
    // `time_on_page` events would otherwise fire the same rule three times.
    const latestEventByType = new Map<string, Record<string, unknown>>();
    for (const event of events) {
      if (!event || typeof event.type !== 'string' || !event.type || event.type.length > 80)
        continue;
      latestEventByType.set(event.type, event);
    }
    if (latestEventByType.size === 0) throw badRequest('No valid events');

    // Evaluated one at a time: the engine's per-visitor lock has to be set before
    // the next event is considered, or a rule fires twice for one batch.
    for (const event of latestEventByType.values()) {
      const eventData = {
        siteId: site._id,
        visitorId,
        sessionId,
        eventType: event.type as string,
        url: typeof event.url === 'string' ? event.url.slice(0, MAX_URL_LENGTH) : null,
        timeOnPage: clamp(event.timeOnPage, 0, SECONDS_PER_DAY),
        scrollDepth: clamp(event.scrollDepth, 0, 100),
        customEventName:
          typeof event.customEventName === 'string' ? event.customEventName.slice(0, 100) : null,
        audienceContext: {
          userAgent:
            typeof context?.userAgent === 'string' ? context.userAgent.slice(0, 500) : null,
          country: typeof context?.country === 'string' ? context.country.slice(0, 100) : null,
          referrer:
            typeof context?.referrer === 'string' ? context.referrer.slice(0, MAX_URL_LENGTH) : null
        },
        payload: boundedPayload(event.payload)
      };

      if (!proactiveEngine) continue;
      try {
        await proactiveEngine.evaluateEvent(eventData);
      } catch (error) {
        // One rule that throws must not discard the rest of the batch.
        console.error('[events] proactive engine failed on', eventData.eventType, error);
      }
    }

    res.json({ success: true, processed: events.length });
  })
);

export default router;
