import { defineModel } from '../db/model';
import type { Ref } from '../db/model';
import type { OrganizationDoc } from './Organization';
import type { TeamDoc } from './Team';
import type { UserDoc } from './User';
import { DEAL_STAGES } from '../domain';
import type { DealStage } from '../domain';

export type { DealStage };

export interface DealDoc {
  title: string;
  value: number;
  currency: string;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  stage: DealStage;
  organizationId: Ref<OrganizationDoc>;
  assignedTo: Ref<UserDoc | TeamDoc> | null;
  createdBy: Ref<UserDoc | TeamDoc>;
  order: number;
  notes: string;
}

export default defineModel<DealDoc>({
  name: 'Deal',
  table: 'deals',
  fields: {
    title: { column: 'title', type: 'string', required: true, trim: true },
    value: { column: 'value', type: 'number', default: 0 },
    currency: { column: 'currency', type: 'string', default: 'TRY' },
    contactName: { column: 'contact_name', type: 'string', required: true },
    contactEmail: { column: 'contact_email', type: 'string', default: null },
    contactPhone: { column: 'contact_phone', type: 'string', default: null },
    stage: {
      column: 'stage',
      type: 'string',
      enum: DEAL_STAGES,
      default: 'new'
    },
    organizationId: { column: 'organization_id', type: 'id', ref: 'Organization', required: true },
    assignedTo: { column: 'assigned_to_id', type: 'id', refAny: ['User', 'Team'], default: null },
    createdBy: { column: 'created_by_id', type: 'id', refAny: ['User', 'Team'], required: true },
    order: { column: 'sort_order', type: 'number', default: 0 },
    notes: { column: 'notes', type: 'string', default: '' }
  }
});
