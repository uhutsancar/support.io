'use strict';

// Regression coverage for B-03/B-13. These checks deliberately start all
// writers together so a stale read/save implementation either exceeds the
// capacity or reopens a conversation that another writer closed.

import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateId } from '../src/db/objectId';
import { getPool, query } from '../src/db/pool';
import {
  assignConversationAtomically,
  reconcileAgentLoads,
  transitionConversationStatusAtomically
} from '../src/services/conversationAssignment';
import { autoAssignConversation } from '../src/services/autoAssignment';
import { tenant } from './helpers/idor';

async function agent(organizationId: string, name: string, capacity: number, online = true) {
  const id = generateId();
  await query(
    `INSERT INTO teams
       (id, email, password, name, organization_id, status, max_capacity, current_load)
     VALUES ($1, $2, 'test-only', $3, $4, $5, $6, 0)`,
    [id, `${id}@assignment.test`, name, organizationId, online ? 'online' : 'offline', capacity]
  );
  return id;
}

async function conversation(siteId: string, organizationId: string) {
  const id = generateId();
  await query(
    `INSERT INTO conversations
       (id, site_id, organization_id, visitor_id, visitor_name, status)
     VALUES ($1, $2, $3, $4, 'Concurrency visitor', 'open')`,
    [id, siteId, organizationId, `visitor-${id}`]
  );
  return id;
}

test.after(async () => {
  await getPool().end();
});

test('20 concurrent assignments reserve no more than the agent capacity', async () => {
  const workspace = await tenant('capacity');
  const agentId = await agent(workspace.organizationId, 'Capacity agent', 3);
  const ids = await Promise.all(
    Array.from({ length: 20 }, () => conversation(workspace.site._id, workspace.organizationId))
  );

  const results = await Promise.all(
    ids.map((conversationId) =>
      assignConversationAtomically({
        conversationId,
        organizationId: workspace.organizationId,
        agentId,
        assignedBy: agentId,
        expectedAgentId: null
      })
    )
  );

  assert.equal(results.filter((result) => result.assigned).length, 3);
  const { rows } = await query<{ assigned: number; load: number; active: number }>(
    `SELECT count(c.id)::int AS assigned,
            max(t.current_load)::int AS load,
            max((t.stats->>'activeConversations')::int)::int AS active
       FROM teams t
       LEFT JOIN conversations c
         ON c.assigned_agent_id = t.id
        AND c.status = ANY($2)
      WHERE t.id = $1
      GROUP BY t.id`,
    [agentId, ['open', 'assigned', 'pending', 'unassigned']]
  );
  assert.deepEqual(rows[0], { assigned: 3, load: 3, active: 3 });
});

test('auto assignment, manual claim and close cannot reopen a closed conversation', async () => {
  const workspace = await tenant('race');
  const automaticAgent = await agent(workspace.organizationId, 'Automatic agent', 10);
  const manualAgent = await agent(workspace.organizationId, 'Manual agent', 10, false);
  const conversationId = await conversation(workspace.site._id, workspace.organizationId);

  await Promise.all([
    autoAssignConversation(conversationId, workspace.organizationId),
    assignConversationAtomically({
      conversationId,
      organizationId: workspace.organizationId,
      agentId: manualAgent,
      assignedBy: manualAgent,
      expectedAgentId: null
    }),
    transitionConversationStatusAtomically(conversationId, workspace.organizationId, 'closed')
  ]);
  await reconcileAgentLoads();

  const { rows: conversations } = await query<{ status: string; assigned_agent_id: string | null }>(
    'SELECT status, assigned_agent_id FROM conversations WHERE id = $1',
    [conversationId]
  );
  assert.equal(conversations[0].status, 'closed');

  const { rows: loads } = await query<{ id: string; current_load: number; actual: number }>(
    `SELECT t.id, t.current_load,
            count(c.id) FILTER (WHERE c.status = ANY($2))::int AS actual
       FROM teams t
       LEFT JOIN conversations c ON c.assigned_agent_id = t.id
      WHERE t.id = ANY($1)
      GROUP BY t.id
      ORDER BY t.id`,
    [
      [automaticAgent, manualAgent],
      ['open', 'assigned', 'pending', 'unassigned']
    ]
  );
  for (const row of loads) assert.equal(row.current_load, row.actual);
});
