// The counters a department keeps about its own workload.
//
// The rollup that runs when a conversation is resolved existed twice, verbatim
// — thirty lines in `routes/conversations.ts` and the same thirty in the
// socket handler's `resolve-conversation`. Two copies of an accumulator is a
// particularly bad kind of duplication: they do not fail loudly when they
// drift, they just produce different numbers depending on whether the agent
// clicked "resolve" in the inbox or the socket closed the conversation, and
// nobody can tell which figure is the right one afterwards.
//
// The arithmetic is a running mean kept without storing the samples:
//
//     new_average = (old_average * (n - 1) + sample) / n
//
// where `n` is the number of decided conversations *after* this one is counted.
// That is why the met/breached counters are incremented before the averages
// are folded in — reversing those two steps divides by the wrong n, which is a
// mistake the duplicated copies were one edit away from making independently.

import Department from '../models/Department';
import Team from '../models/Team';
import type { Doc, Filter, UpdateSpec } from '../db/model';
import type { ConversationDoc } from '../models/Conversation';
import type { DepartmentDoc } from '../models/Department';
import type { DepartmentSlaMetrics } from '../domain';

/** Folds one more sample into a running mean of `count` values. */
function foldAverage(currentAverage: number, count: number, sample: number): number {
  if (count <= 0) return sample;
  return (currentAverage * (count - 1) + sample) / count;
}

/**
 * Records a resolved conversation against its department's SLA metrics.
 *
 * Mutates and saves the department. Safe to call with a conversation that has
 * no department — the common case for a site that never created one.
 */
export async function recordResolution(conversation: Doc<ConversationDoc>): Promise<void> {
  const departmentId = conversation.department?._id ?? conversation.department;
  if (!departmentId) return;

  const department = await Department.findOne({
    _id: departmentId,
    siteId: conversation.siteId
  });
  if (!department) return;

  const stats = department.stats;
  const metrics: DepartmentSlaMetrics = stats.slaMetrics;

  stats.activeConversations = Math.max(0, stats.activeConversations - 1);

  if (conversation.sla.firstResponseStatus === 'met') metrics.firstResponseMet++;
  else if (conversation.sla.firstResponseStatus === 'breached') metrics.firstResponseBreached++;

  if (conversation.sla.resolutionStatus === 'met') metrics.resolutionMet++;
  else if (conversation.sla.resolutionStatus === 'breached') metrics.resolutionBreached++;

  // `responseTime` / `resolutionTime` are virtuals: minutes elapsed, or null
  // when the milestone never happened.
  if (conversation.responseTime) {
    metrics.averageFirstResponseTime = foldAverage(
      metrics.averageFirstResponseTime || 0,
      metrics.firstResponseMet + metrics.firstResponseBreached,
      conversation.responseTime
    );
  }

  if (conversation.resolutionTime) {
    metrics.averageResolutionTime = foldAverage(
      metrics.averageResolutionTime || 0,
      metrics.resolutionMet + metrics.resolutionBreached,
      conversation.resolutionTime
    );
  }

  await department.save();
}

/** Moves a conversation's contribution from one department's counters to another's. */
export async function recordDepartmentChange(
  _conversation: Doc<ConversationDoc>,
  previousDepartmentId: unknown,
  nextDepartmentId: unknown,
  { wasActive }: { wasActive: boolean }
): Promise<void> {
  if (String(previousDepartmentId || '') === String(nextDepartmentId || '')) return;

  if (nextDepartmentId) {
    await Department.findByIdAndUpdate(nextDepartmentId, {
      $inc: {
        'stats.totalConversations': 1,
        ...(wasActive ? { 'stats.activeConversations': 1 } : {})
      }
    });
  }

  if (previousDepartmentId && wasActive) {
    const previous = await Department.findById(previousDepartmentId);
    if (previous) {
      // Clamped rather than decremented blindly: a counter that has drifted to
      // zero must not go negative and start reading as a huge unsigned number
      // in the dashboard.
      previous.stats.activeConversations = Math.max(0, previous.stats.activeConversations - 1);
      await previous.save();
    }
  }
}

/** A new conversation landing in a department. */
export async function recordNewConversation(
  department: Doc<DepartmentDoc> | null | undefined
): Promise<void> {
  if (!department) return;
  department.stats.totalConversations++;
  department.stats.activeConversations++;
  await department.save();
}

/** The agent's own counters when they resolve a conversation. */
export async function recordAgentResolution(agentId: unknown): Promise<void> {
  if (!agentId) return;
  await Team.findByIdAndUpdate(agentId, {
    $inc: { 'stats.activeConversations': -1, 'stats.resolvedConversations': 1 }
  });
}

/**
 * The agent's own counters when a conversation is handed to them.
 *
 * An agent can be a Team row or a User row, so the model is taken structurally:
 * both expose `findOneAndUpdate`, and this only needs that one method.
 */
interface CounterUpdatable {
  findOneAndUpdate(filter: Filter, update: UpdateSpec): PromiseLike<unknown>;
}

export async function recordAgentAssignment(
  Model: CounterUpdatable,
  agentId: unknown,
  organizationId: string
): Promise<void> {
  if (!agentId) return;
  await Model.findOneAndUpdate(
    { _id: agentId, organizationId },
    { $inc: { 'stats.activeConversations': 1, 'stats.totalConversations': 1 } }
  );
}
