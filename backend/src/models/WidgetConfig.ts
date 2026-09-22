import { defineModel } from '../db/model';
import type { Ref } from '../db/model';
import type { OrganizationDoc } from './Organization';
import type { SiteDoc } from './Site';

export interface WidgetColors {
  primary: string;
  header: string;
  background: string;
  text: string;
  textSecondary: string;
  border: string;
  visitorMessageBg: string;
  agentMessageBg: string;
}

export interface WidgetBranding {
  logo: string | null;
  logoWidth: number;
  logoHeight: number;
  brandName: string;
  showBrandName: boolean;
}

export interface WidgetButton {
  position: string;
  size: 'small' | 'medium' | 'large' | string;
  icon: string;
  showLabel: boolean;
  labelText: string;
  borderRadius: number;
  shadow: boolean;
  shadowColor: string;
}

export interface WidgetWindow {
  width: number;
  height: number;
  borderRadius: number;
  headerHeight: number;
  showHeader: boolean;
  showCloseButton: boolean;
}

export interface WidgetMessages {
  welcomeMessage: string;
  placeholderText: string;
  showTimestamps: boolean;
  showAvatars: boolean;
  messageBubbleRadius: number;
}

export interface WidgetBehavior {
  autoOpen: boolean;
  autoOpenDelay: number;
  showOnPages: string[];
  hideOnPages: string[];
  showUnreadBadge: boolean;
  enableSound: boolean;
  enableNotifications: boolean;
}

export interface WidgetTypography {
  fontFamily: string;
  fontSize: 'small' | 'medium' | 'large' | string;
  fontWeight: string;
}

export interface WidgetAdvanced {
  customCSS: string | null;
  zIndex: number;
  animationSpeed: 'slow' | 'normal' | 'fast' | string;
}

export interface WidgetConfigDoc {
  siteId: Ref<SiteDoc>;
  organizationId: Ref<OrganizationDoc>;
  colors: WidgetColors;
  branding: WidgetBranding;
  button: WidgetButton;
  window: WidgetWindow;
  messages: WidgetMessages;
  behavior: WidgetBehavior;
  typography: WidgetTypography;
  advanced: WidgetAdvanced;
  isActive: boolean;
}

export default defineModel<WidgetConfigDoc>({
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
