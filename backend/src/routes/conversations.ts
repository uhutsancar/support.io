// The inbox: listing conversations, reading one, and the moves an agent makes
// on it (assign, claim, route to a department, reprioritise, resolve, delete).
//
// Two rules hold throughout:
//
//   * The tenant filter is inside the query, never a comparison afterwards.
//     Loading a row and then checking its organization skipped the check
//     entirely whenever the id being compared was empty.
//   * Reads do not write. SLA clocks are recomputed in memory for display; the
//     persistent update happens in services/slaSweeper.ts, so opening an inbox
//     no longer issues fifty UPDATEs.

import express from 'express';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import Team from '../models/Team';
import User from '../models/User';
import Department from '../models/Department';
import { auth } from '../middleware/auth';
import { checkPermission, hasPermission } from '../middleware/rbac';
import events from '../events';
import { latestMessagesByConversation, unreadCountsByOrganization } from '../db/queries';
import { listConversations, conversationCounts, messageMatchesForSearch } from '../db/inboxQueries';
import { updateAgentLoad } from '../services/autoAssignment';
import { refreshSla, refreshSlaAll } from '../services/conversationSla';
import {
  recordAgentAssignment,
  recordAgentResolution,
  recordDepartmentChange,
  recordResolution
} from '../services/departmentStats';
import {
  CONVERSATION_STATUSES,
  PRIORITIES,
  isActiveConversationStatus,
  isConversationStatus,
  isPriority,
  slaTargetsFor
} from '../domain';
import { notifyAdmin } from '../realtime';
import {
  asyncHandler,
  badRequest,
  conflict,
  forbidden,
  loadOwnedConversation,
  loadOwnedSite,
  notFound,
  orgId,
  requireObjectId,
  requireOrganization
} from '../http';
import type { Request, Response } from 'express';
import type { Doc, UpdateSpec } from '../db/model';
import type { ConversationDoc } from '../models/Conversation';
import type { InboxScope } from '../db/inboxQueries';

const router = express.Router();

router.use(auth, requireOrganization);

/** What the inbox needs populated on every conversation it renders. */
const AGENT_FIELDS = 'name avatar status';
const DEPARTMENT_FIELDS = 'name color icon';

/** How many messages one request may pull from a thread. */
const DEFAULT_MESSAGE_LIMIT = 100;
const MAX_MESSAGE_LIMIT = 200;
const MAX_SEARCH_LENGTH = 120;
const MAX_NOTE_LENGTH = 5000;
const MAX_ASSIGNED_PAGE = 100;

/** Adds the populated relations the panel renders a conversation row from. */
function withRelations<T extends { populate(path: string, select?: string): T }>(query: T): T {
  return query.populate('assignedAgent', AGENT_FIELDS).populate('department', DEPARTMENT_FIELDS);
}

/**
 * The conversation plus the last message on it, as the list endpoints return it.
 *
 * Both list handlers built this by hand with their own `try { calculateSLA() }`
 * and their own `lastMessages.get(...) || null`.
 */
function asListRow(conversation: Doc<ConversationDoc>, lastMessages: Map<string, unknown>) {
  return { ...conversation.toObject(), lastMessage: lastMessages.get(conversation._id) || null };
}

/**
 * An agent in this organization who is allowed to work on this site, with the
 * table they came from.
 *
 * An account can be a Team row or a User row and both can own a conversation,
 * so the caller needs to know which model to increment counters on.
 */
async function findOrganizationAgent(agentId: unknown, organizationId: string, siteId?: unknown) {
  if (!agentId) return null;
  const teamAgent = await Team.findOne({ _id: agentId, organizationId, isActive: true });
  const agent = teamAgent ?? (await User.findOne({ _id: agentId, organizationId, isActive: true }));
  if (!agent) return null;

  // An empty list means "every site"; a non-empty one restricts them.
  const assignedSites = (agent.assignedSites || []).map(String);
  if (assignedSites.length > 0 && !assignedSites.includes(String(siteId))) return null;

  return { agent, Model: teamAgent ? Team : User };
}

/** A string query parameter, or null when it is absent or not a string. */
const queryString = (value: unknown): string | null => (typeof value === 'string' ? value : null);

// ----------------------------------------------------------------- the inbox

router.get(
  '/unread-count',
  asyncHandler(async (req: Request, res: Response) => {
    // Summed by the database rather than by loading every conversation.
    res.json(await unreadCountsByOrganization(orgId(req)));
  })
);

router.get(
  '/:siteId',
  asyncHandler(async (req: Request, res: Response) => {
    const site = await loadOwnedSite(req, req.params.siteId);
    const organizationId = orgId(req);

    // Search and filters run in the database. The panel used to apply them in the
    // browser, which only ever scanned the page already loaded — a conversation
    // that had not been fetched could not be found by any search.
    const search = queryString(req.query.search)?.trim().slice(0, MAX_SEARCH_LENGTH) ?? '';

    const departmentId = queryString(req.query.departmentId);
    if (departmentId && departmentId !== 'none') requireObjectId(departmentId, 'department id');

    const assignedTo = queryString(req.query.assignedTo);
    const assignedAgentId = assignedTo && assignedTo !== 'unassigned' ? assignedTo : null;
    if (assignedAgentId) requireObjectId(assignedAgentId, 'agent id');

    // Message-content matches are resolved once and shared by the page and the
    // counts; searching twice would repeat the same scan.
    const searchMessageMatches = search ? await messageMatchesForSearch(site._id, search) : [];

    const filters: InboxScope = {
      organizationId,
      siteId: site._id,
      status: queryString(req.query.status),
      priority: queryString(req.query.priority),
      departmentId,
      assignedAgentId,
      unassigned: assignedTo === 'unassigned',
      search,
      searchMessageMatches
    };

    const [page, counts] = await Promise.all([
      listConversations({
        ...filters,
        limit: queryString(req.query.limit) ?? undefined,
        cursor: queryString(req.query.cursor)
      }),
      // Counts are only needed for the first page; on later pages the tab
      // headings are already on screen and recounting is wasted work.
      req.query.cursor ? Promise.resolve(null) : conversationCounts(filters)
    ]);

    // Rows come back from hand-written SQL; the model turns them into the shape
    // the panel expects, virtuals and all. `hydrate` is declared loosely because
    // it serves every model, so the result is named at its one known type here
    // rather than staying `any` all the way into the response.
    const conversations = page.rows.map(
      (row) => Conversation.$model.hydrate(row) as Doc<ConversationDoc>
    );
    await Conversation.$model.populateDocuments(conversations, [
      { path: 'assignedAgent', select: AGENT_FIELDS },
      { path: 'department', select: DEPARTMENT_FIELDS }
    ]);

    // Display only — nothing is written back. See services/slaSweeper.ts.
    refreshSlaAll(conversations);
    const lastMessages = await latestMessagesByConversation(conversations.map((c) => c._id));

    res.json({
      conversations: conversations.map((c) => asListRow(c, lastMessages)),
      hasMore: page.hasMore,
      nextCursor: page.nextCursor,
      ...(counts ? { counts } : {})
    });
  })
);

router.get(
  '/assigned/me',
  asyncHandler(async (req: Request, res: Response) => {
    const conversations = await withRelations(
      Conversation.find({ assignedAgent: req.userId, organizationId: orgId(req) })
    )
      .sort({ lastMessageAt: -1 })
      .limit(MAX_ASSIGNED_PAGE);

    refreshSlaAll(conversations);
    const lastMessages = await latestMessagesByConversation(conversations.map((c) => c._id));

    res.json({ conversations: conversations.map((c) => asListRow(c, lastMessages)) });
  })
);

router.get(
  '/:siteId/:conversationId',
  asyncHandler(async (req: Request, res: Response) => {
    const site = await loadOwnedSite(req, req.params.siteId);
    const conversationId = requireObjectId(req.params.conversationId, 'conversation id');

    const conversation = await withRelations(
      Conversation.findOne({ _id: conversationId, siteId: site._id, organizationId: orgId(req) })
    );
    if (!conversation) throw notFound('Conversation');

    refreshSla(conversation);
    await conversation.save();

    // A long-running support thread can reach thousands of messages; fetching all
    // of them on every open locks up both the server and the browser. The newest
    // page is taken and flipped back into chronological order.
    const limit = Math.min(
      parseInt(String(req.query.limit), 10) || DEFAULT_MESSAGE_LIMIT,
      MAX_MESSAGE_LIMIT
    );
    const newestFirst = await Message.find({ conversationId: conversation._id })
      .sort({ createdAt: -1 })
      .limit(limit + 1);

    const hasMore = newestFirst.length > limit;
    const messages = newestFirst.slice(0, limit).reverse();

    await Message.updateMany(
      { conversationId: conversation._id, senderType: 'visitor', isRead: false },
      { isRead: true, readAt: new Date() }
    );
    conversation.unreadCount = 0;
    await conversation.save();

    notifyAdmin(req)?.messagesRead(site._id, conversation._id);

    res.json({ conversation, messages, hasMore });
  })
);

// ---------------------------------------------------------------- assignment

router.put(
  '/:conversationId/assign',
  asyncHandler(async (req: Request, res: Response) => {
    const { agentId } = req.body;
    const organizationId = orgId(req);
    const conversation = await loadOwnedConversation(req, req.params.conversationId);

    // Assigning to somebody else, or taking somebody else's conversation, needs
    // `assign_tickets` (owner/admin/manager). An agent without it may only pick
    // up an unassigned conversation or put their own down — they cannot close a
    // colleague's thread or push work onto them.
    if (!hasPermission(req.user.role, 'assign_tickets')) {
      const self = String(req.userId);
      const current = conversation.assignedAgent ? String(conversation.assignedAgent) : null;
      const takingUnassigned = !current && agentId && String(agentId) === self;
      const releasingOwn = current === self && !agentId;
      if (!takingUnassigned && !releasingOwn) {
        throw forbidden('You cannot reassign this conversation');
      }
    }

    const target = agentId
      ? await findOrganizationAgent(agentId, organizationId, conversation.siteId)
      : null;
    if (agentId && !target) throw notFound('Agent');

    const previousAgentId = conversation.assignedAgent;
    const update: UpdateSpec = {
      assignedAgent: agentId || null,
      assignedBy: req.userId,
      status: agentId ? 'assigned' : 'unassigned',
      assignedAt: agentId ? new Date() : null
    };

    const updated = await withRelations(
      Conversation.findByIdAndUpdate(conversation._id, update, { new: true })
    );

    const changed = String(previousAgentId || '') !== String(agentId || '');
    if (changed) {
      if (previousAgentId) await updateAgentLoad(previousAgentId, -1);
      if (agentId) {
        await updateAgentLoad(agentId, 1);
        await recordAgentAssignment(target!.Model, agentId, organizationId);
      }
    }

    const notifier = notifyAdmin(req);
    if (agentId) notifier?.conversationAssigned(conversation, agentId, req.userId);
    notifier?.conversationUpdated(conversation, updated);

    res.json({ conversation: updated });
  })
);

router.put(
  '/:conversationId/claim',
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = orgId(req);
    const agentId = req.userId;
    const conversation = await loadOwnedConversation(req, req.params.conversationId);

    if (conversation.assignedAgent) throw conflict('Conversation is already assigned');

    const target = await findOrganizationAgent(agentId, organizationId, conversation.siteId);
    if (!target) throw notFound('Agent');

    const { agent, Model } = target;
    if (agent.status !== 'online') {
      throw conflict('Agent must be online to claim conversations');
    }

    // Only a Team row carries the load counters; a User account falls back to the
    // same defaults the check has always used.
    const currentLoad = ('currentLoad' in agent ? agent.currentLoad : undefined) || 0;
    const maxCapacity = ('maxCapacity' in agent ? agent.maxCapacity : undefined) || 10;
    if (currentLoad >= maxCapacity) throw conflict('Agent has reached maximum capacity');

    // The ownership test and the write happen in one UPDATE, so two agents
    // clicking at the same moment cannot both win.
    const claimed = await withRelations(
      Conversation.findOneAndUpdate(
        {
          _id: conversation._id,
          organizationId,
          assignedAgent: null,
          status: { $in: ['open', 'unassigned', 'pending'] }
        },
        { assignedAgent: agentId, assignedBy: agentId, assignedAt: new Date(), status: 'assigned' },
        { new: true }
      )
    );
    if (!claimed) throw conflict('Conversation was claimed by another agent');

    await updateAgentLoad(agentId, 1);
    await recordAgentAssignment(Model, agentId, organizationId);

    const notifier = notifyAdmin(req);
    notifier?.conversationClaimed(claimed, agentId);
    notifier?.conversationUpdated(claimed, claimed);

    res.json({ conversation: claimed });
  })
);

// ------------------------------------------------------------------- routing

router.put(
  '/:conversationId/department',
  asyncHandler(async (req: Request, res: Response) => {
    const { departmentId } = req.body;
    const conversation = await loadOwnedConversation(req, req.params.conversationId);

    if (departmentId) {
      // The department has to belong to this conversation's own site, not merely
      // to the caller's organization.
      const department = await Department.findOne({
        _id: departmentId,
        siteId: conversation.siteId,
        isActive: true
      });
      if (!department) throw notFound('Department');
    }

    const previousDepartmentId = conversation.department;
    const updated = await withRelations(
      Conversation.findByIdAndUpdate(
        conversation._id,
        { department: departmentId || null },
        { new: true }
      )
    );

    await recordDepartmentChange(conversation, previousDepartmentId, departmentId || null, {
      wasActive: isActiveConversationStatus(conversation.status)
    });

    const notifier = notifyAdmin(req);
    notifier?.conversationDepartmentChanged(conversation, departmentId);
    notifier?.conversationUpdated(conversation, updated);

    res.json({ conversation: updated });
  })
);

router.put(
  '/:conversationId/priority',
  asyncHandler(async (req: Request, res: Response) => {
    const { priority } = req.body;
    if (!isPriority(priority))
      throw badRequest(`priority must be one of: ${PRIORITIES.join(', ')}`);

    const conversation = await withRelations(
      Conversation.findOne({
        _id: requireObjectId(req.params.conversationId, 'conversation id'),
        organizationId: orgId(req)
      })
    ).populate('department');
    if (!conversation) throw notFound('Conversation');

    conversation.priority = priority;
    // The department's policy wins when it has one; otherwise the product
    // defaults apply. Both call sites used to spell this table out by hand.
    Object.assign(conversation.sla, slaTargetsFor(priority, conversation.department?.sla));

    refreshSla(conversation);
    await conversation.save();

    notifyAdmin(req)?.conversationUpdated(conversation, conversation);
    res.json({ conversation });
  })
);

router.post(
  '/:conversationId/notes',
  asyncHandler(async (req: Request, res: Response) => {
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
    if (!note || note.length > MAX_NOTE_LENGTH) {
      throw badRequest(`Note must be between 1 and ${MAX_NOTE_LENGTH} characters`);
    }

    const conversation = await loadOwnedConversation(req, req.params.conversationId);
    conversation.internalNotes.push({ userId: req.userId, note, createdAt: new Date() });
    await conversation.save();
    await conversation.populate('internalNotes.userId', 'name avatar');

    res.json({ conversation });
  })
);

// -------------------------------------------------------------------- status

router.put(
  '/:conversationId/status',
  asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.body;
    if (!isConversationStatus(status)) {
      throw badRequest(`status must be one of: ${CONVERSATION_STATUSES.join(', ')}`);
    }

    const organizationId = orgId(req);
    const conversation = await Conversation.findOne({
      _id: requireObjectId(req.params.conversationId, 'conversation id'),
      organizationId
    }).populate('department');
    if (!conversation) throw notFound('Conversation');

    const previousStatus = conversation.status;
    const wasActive = isActiveConversationStatus(previousStatus);
    const willBeActive = isActiveConversationStatus(status);

    // An agent's load follows the conversation in and out of the active set.
    if (conversation.assignedAgent && wasActive !== willBeActive) {
      await updateAgentLoad(conversation.assignedAgent, willBeActive ? 1 : -1);
    }

    conversation.status = status;

    if (status === 'closed') {
      conversation.closedAt = new Date();
    } else if (status === 'resolved') {
      conversation.resolvedAt = new Date();
      refreshSla(conversation);
      if (wasActive) {
        // The same rollup the socket handler performs; see
        // services/departmentStats.ts for why it is not written out twice.
        await recordResolution(conversation);
        await recordAgentResolution(conversation.assignedAgent);
      }
    }

    await conversation.save();
    await conversation.populate('assignedAgent', AGENT_FIELDS);

    const notifier = notifyAdmin(req);
    notifier?.conversationUpdated(conversation, conversation);
    if (status === 'resolved') notifier?.conversationResolved(conversation, conversation);

    emitStatusEvent(req, conversation, previousStatus, status);

    res.json({ conversation });
  })
);

/**
 * Records a close or a reopen in the audit trail.
 *
 * Isolated from the request it follows: the status change is already committed,
 * so a failure here must not turn a successful write into an error response.
 * The reason is logged rather than discarded.
 */
function emitStatusEvent(
  req: Request,
  conversation: Doc<ConversationDoc>,
  previousStatus: string,
  status: string
): void {
  const name =
    status === 'closed' ? 'ticket.closed' : previousStatus === 'closed' ? 'ticket.reopened' : null;
  if (!name) return;

  try {
    events.emit(name, {
      organizationId: orgId(req),
      userId: req.user?._id ?? null,
      entityId: conversation._id,
      metadata: { previousStatus },
      ip: req.ip,
      ua: req.get('user-agent')
    });
  } catch (error) {
    console.error(`[conversations] could not emit ${name}`, error);
  }
}

// ------------------------------------------------------------------ deletion

// Deletes a conversation and its messages for good. Any signed-in agent could
// once do this; erasing customer data and its audit trail is an admin's call.
router.delete(
  '/:siteId/:conversationId',
  checkPermission('manage_operations'),
  asyncHandler(async (req: Request, res: Response) => {
    const site = await loadOwnedSite(req, req.params.siteId);
    const conversationId = requireObjectId(req.params.conversationId, 'conversation id');

    const conversation = await Conversation.findOne({
      _id: conversationId,
      siteId: site._id,
      organizationId: orgId(req)
    });
    if (!conversation) throw notFound('Conversation');

    if (conversation.assignedAgent && isActiveConversationStatus(conversation.status)) {
      // Only release the agent's slot if the conversation was actually holding
      // one; decrementing for an already-closed thread drove the counter
      // negative.
      await updateAgentLoad(conversation.assignedAgent, -1);
    }

    await Message.deleteMany({ conversationId });
    await Conversation.findByIdAndDelete(conversationId);

    notifyAdmin(req)?.conversationDeleted(site._id, conversationId);
    res.json({ message: 'Conversation deleted successfully' });
  })
);

export default router;
