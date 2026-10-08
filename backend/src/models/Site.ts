import { defineModel } from '../db/model';
import type { Ref } from '../db/model';
import type { OrganizationDoc } from './Organization';
import type { UserDoc } from './User';
import type { SiteInstallation, SiteIntegrations, SiteWidgetSettings } from '../domain';

export interface SiteDoc {
  name: string;
  domain: string;
  siteKey: string;
  userId: Ref<UserDoc> | null;
  organizationId: Ref<OrganizationDoc>;
  widgetSettings: SiteWidgetSettings;
  /** The FAQ assistant answers first (services/assistant). Off by default. */
  assistantEnabled: boolean;
  /** The keyword FAQ reply, labelled as a help article. Off by default. */
  faqAutoReply: boolean;
  integrations: SiteIntegrations;
  installation: SiteInstallation;
  /** The exact origins the widget may run on; see config/siteOrigins.ts. */
  allowedOrigins: string[];
  isActive: boolean;
  /** Missed chats, forms, ratings (services/chatSettings.ts); stored sparse. */
  chatSettings: Record<string, unknown>;
  /** Over the plan's site limit after a downgrade (BIL-04): widget silent. */
  suspendedAt: Date | null;
  /** Switched off by the platform for abuse (LEG-05); only `site:disable` changes it. */
  blockedAt: Date | null;
  /** Why, for the support trail; never sent to the panel. */
  blockedReason: string | null;
}

/** What the panel may know about the integrations: whether, never what. */
export interface PublicSiteIntegrations {
  identity: { configured: boolean };
}

export function publicIntegrations(
  integrations: SiteIntegrations | undefined
): PublicSiteIntegrations {
  return { identity: { configured: Boolean(integrations?.identitySecret) } };
}

export default defineModel<SiteDoc>({
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
    assistantEnabled: { column: 'assistant_enabled', type: 'boolean', default: false },
    faqAutoReply: { column: 'faq_auto_reply', type: 'boolean', default: false },
    integrations: {
      column: 'integrations',
      type: 'json',
      default: () => ({ identitySecret: null })
    },
    // Widget'ın müşteri sitesinde gerçekten çalıştığına dair kanıt. Panelde
    // "Kurulum bekleniyor" / "Kurulu" rozetini besler.
    //   { verifiedAt, lastSeenAt, url, origin, sdkVersion, userAgent }
    installation: { column: 'installation', type: 'json', default: () => ({}) },
    allowedOrigins: { column: 'allowed_origins', type: 'stringArray', default: () => [] },
    isActive: { column: 'is_active', type: 'boolean', default: true },
    chatSettings: { column: 'chat_settings', type: 'json', default: () => ({}) },
    suspendedAt: { column: 'suspended_at', type: 'date', default: null },
    blockedAt: { column: 'blocked_at', type: 'date', default: null },
    blockedReason: { column: 'blocked_reason', type: 'string', default: null }
  },
  methods: {
    // The integration secrets are sealed in the database and must never be
    // serialised, sealed or not: every route that answers with a site sends
    // this form, so the safe behaviour does not depend on each one
    // remembering to strip them — the same reason User drops its password.
    toJSON() {
      const obj = this.toObject();
      obj.integrations = publicIntegrations(obj.integrations as SiteIntegrations);
      // The panel learns that the platform blocked the site, not the note.
      delete obj.blockedReason;
      return obj;
    }
  }
});
