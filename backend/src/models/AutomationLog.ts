import { defineModel } from '../db/model';
import type { Ref } from '../db/model';
import type { AutomationRuleDoc } from './AutomationRule';
import type { SiteDoc } from './Site';

export interface AutomationLogDoc {
  ruleId: Ref<AutomationRuleDoc>;
  siteId: Ref<SiteDoc>;
  triggerType: string;
  targetId: string | null;
  status: 'success' | 'failed';
  errorDetails: string | null;
  executionTimeMs: number | null;
  executedAt: Date;
}

export default defineModel<AutomationLogDoc>({
  name: 'AutomationLog',
  table: 'automation_logs',
  fields: {
    ruleId: { column: 'rule_id', type: 'id', ref: 'AutomationRule', required: true },
    siteId: { column: 'site_id', type: 'id', ref: 'Site', required: true },
    triggerType: { column: 'trigger_type', type: 'string', required: true },
    targetId: { column: 'target_id', type: 'id' },
    status: { column: 'status', type: 'string', enum: ['success', 'failed'], required: true },
    errorDetails: { column: 'error_details', type: 'string' },
    executionTimeMs: { column: 'execution_time_ms', type: 'number' },
    // Pruned after 30 days by the retention sweep in src/db/retention.ts.
    executedAt: { column: 'executed_at', type: 'date', default: () => new Date() }
  }
});
