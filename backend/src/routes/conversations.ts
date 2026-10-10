// The inbox: listing conversations, reading one, and the moves an agent makes
// on it (assign, claim, route to a department, reprioritise, resolve, delete),
// one at a time or several at once, plus tags, snoozing and merging (PRD-07).
//
// Two rules hold throughout:
//
//   * The tenant filter is inside the query, never a comparison afterwards.
//     Loading a row and then checking its organization skipped the check
//     entirely whenever the id being compared was empty.
//   * Reads do not write. SLA clocks are recomputed in memory for display; the
//     persistent update happens in services/slaSweeper.ts, so opening an inbox
//     no longer issues fifty UPDATEs.

import { takeOver } from '../services/assistant';
import express from 'express';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import Team from '../models/Team';
import User from '../models/User';
import Department from '../models/Department';
import { auth } from '../middleware/auth';
import { checkPermission, hasPermission, seatPermits, SEAT_SUSPENDED } from '../middleware/rbac';
import { withTransaction } from '../db/pool';
import { ensureTags, tagName } from './conversationTags';
import { setConversationStatus } from '../services/conversationStatus';
import events from '../events';
import {
  latestMessagesByConversation,
  messagesPage,
  unreadCountsByOrganization
} from '../db/queries';
import { listConversations, conversationCounts, messageMatchesForSearch } from '../db/inboxQueries';
import { updateAgentLoad } from '../services/autoAssignment';
import { deleteConversations } from '../services/dataRetention';
import { refreshSla, refreshSlaAll } from '../services/conversationSla';
import { recordAgentAssignment, recordDepartmentChange } from '../services/departmentStats';
import {
  CONVERSATION_STATUSES,
  PRIORITIES,
  isActiveConversationStatus,
  isConversationStatus,
  isPriority,
  slaTargetsFor
} from '../domain';
import { WidgetNotifier, ioFrom, notifyAdmin } from '../realtime';
import {
  asyncHandler,
  badRequest,
  conflict,
  forbidden,
  HttpError,
  loadAccessibleConversation,
  loadAccessibleSite,
  notFound,
  orgId,
  requireObjectId,
  requireOrganization,
  restrictedSiteIds,
  mayAccessSite
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
const MAX_TAGS_PER_CONVERSATION = 10;
/** A snooze longer than this is a closed conversation in disguise. */
const MAX_SNOOZE_DAYS = 90;
/** Conversations one bulk request may change. */
const MAX_BULK = 100;

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

  if (!mayAccessSite(agent.role, agent.assignedSites, siteId)) return null;

  return { agent, Model: teamAgent ? Team : User };
}

/** A string query parameter, or null when it is absent or not a string. */
const queryString = (value: unknown): string | null => (typeof value === 'string' ? value : null);

// ----------------------------------------------------------------- the inbox

router.get(
  '/unread-count',
  asyncHandler(async (req: Request, res: Response) => {
    // Summed by the database rather than by loading every conversation. A
    // caller restricted to some sites sees only theirs, total included.
    const counts = await unreadCountsByOrganization(orgId(req));
    const only = restrictedSiteIds(req);
    if (!only) {
      res.json(counts);
      return;
    }
    const unreadBySite = Object.fromEntries(
      Object.entries(counts.unreadBySite).filter(([siteId]) => only.has(siteId))
    );
    const totalUnreadCount = Object.values(unreadBySite).reduce((sum, n) => sum + n, 0);
    res.json({ totalUnreadCount, unreadBySite });
  })
);

router.get(
  '/:siteId',
  asyncHandler(async (req: Request, res: Response) => {
    const site = await loadAccessibleSite(req, req.params.siteId);
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
      searchMessageMatches,
      tag: queryString(req.query.tag)?.trim() || null,
      // The snoozed view lists only them; every other view leaves them out.
      snoozed: req.query.view === 'snoozed' ? 'only' : 'hide'
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
    const site = await loadAccessibleSite(req, req.params.siteId);
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

    const readAt = new Date();
    const read = await Message.updateMany(
      { conversationId: conversation._id, senderType: 'visitor', isRead: false },
      { isRead: true, readAt }
    );
    // The visitor sees "seen" under their messages (UX-04).
    if (read.modifiedCount) {
      const io = ioFrom(req);
      if (io) new WidgetNotifier(io).messagesSeen(conversation._id, readAt);
    }
    conversation.unreadCount = 0;
    await conversation.save();

    notifyAdmin(req)?.messagesRead(site._id, conversation._id);

    res.json({ conversation, messages, hasMore });
  })
);

/**
 * A page of one conversation around a message the panel already has:
 * `?after=<id>` for what it missed while its socket was down, `?before=<id>`
 * to scroll back. See db/queries.ts#messagesPage.
 */
router.get(
  '/:siteId/:conversationId/messages',
  asyncHandler(async (req: Request, res: Response) => {
    const site = await loadAccessibleSite(req, req.params.siteId);
    const conversationId = requireObjectId(req.params.conversationId, 'conversation id');
    const conversation = await Conversation.findOne({
      _id: conversationId,
      siteId: site._id,
      organizationId: orgId(req)
    });
    if (!conversation) throw notFound('Conversation');

    res.json(
      await messagesPage(conversation._id, {
        after: req.query.after,
        before: req.query.before,
        limit: req.query.limit
      })
    );
  })
);

/**
 * Gives a conversation to an agent, or puts it back in the queue (agentId
 * empty), with the load counters, the audit entry and the broadcasts. The
 * single route and the bulk one both come here.
 */
async function assignConversation(
  req: Request,
  conversation: Doc<ConversationDoc>,
  agentId: unknown
): Promise<Doc<ConversationDoc> | null> {
  const organizationId = orgId(req);
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
    events.emit('conversation.assigned', {
      organizationId,
      userId: req.user?._id ?? null,
      entityId: conversation._id,
      metadata: { from: previousAgentId ? String(previousAgentId) : null, to: agentId || null },
      ip: req.ip,
      ua: req.get('user-agent')
    });
  }

  const notifier = notifyAdmin(req);
  if (agentId) notifier?.conversationAssigned(conversation, agentId, req.userId);
  notifier?.conversationUpdated(conversation, updated);

  return updated;
}

// ---------------------------------------------------------------- assignment

// Every write below needs a role that may work conversations at all; a viewer
// reads and nothing more. The finer rules (who may move work between agents)
// follow inside each handler. The socket handlers apply the same table.
router.put(
  '/:conversationId/assign',
  checkPermission('respond'),
  asyncHandler(async (req: Request, res: Response) => {
    const conversation = await loadAccessibleConversation(req, req.params.conversationId);
    res.json({ conversation: await assignConversation(req, conversation, req.body?.agentId) });
  })
);

router.put(
  '/:conversationId/claim',
  checkPermission('respond'),
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = orgId(req);
    const agentId = req.userId;
    const conversation = await loadAccessibleConversation(req, req.params.conversationId);

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

// An agent takes the conversation from the FAQ assistant: from now on a
// person answers. Writing a reply does the same (socket handler); this is the
// panel's "Devral" button for taking over before writing.
router.put(
  '/:conversationId/take-over',
  checkPermission('respond'),
  asyncHandler(async (req: Request, res: Response) => {
    const conversation = await loadAccessibleConversation(req, req.params.conversationId);
    await takeOver(ioFrom(req), conversation);
    res.json({ responseOwner: 'human' });
  })
);

// ------------------------------------------------------------------- routing

router.put(
  '/:conversationId/department',
  checkPermission('assign_tickets'),
  asyncHandler(async (req: Request, res: Response) => {
    const { departmentId } = req.body;
    const conversation = await loadAccessibleConversation(req, req.params.conversationId);

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
  checkPermission('update_status'),
  asyncHandler(async (req: Request, res: Response) => {
    const { priority } = req.body;
    if (!isPriority(priority))
      throw badRequest(`priority must be one of: ${PRIORITIES.join(', ')}`);

    const conversation = await loadAccessibleConversation(req, req.params.conversationId);
    await conversation.populate('department');
    await conversation.populate('assignedAgent', AGENT_FIELDS);

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
  checkPermission('respond'),
  asyncHandler(async (req: Request, res: Response) => {
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
    if (!note || note.length > MAX_NOTE_LENGTH) {
      throw badRequest(`Note must be between 1 and ${MAX_NOTE_LENGTH} characters`);
    }

    const conversation = await loadAccessibleConversation(req, req.params.conversationId);
    conversation.internalNotes.push({ userId: req.userId, note, createdAt: new Date() });
    await conversation.save();
    await conversation.populate('internalNotes.userId', 'name avatar');

    res.json({ conversation });
  })
);

/** The panel's status change: services/conversationStatus.ts, with the caller as the actor. */
async function changeStatus(
  req: Request,
  conversation: Doc<ConversationDoc>,
  status: ConversationDoc['status']
): Promise<Doc<ConversationDoc>> {
  return setConversationStatus(ioFrom(req), conversation, status, {
    organizationId: orgId(req),
    userId: req.user?._id ? String(req.user._id) : null,
    ip: req.ip,
    ua: req.get('user-agent')
  });
}

// -------------------------------------------------------------------- status

router.put(
  '/:conversationId/status',
  checkPermission('update_status'),
  asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.body;
    if (!isConversationStatus(status)) {
      throw badRequest(`status must be one of: ${CONVERSATION_STATUSES.join(', ')}`);
    }

    const conversation = await loadAccessibleConversation(req, req.params.conversationId);
    res.json({ conversation: await changeStatus(req, conversation, status) });
  })
);

// --------------------------------------------------------------------- tags

/**
 * Sets a conversation's tags. Names new to the organization join its tag
 * list on the way (any agent may coin one); names it knows keep the list's
 * spelling, so "İade" and "iade" are one tag.
 */
async function setTags(
  req: Request,
  conversation: Doc<ConversationDoc>,
  requested: unknown
): Promise<Doc<ConversationDoc> | null> {
  if (!Array.isArray(requested)) throw badRequest('tags must be a list of names');
  const names: string[] = [];
  for (const value of requested) {
    const name = tagName(value);
    if (!name) throw badRequest('A tag is 1-32 letters, digits, spaces, - or _');
    names.push(name);
  }
  // Refused before anything is added to the organization's list.
  if (new Set(names).size > MAX_TAGS_PER_CONVERSATION) {
    throw badRequest(`A conversation carries at most ${MAX_TAGS_PER_CONVERSATION} tags`);
  }
  // The catalog's spelling, so "kargo" and "Kargo" end up as one tag.
  const spelling = await ensureTags(orgId(req), [...new Set(names)]);
  const tags = [...new Set(names.map((n) => spelling.get(n) ?? n))];

  const updated = await withRelations(
    Conversation.findByIdAndUpdate(conversation._id, { tags }, { new: true })
  );
  notifyAdmin(req)?.conversationUpdated(conversation, updated);
  return updated;
}

router.put(
  '/:conversationId/tags',
  checkPermission('respond'),
  asyncHandler(async (req: Request, res: Response) => {
    const conversation = await loadAccessibleConversation(req, req.params.conversationId);
    res.json({ conversation: await setTags(req, conversation, req.body?.tags) });
  })
);

// ------------------------------------------------------------------ snooze

/** The time a snooze ends, from the request; null lifts it. */
function snoozeUntil(value: unknown): Date | null {
  if (value === null) return null;
  const at = typeof value === 'string' ? new Date(value) : null;
  if (!at || Number.isNaN(at.getTime())) throw badRequest('until is a date and time, or null');
  const now = Date.now();
  if (at.getTime() <= now + 60_000) throw badRequest('The snooze must end in the future');
  if (at.getTime() > now + MAX_SNOOZE_DAYS * 24 * 60 * 60 * 1000) {
    throw badRequest(`A conversation can be snoozed for at most ${MAX_SNOOZE_DAYS} days`);
  }
  return at;
}

/**
 * Hides an open conversation from the inbox until the given time; the sweep
 * brings it back (services/slaSweeper.ts), and so does a new message from the
 * visitor (socket/handlers/widget.ts).
 */
async function snoozeConversation(
  req: Request,
  conversation: Doc<ConversationDoc>,
  until: Date | null
): Promise<Doc<ConversationDoc> | null> {
  if (until && !isActiveConversationStatus(conversation.status)) {
    throw conflict('Only an open conversation can be snoozed', 'NOT_ACTIVE');
  }
  const updated = await withRelations(
    Conversation.findByIdAndUpdate(conversation._id, { snoozedUntil: until }, { new: true })
  );
  notifyAdmin(req)?.conversationUpdated(conversation, updated);
  return updated;
}

router.put(
  '/:conversationId/snooze',
  checkPermission('update_status'),
  asyncHandler(async (req: Request, res: Response) => {
    const until = snoozeUntil(req.body?.until);
    const conversation = await loadAccessibleConversation(req, req.params.conversationId);
    res.json({ conversation: await snoozeConversation(req, conversation, until) });
  })
);

// ------------------------------------------------------------------- merge

/**
 * Two conversations the same visitor started — the same browser, and the same
 * signed-in customer if the site identifies them. Merging anyone else's would
 * show one visitor's messages to another in the widget.
 */
function sameVisitor(a: Doc<ConversationDoc>, b: Doc<ConversationDoc>): boolean {
  const holder = (c: Doc<ConversationDoc>) =>
    typeof c.metadata?.verifiedUserId === 'string' ? c.metadata.verifiedUserId : null;
  return a.visitorId === b.visitorId && holder(a) === holder(b);
}

/** The visitor's other conversations on this site that this one could be merged into. */
router.get(
  '/:siteId/:conversationId/merge-candidates',
  asyncHandler(async (req: Request, res: Response) => {
    const site = await loadAccessibleSite(req, req.params.siteId);
    const conversationId = requireObjectId(req.params.conversationId, 'conversation id');
    const conversation = await Conversation.findOne({
      _id: conversationId,
      siteId: site._id,
      organizationId: orgId(req)
    });
    if (!conversation) throw notFound('Conversation');

    const others = await Conversation.find({
      siteId: site._id,
      organizationId: orgId(req),
      visitorId: conversation.visitorId,
      mergedIntoId: null,
      _id: { $ne: conversation._id }
    })
      .sort({ lastMessageAt: -1 })
      .limit(20);
    res.json({
      conversations: others
        .filter((c) => sameVisitor(c, conversation))
        .map((c) => ({
          _id: c._id,
          ticketId: c.ticketId,
          status: c.status,
          lastMessageAt: c.lastMessageAt,
          createdAt: c.createdAt
        }))
    });
  })
);

/**
 * Moves every message and note of this conversation into another one of the
 * same visitor, then closes this one with a pointer to where it went. The
 * visitor's widget follows on its next message (socket/handlers/widget.ts).
 */
router.post(
  '/:conversationId/merge',
  checkPermission('update_status'),
  asyncHandler(async (req: Request, res: Response) => {
    const source = await loadAccessibleConversation(req, req.params.conversationId);
    const target = await loadAccessibleConversation(req, req.body?.intoId);
    if (source._id === target._id) throw badRequest('A conversation cannot be merged into itself');
    if (String(source.siteId) !== String(target.siteId)) {
      throw badRequest('Only conversations of the same site can be merged');
    }
    if (!sameVisitor(source, target)) {
      throw new HttpError(
        400,
        'Only conversations of the same visitor can be merged',
        'NOT_SAME_VISITOR'
      );
    }

    const wasActive = isActiveConversationStatus(source.status);
    await withTransaction(async (client) => {
      // Both rows locked in a fixed order; a second merge of either waits and
      // then finds it already merged.
      const { rows } = await client.query<{ id: string; merged_into_id: string | null }>(
        'SELECT id, merged_into_id FROM conversations WHERE id = ANY($1) ORDER BY id FOR UPDATE',
        [[source._id, target._id]]
      );
      if (rows.length !== 2 || rows.some((r) => r.merged_into_id)) {
        throw conflict('This conversation was already merged', 'ALREADY_MERGED');
      }
      for (const table of ['messages', 'conversation_internal_notes', 'assistant_feedback']) {
        // eslint-disable-next-line no-await-in-loop -- one transaction, one client
        await client.query(`UPDATE ${table} SET conversation_id = $1 WHERE conversation_id = $2`, [
          target._id,
          source._id
        ]);
      }
      await client.query(
        `UPDATE conversations t
            SET last_message_at = GREATEST(t.last_message_at, s.last_message_at),
                unread_count = t.unread_count + s.unread_count,
                tags = ARRAY(SELECT DISTINCT unnest(t.tags || s.tags)),
                updated_at = now()
           FROM conversations s
          WHERE t.id = $1 AND s.id = $2`,
        [target._id, source._id]
      );
      await client.query(
        `UPDATE conversations
            SET status = 'closed', closed_at = coalesce(closed_at, now()),
                merged_into_id = $2, unread_count = 0, snoozed_until = NULL,
                updated_at = now()
          WHERE id = $1`,
        [source._id, target._id]
      );
    });

    if (wasActive && source.assignedAgent) await updateAgentLoad(source.assignedAgent, -1);
    events.emit('conversation.merged', {
      organizationId: orgId(req),
      userId: req.user?._id ?? null,
      entityId: target._id,
      metadata: { merged: source._id, into: target._id },
      ip: req.ip,
      ua: req.get('user-agent')
    });

    const [closed, merged] = await Promise.all([
      withRelations(Conversation.findById(source._id)),
      withRelations(Conversation.findById(target._id))
    ]);
    const notifier = notifyAdmin(req);
    if (closed) notifier?.conversationUpdated(closed, closed);
    if (merged) notifier?.conversationUpdated(merged, merged);
    res.json({ conversation: merged });
  })
);

// -------------------------------------------------------------------- bulk

const BULK_ACTIONS = ['status', 'assign', 'tag', 'snooze'] as const;
type BulkAction = (typeof BULK_ACTIONS)[number];

/** The permission each bulk action needs, as its single route does. */
const BULK_PERMISSION: Record<BulkAction, string> = {
  status: 'update_status',
  assign: 'respond',
  tag: 'respond',
  snooze: 'update_status'
};

/**
 * The same move on several conversations of the inbox: close, assign, tag or
 * snooze. Each one goes through the single route's own rules — a conversation
 * the caller may not touch fails alone and the rest go ahead; the answer says
 * which.
 */
router.post(
  '/bulk',
  checkPermission('respond'),
  asyncHandler(async (req: Request, res: Response) => {
    const action = req.body?.action as BulkAction;
    if (!BULK_ACTIONS.includes(action)) {
      throw badRequest(`action must be one of: ${BULK_ACTIONS.join(', ')}`);
    }
    const permission = BULK_PERMISSION[action];
    if (!hasPermission(req.user.role, permission)) {
      throw forbidden(`Insufficient role permissions: '${permission}' required`);
    }
    if (!seatPermits(Boolean(req.user?.seatSuspendedAt), permission)) {
      throw forbidden(
        'Your seat is over the plan limit; you can read but not make changes',
        SEAT_SUSPENDED
      );
    }

    const ids: unknown = req.body?.conversationIds;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_BULK) {
      throw badRequest(`conversationIds is a list of 1-${MAX_BULK} ids`);
    }

    // Checked once, before anything changes.
    const status = req.body?.status;
    if (action === 'status' && !isConversationStatus(status)) {
      throw badRequest(`status must be one of: ${CONVERSATION_STATUSES.join(', ')}`);
    }
    const tag = action === 'tag' ? tagName(req.body?.tag) : null;
    if (action === 'tag' && !tag) throw badRequest('A tag is 1-32 letters, digits, spaces, - or _');
    const until = action === 'snooze' ? snoozeUntil(req.body?.until) : null;

    const one = async (id: string): Promise<{ id: string; ok: boolean; code?: string }> => {
      try {
        const conversation = await loadAccessibleConversation(req, id);
        if (action === 'status') await changeStatus(req, conversation, status);
        else if (action === 'assign')
          await assignConversation(req, conversation, req.body?.agentId);
        else if (action === 'tag') {
          await setTags(req, conversation, [...(conversation.tags || []), tag]);
        } else await snoozeConversation(req, conversation, until);
        return { id, ok: true };
      } catch (error) {
        if (!(error instanceof HttpError)) throw error;
        return { id, ok: false, code: error.code };
      }
    };

    const results: Array<{ id: string; ok: boolean; code?: string }> = [];
    for (const id of [...new Set(ids.map(String))]) {
      // One after another: an agent's load and the audit trail follow the
      // order, and two moves never race on the same counters.
      // eslint-disable-next-line no-await-in-loop
      results.push(await one(id));
    }
    res.json({ results, changed: results.filter((r) => r.ok).length });
  })
);

// ------------------------------------------------------------------ deletion

// Deletes a conversation and its messages for good. Any signed-in agent could
// once do this; erasing customer data and its audit trail is an admin's call.
router.delete(
  '/:siteId/:conversationId',
  checkPermission('manage_operations'),
  asyncHandler(async (req: Request, res: Response) => {
    const site = await loadAccessibleSite(req, req.params.siteId);
    const conversationId = requireObjectId(req.params.conversationId, 'conversation id');

    const conversation = await Conversation.findOne({
      _id: conversationId,
      siteId: site._id,
      organizationId: orgId(req)
    });
    if (!conversation) throw notFound('Conversation');

    // Messages, notes and the stored attachments go with it; the agent's slot
    // is released only if the conversation was still holding one
    // (services/dataRetention.ts).
    await deleteConversations(orgId(req), [conversationId]);

    notifyAdmin(req)?.conversationDeleted(site._id, conversationId);
    res.json({ message: 'Conversation deleted successfully' });
  })
);

export default router;
