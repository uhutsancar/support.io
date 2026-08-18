const { defineModel } = require('../db/model');

module.exports = defineModel({
  name: 'WidgetConfig',
  table: 'widget_configs',
  fields: {
    siteId: { column: 'site_id', type: 'id', ref: 'Site', required: true },
    organizationId: { column: 'organization_id', type: 'id', ref: 'Organization', required: true },
    colors: {
      column: 'colors',
      type: 'json',
      default: () => ({
        primary: '#4F46E5',
        header: '#4F46E5',
        background: '#FFFFFF',
        text: '#1F2937',
        textSecondary: '#6B7280',
        border: '#E5E7EB',
        visitorMessageBg: '#4F46E5',
        agentMessageBg: '#F3F4F6'
      })
    },
    branding: {
      column: 'branding',
      type: 'json',
      default: () => ({ logo: null, logoWidth: 40, logoHeight: 40, brandName: 'Support', showBrandName: true })
    },
    button: {
      column: 'button',
      type: 'json',
      default: () => ({
        position: 'bottom-right',
        size: 'medium',
        icon: 'message-circle',
        showLabel: false,
        labelText: 'Chat with us',
        borderRadius: 50,
        shadow: true,
        shadowColor: 'rgba(0,0,0,0.15)'
      })
    },
    window: {
      column: 'window',
      type: 'json',
      default: () => ({ width: 400, height: 650, borderRadius: 16, headerHeight: 60, showHeader: true, showCloseButton: true })
    },
    messages: {
      column: 'messages',
      type: 'json',
      default: () => ({
        welcomeMessage: '',
        placeholderText: 'Type your message...',
        showTimestamps: true,
        showAvatars: true,
        messageBubbleRadius: 12
      })
    },
    behavior: {
      column: 'behavior',
      type: 'json',
      default: () => ({
        autoOpen: false,
        autoOpenDelay: 5000,
        showOnPages: [],
        hideOnPages: [],
        showUnreadBadge: true,
        enableSound: true,
        enableNotifications: true
      })
    },
    typography: {
      column: 'typography',
      type: 'json',
      default: () => ({
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        fontSize: 'medium',
        fontWeight: 'normal'
      })
    },
    advanced: {
      column: 'advanced',
      type: 'json',
      default: () => ({ customCSS: null, zIndex: 999999, animationSpeed: 'normal' })
    },
    isActive: { column: 'is_active', type: 'boolean', default: true }
  }
});
