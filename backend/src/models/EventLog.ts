import { defineModel } from '../db/model';
import type { Ref } from '../db/model';
import type { SiteDoc } from './Site';

export type VisitorEventType =
  | 'page_view'
  | 'time_on_page'
  | 'scroll_depth'
  | 'inactivity'
  | 'exit_intent'
  | 'click'
  | 'custom_event'
  | 'form_start'
  | 'form_submit';

export interface EventLogDoc {
  siteId: Ref<SiteDoc>;
  visitorId: string;
  sessionId: string | null;
  eventType: VisitorEventType;
  eventData: Record<string, unknown>;
  url: string | null;
  referrer: string | null;
  userAgent: string | null;
  timestamp: Date;
}

export default defineModel<EventLogDoc>({
  name: 'EventLog',
  table: 'event_logs',
  fields: {
    siteId: { column: 'site_id', type: 'id', ref: 'Site', required: true },
    visitorId: { column: 'visitor_id', type: 'string', required: true },
    sessionId: { column: 'session_id', type: 'string' },
    eventType: {
      column: 'event_type',
      type: 'string',
      required: true,
      enum: [
        'page_view',
        'time_on_page',
        'scroll_depth',
        'inactivity',
        'exit_intent',
        'click',
        'custom_event',
        'form_start',
        'form_submit'
      ]
    },
    eventData: { column: 'event_data', type: 'json', default: () => ({}) },
    url: { column: 'url', type: 'string' },
    referrer: { column: 'referrer', type: 'string' },
    userAgent: { column: 'user_agent', type: 'string' },
    // Pruned after 30 days by the retention sweep in src/db/retention.ts.
    timestamp: { column: 'timestamp', type: 'date', default: () => new Date() }
  }
});
