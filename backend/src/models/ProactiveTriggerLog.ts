import { defineModel } from '../db/model';
import type { Ref } from '../db/model';
import type { ProactiveRuleDoc } from './ProactiveRule';
import type { SiteDoc } from './Site';

export interface ProactiveTriggerLogDoc {
  ruleId: Ref<ProactiveRuleDoc>;
  siteId: Ref<SiteDoc>;
  visitorId: string;
  triggeredAt: Date;
  converted: boolean;
  convertedAt: Date | null;
}

export default defineModel<ProactiveTriggerLogDoc>({
  name: 'ProactiveTriggerLog',
  table: 'proactive_trigger_logs',
  fields: {
    ruleId: { column: 'rule_id', type: 'id', ref: 'ProactiveRule', required: true },
    siteId: { column: 'site_id', type: 'id', ref: 'Site', required: true },
    visitorId: { column: 'visitor_id', type: 'string', required: true },
    triggeredAt: { column: 'triggered_at', type: 'date', default: () => new Date() },
    converted: { column: 'converted', type: 'boolean', default: false },
    convertedAt: { column: 'converted_at', type: 'date', default: null }
  }
});
