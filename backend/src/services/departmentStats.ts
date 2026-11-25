// The counters a department keeps about its own workload, shared by the REST
// route and the socket handler that resolve a conversation.
//
// The averages are running means kept without storing the samples:
//
//     new_average = (old_average * (n - 1) + sample) / n
//
// where `n` counts the decided conversations *after* this one, so the
// met/breached counters are incremented before the averages are folded in.

import Department from '../models/Department';
import Team from '../models/Team';
import type { Doc } from '../db/model';
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
    $inc: { 'stats.resolvedConversations': 1 }
  });
}
