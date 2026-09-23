import { defineModel } from '../db/model';
import type { Ref } from '../db/model';
import type { OrganizationDoc } from './Organization';
import type { UserDoc } from './User';
import type {
  SiteAiSettings,
  SiteInstallation,
  SiteIntegrations,
  SiteWidgetSettings
} from '../domain';

export interface SiteDoc {
  name: string;
  domain: string;
  siteKey: string;
  userId: Ref<UserDoc> | null;
  organizationId: Ref<OrganizationDoc>;
  widgetSettings: SiteWidgetSettings;
  aiSettings: SiteAiSettings;
  integrations: SiteIntegrations;
  installation: SiteInstallation;
  isActive: boolean;
}

/** What the panel may know about the integrations: whether, never what. */
export interface PublicSiteIntegrations {
  identity: { configured: boolean };
  orderLookup: { enabled: boolean; url: string | null; signingConfigured: boolean };
}

export function publicIntegrations(
  integrations: SiteIntegrations | undefined
): PublicSiteIntegrations {
  return {
    identity: { configured: Boolean(integrations?.identitySecret) },
    orderLookup: {
      enabled: Boolean(integrations?.orderLookup?.enabled),
      url: integrations?.orderLookup?.url ?? null,
      signingConfigured: Boolean(integrations?.orderLookup?.signingSecret)
    }
  };
}

export const DEFAULT_AI_SETTINGS: SiteAiSettings = {
  mode: 'off',
  answerLength: 'short',
  tone: 'professional',
  maxBotReplies: 8,
  blockedTerms: [],
  botName: null,
  handoffMessage: null
};

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
    aiSettings: {
      column: 'ai_settings',
      type: 'json',
      default: () => ({ ...DEFAULT_AI_SETTINGS, blockedTerms: [] })
    },
    integrations: {
      column: 'integrations',
      type: 'json',
      default: () => ({
        identitySecret: null,
        orderLookup: { enabled: false, url: null, signingSecret: null }
      })
    },
    // Widget'ın müşteri sitesinde gerçekten çalıştığına dair kanıt. Panelde
    // "Kurulum bekleniyor" / "Kurulu" rozetini besler.
    //   { verifiedAt, lastSeenAt, url, origin, sdkVersion, userAgent }
    installation: { column: 'installation', type: 'json', default: () => ({}) },
    isActive: { column: 'is_active', type: 'boolean', default: true }
  },
  methods: {
    // The integration secrets are sealed in the database and must never be
    // serialised, sealed or not: every route that answers with a site sends
    // this form, so the safe behaviour does not depend on each one
    // remembering to strip them — the same reason User drops its password.
    toJSON() {
      const obj = this.toObject();
      obj.integrations = publicIntegrations(obj.integrations as SiteIntegrations);
      return obj;
    }
  }
});
