import { defineModel } from '../db/model';
import type { Ref } from '../db/model';
import type { UserDoc } from './User';

export interface OrganizationDoc {
  name: string;
  ownerUserId: Ref<UserDoc> | null;
  planType: 'FREE' | 'PRO' | 'ENTERPRISE';
  isActive: boolean;
  /** The plan is set by hand and no subscription event moves it (migration 0009). */
  billingExempt: boolean;
  /** Every member must sign in with a second step (Enterprise). */
  enforce2fa: boolean;
  /** The free Pro trial runs until then (migration 0010); null without one. */
  trialEndsAt: Date | null;
  /** Conversations older than this are deleted (SEC-17); null: the plan's default. */
  retentionDays: number | null;
  /** Which set-up mails went out (PRD-08). */
  activation: Record<string, string>;
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
    isActive: { column: 'is_active', type: 'boolean', default: true },
    billingExempt: { column: 'billing_exempt', type: 'boolean', default: false },
    enforce2fa: { column: 'enforce_2fa', type: 'boolean', default: false },
    trialEndsAt: { column: 'trial_ends_at', type: 'date', default: null },
    retentionDays: { column: 'retention_days', type: 'number', default: null },
    activation: { column: 'activation', type: 'json', default: () => ({}) }
  }
});
