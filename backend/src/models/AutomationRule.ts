import { defineModel } from '../db/model';
import type { Ref } from '../db/model';
import type { SiteDoc } from './Site';
import type { AutomationAction, AutomationCondition, AutomationMetrics } from '../types/domain';

export type AutomationTrigger = 'message_received' | 'conversation_created' | 'visitor_event' | 'schedule';

export interface AutomationRuleDoc {
  siteId: Ref<SiteDoc>;
  name: string;
  isActive: boolean;
  priority: number;
  triggerType: AutomationTrigger;
  conditions: AutomationCondition[];
  conditionOperator: 'AND' | 'OR' | string;
  actions: AutomationAction[];
  metrics: AutomationMetrics;
}

export default defineModel<AutomationRuleDoc>({
  name: 'AutomationRule',
  table: 'automation_rules',
  fields: {
    siteId: { column: 'site_id', type: 'id', ref: 'Site', required: true },
    name: { column: 'name', type: 'string', required: true },
    isActive: { column: 'is_active', type: 'boolean', default: true },
    priority: { column: 'priority', type: 'number', default: 0 },
    triggerType: {
      column: 'trigger_type',
      type: 'string',
      enum: ['message_received', 'conversation_created', 'visitor_event', 'schedule'],
      required: true
    },
    // Rule bodies are always read and written as a whole.
    conditions: { column: 'conditions', type: 'json', default: () => [] },
    conditionOperator: { column: 'condition_operator', type: 'string', default: 'AND' },
    actions: { column: 'actions', type: 'json', default: () => [] },
    metrics: {
      column: 'metrics',
      type: 'json',
      default: () => ({ executionsCount: 0, successCount: 0, failureCount: 0 })
    }
  }
});
