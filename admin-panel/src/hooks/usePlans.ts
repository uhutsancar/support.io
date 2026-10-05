// The plan table the server enforces (GET /api/plans), for the pricing page
// and the home page's pricing teaser.
//
// The numbers live in one place, backend/src/domain/plans.ts. The marketing
// pages used to carry their own copy ("10 sites", "unlimited users") that had
// drifted from what the server applied; now they only render what comes back.
// One request per page load is shared by every component that asks.

import { useEffect, useState } from 'react';
import { plansAPI } from '../services/api';
import type { PlanInfo } from '../types/api';

let pending: Promise<PlanInfo[]> | null = null;

function loadPlans(): Promise<PlanInfo[]> {
  pending ??= plansAPI.list().then(({ data }) => data.plans);
  // A failure is not cached: the next mount tries again.
  pending.catch(() => {
    pending = null;
  });
  return pending;
}

export interface PlansState {
  /** null until the table has arrived. */
  plans: PlanInfo[] | null;
  failed: boolean;
}

export function usePlans(): PlansState {
  const [state, setState] = useState<PlansState>({ plans: null, failed: false });

  useEffect(() => {
    let live = true;
    loadPlans().then(
      (plans) => live && setState({ plans, failed: false }),
      () => live && setState({ plans: null, failed: true })
    );
    return () => {
      live = false;
    };
  }, []);

  return state;
}

/** Features the free plan lacks, in the order the pricing table lists them. */
export const PLAN_FEATURE_ORDER = [
  'departments',
  'automation',
  'proactive',
  'visitors',
  'crm',
  'export',
  'audit'
] as const;

/** Lower-case plan id used in translation keys: FREE → free. */
export const planKey = (plan: PlanInfo) => plan.type.toLowerCase();
