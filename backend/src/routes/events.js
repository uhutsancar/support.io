const express = require('express');
const router = express.Router();
const cors = require('cors');
const { getEngine: getProactiveEngine } = require('../services/proactiveEngine');
const Site = require('../models/Site');

// Enable CORS for frontend SDK calls
router.use(cors());

// Batch ingestion endpoint for the tracking SDK
router.post('/track', async (req, res) => {
  try {
    const { siteKey, visitorId, sessionId, events, context } = req.body;

    if (!siteKey || !visitorId || !events || !Array.isArray(events)) {
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
      latestEventByType.set(event.type, event);
    }

    // Process events SEQUENTIALLY so the memory lock is set before the next event evaluates
    for (const event of latestEventByType.values()) {
      const eventData = {
        siteId: site._id,
        visitorId,
        sessionId,
        eventType: event.type,
        url: event.url,
        timeOnPage: event.timeOnPage || 0,
        scrollDepth: event.scrollDepth || 0,
        customEventName: event.customEventName,
        audienceContext: {
          userAgent: context?.userAgent,
          country: context?.country,
          referrer: context?.referrer
        },
        payload: event.payload
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

module.exports = router;
