const { defineModel } = require('../db/model');

module.exports = defineModel({
  name: 'Site',
  table: 'sites',
  fields: {
    name: { column: 'name', type: 'string', required: true, trim: true },
    domain: { column: 'domain', type: 'string', required: true, trim: true },
    siteKey: { column: 'site_key', type: 'string', required: true },
    userId: { column: 'user_id', type: 'id', ref: 'User' },
    organizationId: { column: 'organization_id', type: 'id', ref: 'Organization', required: true },
    widgetSettings: {
      column: 'widget_settings',
      type: 'json',
      default: () => ({
        position: 'bottom-right',
        primaryColor: '#4F46E5',
        welcomeMessage: 'Hi! How can we help you today?',
        placeholderText: 'Type your message...',
        showOnPages: [],
        autoOpen: false,
        autoOpenDelay: 5000
      })
    },
    aiSettings: {
      column: 'ai_settings',
      type: 'json',
      default: () => ({ enabled: false, fallbackToHuman: true, aiModel: 'faq-based' })
    },
    // Widget'ın müşteri sitesinde gerçekten çalıştığına dair kanıt. Panelde
    // "Kurulum bekleniyor" / "Kurulu" rozetini besler.
    //   { verifiedAt, lastSeenAt, url, origin, sdkVersion, userAgent }
    installation: { column: 'installation', type: 'json', default: () => ({}) },
    isActive: { column: 'is_active', type: 'boolean', default: true }
  }
});
