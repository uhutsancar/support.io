import { defineModel } from '../db/model';
import type { Ref } from '../db/model';
import type { UserDoc } from './User';

export interface OrganizationDoc {
  name: string;
  ownerUserId: Ref<UserDoc> | null;
  planType: 'FREE' | 'PRO' | 'ENTERPRISE';
  isActive: boolean;
}

export default defineModel<OrganizationDoc>({
  name: 'Organization',
  table: 'organizations',
  fields: {
    name: { column: 'name', type: 'string', required: true, trim: true },
    ownerUserId: { column: 'owner_user_id', type: 'id', ref: 'User' },
    planType: {
      column: 'plan_type',
      type: 'string',
      enum: ['FREE', 'PRO', 'ENTERPRISE'],
      default: 'FREE'
    },
    isActive: { column: 'is_active', type: 'boolean', default: true }
  }
});
