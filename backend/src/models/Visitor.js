const { defineModel } = require('../db/model');

module.exports = defineModel({
  name: 'Visitor',
  table: 'visitors',
  fields: {
    siteId: { column: 'site_id', type: 'id', ref: 'Site', required: true },
    organizationId: { column: 'organization_id', type: 'id', ref: 'Organization', required: true },
    visitorId: { column: 'visitor_id', type: 'string', required: true },
    ip: { column: 'ip', type: 'string', default: null },
    country: { column: 'country', type: 'string', default: null },
    browser: { column: 'browser', type: 'string', default: null },
    os: { column: 'os', type: 'string', default: null },
    currentPage: { column: 'current_page', type: 'string', default: '/' },
    referrer: { column: 'referrer', type: 'string', default: null },
    isActive: { column: 'is_active', type: 'boolean', default: true },
    lastActiveAt: { column: 'last_active_at', type: 'date', default: () => new Date() }
  }
});
