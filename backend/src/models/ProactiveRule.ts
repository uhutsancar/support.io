/** What the widget is told to do when the rule fires. */
import { defineModel } from '../db/model';
import type { Ref } from '../db/model';
import type { SiteDoc } from './Site';
import type {
  ProactiveAudienceContext,
  ProactiveFrequencyControl,
  ProactiveMetrics,
  ProactiveTriggerCondition
} from '../domain';

export interface ProactiveActionSpec {
  /** 'send_message' | 'open_popup' | 'add_tag' */
  type?: string;
  message?: string;
  /** The text pushed to the widget for send_message / open_popup. */
  messageContent?: string;
  /** The tag applied for add_tag. */
  tag?: string;
  [param: string]: unknown;
}

export interface ProactiveRuleDoc {
  siteId: Ref<SiteDoc>;
  name: string;
  isActive: boolean;
  triggerCondition: ProactiveTriggerCondition;
  audienceContext: ProactiveAudienceContext;
  action: ProactiveActionSpec;
  frequencyControl: ProactiveFrequencyControl;
  metrics: ProactiveMetrics;
}

export default defineModel<ProactiveRuleDoc>({
  name: 'ProactiveRule',
  table: 'proactive_rules',
  fields: {
    siteId: { column: 'site_id', type: 'id', ref: 'Site', required: true },
    name: { column: 'name', type: 'string', required: true },
    isActive: { column: 'is_active', type: 'boolean', default: true },
    triggerCondition: {
      column: 'trigger_condition',
      type: 'json',
      default: () => ({ urlMatch: 'any', timeThresholdSeconds: 0, scrollPercentage: 0 })
    },
    audienceContext: {
      column: 'audience_context',
      type: 'json',
      default: () => ({ deviceType: 'all' })
    },
    action: { column: 'action', type: 'json', default: () => ({}) },
    frequencyControl: {
      column: 'frequency_control',
      type: 'json',
      default: () => ({ triggerOncePerVisitor: true, cooldownMinutes: 1440 })
    },
    metrics: {
      column: 'metrics',
      type: 'json',
      default: () => ({ triggersCount: 0, conversionsCount: 0 })
    }
  }
});
