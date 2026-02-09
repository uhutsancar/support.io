const express = require('express');
const router = express.Router();
const FAQ = require('../models/FAQ');
const { auth } = require('../middleware/auth');
const { verifySiteKey } = require('../middleware/siteAuth');

// Admin: Get all FAQs for a site
router.get('/admin/:siteId', auth, async (req, res) => {
  try {
    const faqs = await FAQ.find({ siteId: req.params.siteId }).sort({ order: 1, createdAt: -1 });
    res.json({ faqs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Create FAQ
router.post('/admin', auth, async (req, res) => {
  try {
    const { siteId, question, answer, category, keywords, pageSpecific, order } = req.body;

    const faq = new FAQ({
      siteId,
      question,
      answer,
      category,
      keywords,
      pageSpecific,
      order
    });

    await faq.save();
    res.status(201).json({ faq });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Admin: Update FAQ
router.put('/admin/:faqId', auth, async (req, res) => {
  try {
    const updates = req.body;
    const faq = await FAQ.findByIdAndUpdate(req.params.faqId, updates, { new: true });
    
    if (!faq) {
      return res.status(404).json({ error: 'FAQ not found' });
    }

    res.json({ faq });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Admin: Delete FAQ
router.delete('/admin/:faqId', auth, async (req, res) => {
  try {
    const faq = await FAQ.findByIdAndDelete(req.params.faqId);
    
    if (!faq) {
      return res.status(404).json({ error: 'FAQ not found' });
    }

    res.json({ message: 'FAQ deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Public: Search FAQs (for widget)
router.get('/search', verifySiteKey, async (req, res) => {
  try {
    const { query, page } = req.query;
    
    let filter = {
      siteId: req.site._id,
      isActive: true
    };

    // Page-specific or all pages
    if (page) {
      filter.$or = [
        { pageSpecific: page },
        { pageSpecific: '*' }
      ];
    } else {
      filter.pageSpecific = '*';
    }

    let faqs;
    
    if (query && query.trim()) {
      // Text search
      faqs = await FAQ.find({
        ...filter,
        $text: { $search: query }
      }, {
        score: { $meta: 'textScore' }
      }).sort({ score: { $meta: 'textScore' } }).limit(5);
    } else {
      // Just return top FAQs
      faqs = await FAQ.find(filter).sort({ order: 1 }).limit(5);
    }

    res.json({ faqs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
