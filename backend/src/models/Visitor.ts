import { defineModel } from '../db/model';
import type { Ref } from '../db/model';
import type { OrganizationDoc } from './Organization';
import type { SiteDoc } from './Site';

export interface VisitorDoc {
  siteId: Ref<SiteDoc>;
  organizationId: Ref<OrganizationDoc>;
  visitorId: string;
  ip: string | null;
  country: string | null;
  browser: string | null;
  os: string | null;
  currentPage: string;
  referrer: string | null;
  isActive: boolean;
  lastActiveAt: Date;
}

export default defineModel<VisitorDoc>({
  name: 'Visitor',
  table: 'visitors',
  fields: {
    siteId: { column: 'site_id', type: 'id', ref: 'Site', required: true },
    organizationId: { column: 'organization_id', type: 'id', ref: 'Organization', required: true },
    visitorId: { column: 'visitor_id', type: 'string', required: true },
    ip: { column: 'ip', type: 'string', default: null },
    country: { column: 'country', type: 'string', default: null },
    browser: { column: 'browser', type: 'string', default: null },
    os: { column: 'os', type: 'string', default: null },
    currentPage: { column: 'current_page', type: 'string', default: '/' },
    referrer: { column: 'referrer', type: 'string', default: null },
    isActive: { column: 'is_active', type: 'boolean', default: true },
    lastActiveAt: { column: 'last_active_at', type: 'date', default: () => new Date() }
  }
});
