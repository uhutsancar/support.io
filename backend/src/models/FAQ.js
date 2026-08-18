const { defineModel } = require('../db/model');

module.exports = defineModel({
  name: 'FAQ',
  table: 'faqs',
  // Replaces the Mongo text index across question / answer / keywords.
  textSearch: { column: 'search_vector', config: 'simple' },
  fields: {
    siteId: { column: 'site_id', type: 'id', ref: 'Site', required: true },
    question: { column: 'question', type: 'string', required: true, trim: true },
    answer: { column: 'answer', type: 'string', required: true },
    category: { column: 'category', type: 'string', default: 'General' },
    keywords: { column: 'keywords', type: 'stringArray', lowercase: true, default: () => [] },
    pageSpecific: { column: 'page_specific', type: 'string', default: '*' },
    isActive: { column: 'is_active', type: 'boolean', default: true },
    order: { column: 'sort_order', type: 'number', default: 0 },
    viewCount: { column: 'view_count', type: 'number', default: 0 },
    helpfulCount: { column: 'helpful_count', type: 'number', default: 0 }
  }
});
