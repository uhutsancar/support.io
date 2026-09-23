/** What an assignment attempt reports back to its caller. */
import Team from '../models/Team';
import Conversation from '../models/Conversation';
import Department from '../models/Department';
import { isAwayPresence } from '../domain';
import type { Doc, Filter } from '../db/model';
import type { ConversationDoc } from '../models/Conversation';

export interface AssignmentResult {
  success: boolean;
  reason?: string;
  agentId?: string;
  agentName?: string;
}

/** How many times a conversation may bounce before it stops being reassigned. */
const MAX_REASSIGN_ATTEMPTS = 3;

/** How long a fresh assignment is left alone before it can be revisited. */
const MIN_REASSIGN_INTERVAL_MS = 5 * 60 * 1000;

export interface ReassignmentResult {
  reassigned: boolean;
  reason?: string;
  newAgentId?: string;
  oldAgentId?: string;
}

/** The columns the selection below reads; nothing else is loaded. */
const AGENT_SELECTION = '_id name email status skills maxCapacity currentLoad organizationId';

/** Cap for an agent whose row does not set one. */
const DEFAULT_CAPACITY = 10;

function loadAgents(filter: Filter) {
  return Team.find(filter).select(AGENT_SELECTION).lean();
}

/**
 * Picks who should take a conversation, widening the pool in three steps.
 *
 * 1. Members of the conversation's department, when it has one with members.
 * 2. Anyone online in the organization, when that narrower set is empty.
 * 3. Of those, agents whose skills cover what the conversation needs — unless
 *    that leaves nobody, in which case skills are ignored rather than letting
 *    the conversation go unassigned.
 *
 * Whoever is left with spare capacity and the lightest load wins. Returns null
 * when nobody qualifies, and the caller marks the conversation unassigned.
 *
 * The previous version ran the same query up to three times and reused one
 * mutated filter object between them, deleting a key from it partway through;
 * the third call could therefore search a wider set than the comment claimed.
 * Failures were swallowed and reported as "no agent available", so a broken
 * query looked exactly like an empty team.
 */
async function findBestAgent(conversation: Doc<ConversationDoc>, organizationId: string) {
  const { requiredSkills = [], department } = conversation;
  const onlineInOrg: Filter = { organizationId, isActive: true, status: 'online' };

  let candidates: Awaited<ReturnType<typeof loadAgents>> = [];
  if (department) {
    const dept = await Department.findById(department).lean();
    const memberIds = (dept?.members ?? []).map((m) => String(m.userId));
    if (memberIds.length > 0) {
      candidates = await loadAgents({ ...onlineInOrg, _id: { $in: memberIds } });
    }
  }

  const everyone = candidates.length > 0 ? candidates : await loadAgents(onlineInOrg);
  if (everyone.length === 0) return null;

  const wanted = requiredSkills.map((skill: string) => skill.toLowerCase());
  const skilled = wanted.length
    ? everyone.filter((agent) =>
        (agent.skills ?? []).some((skill) => wanted.includes(skill.toLowerCase()))
      )
    : everyone;
  const pool = skilled.length > 0 ? skilled : everyone;

  const available = pool.filter(
    (agent) => (agent.currentLoad || 0) < (agent.maxCapacity || DEFAULT_CAPACITY)
  );
  if (available.length === 0) return null;

  // Least busy first, so work spreads instead of piling onto whoever sorts first.
  return available.sort((a, b) => (a.currentLoad || 0) - (b.currentLoad || 0))[0];
}
async function autoAssignConversation(
  conversationId: unknown,
  organizationId: string
): Promise<AssignmentResult> {
  try {
    const conversation = await Conversation.findById(conversationId)
      .populate('department')
      .populate('siteId');
    if (!conversation) {
      throw new Error('Conversation not found');
    }
    if (conversation.assignedAgent && conversation.assignedAt) {
      const timeSinceAssignment = Date.now() - conversation.assignedAt.getTime();
      if (timeSinceAssignment < MIN_REASSIGN_INTERVAL_MS) {
        return { success: false, reason: 'Recently assigned, skipping auto-reassign' };
      }
    }
    const bestAgent = await findBestAgent(conversation, organizationId);
    if (!bestAgent) {
      await Conversation.findByIdAndUpdate(conversationId, {
        status: 'unassigned'
      });
      return { success: false, reason: 'No eligible agent available' };
    }
    conversation.assignedAgent = bestAgent._id;
    conversation.assignedBy = bestAgent._id;
    conversation.assignedAt = new Date();
    conversation.status = 'assigned';
    await conversation.save();
    await Team.findByIdAndUpdate(bestAgent._id, {
      $inc: {
        currentLoad: 1,
        'stats.activeConversations': 1,
        'stats.totalConversations': 1
      }
    });
    return {
      success: true,
      agentId: bestAgent._id,
      agentName: bestAgent.name
    };
  } catch (error) {
    // Auto-assignment is best effort: the conversation still exists and an
    // agent can pick it up by hand. The cause is logged rather than only
    // returned, because callers routinely ignore the reason string.
    console.error('[assignment] auto-assign failed for', conversationId, error);
    return { success: false, reason: error instanceof Error ? error.message : 'assignment failed' };
  }
}
async function checkAndReassign(
  conversationId: unknown,
  organizationId: string
): Promise<ReassignmentResult> {
  try {
    const conversation = await Conversation.findById(conversationId)
      .populate('assignedAgent')
      .populate('department');
    if (!conversation || !conversation.assignedAgent) {
      return { reassigned: false, reason: 'No assigned agent' };
    }
    const agent = conversation.assignedAgent;
    // Hand the conversation on when the agent cannot answer it: they have gone
    // away, they have already missed the first-response target, or it has been
    // bounced between agents enough times to stop trying.
    const shouldReassign =
      isAwayPresence(agent.status) ||
      (conversation.sla.firstResponseStatus === 'breached' && !conversation.firstResponseAt) ||
      conversation.autoReassignAttempts >= MAX_REASSIGN_ATTEMPTS;
    if (!shouldReassign) {
      return { reassigned: false, reason: 'No need to reassign' };
    }
    const oldAgentId = conversation.assignedAgent._id;
    await Team.findByIdAndUpdate(oldAgentId, {
      $inc: {
        currentLoad: -1,
        'stats.activeConversations': -1
      }
    });
    conversation.assignedAgent = null;
    conversation.assignedAt = null;
    conversation.assignedBy = null;
    conversation.status = 'unassigned';
    conversation.autoReassignAttempts = (conversation.autoReassignAttempts || 0) + 1;
    conversation.lastReassignAt = new Date();
    await conversation.save();
    const assignResult = await autoAssignConversation(conversationId, organizationId);
    return {
      reassigned: assignResult.success,
      reason: assignResult.reason || 'Reassigned successfully',
      newAgentId: assignResult.agentId,
      oldAgentId: oldAgentId.toString()
    };
  } catch (error) {
    console.error('[assignment] reassignment check failed for', conversationId, error);
    return {
      reassigned: false,
      reason: error instanceof Error ? error.message : 'reassign failed'
    };
  }
}

/**
 * Moves an agent's live workload counter.
 *
 * Deliberately never throws: the caller has already committed the change this
 * counter describes, and failing the request afterwards would be worse than a
 * counter that is briefly out of step — db/queries.ts recomputes the real
 * figure from the conversations themselves. Unlike the empty catch this
 * replaces, the failure is at least visible.
 */
async function updateAgentLoad(agentId: unknown, delta: number): Promise<void> {
  if (!agentId) return;
  try {
    await Team.findByIdAndUpdate(agentId, { $inc: { currentLoad: delta } });
  } catch (error) {
    console.error('[assignment] could not adjust load for agent', agentId, error);
  }
}
export { findBestAgent, autoAssignConversation, checkAndReassign, updateAgentLoad };
