// Internal chat between agents: direct messages and group threads.
//
// Every id in a request body is checked against the caller's organization
// before it is written. Without that, sending another tenant's user id opened a
// direct chat with them, and the member picker listed every account in the
// system rather than the caller's colleagues.

import express from 'express';
import TeamMessage from '../models/TeamMessage';
import TeamChat from '../models/TeamChat';
import Team from '../models/Team';
import User from '../models/User';
import { auth } from '../middleware/auth';
import { resolveChatParticipants, unreadTeamChatCount } from '../db/queries';
import { asyncHandler, badRequest, forbidden, notFound, orgId, requireOrganization } from '../http';
import type { Request, Response } from 'express';
import type { Filter } from '../db/model';
import type { TeamChatPreview } from '../models/TeamChat';

const router = express.Router();

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
const PERSON_FIELDS = 'name email avatar status role';

/** Shown in place of a participant whose account has since been deleted. */
const UNKNOWN_PERSON = { name: 'Unknown', role: 'unknown' };

/**
 * Swaps participant ids for the people behind them.
 *
 * Three handlers each wrote this `.map(...)` with the same fallback object
 * inline. Both account tables are read once for the whole list rather than once
 * per participant.
 */
async function withParticipants<T extends { participants?: unknown }>(chat: T): Promise<T> {
  const ids = (chat.participants as string[] | undefined) ?? [];
  const people = await resolveChatParticipants(ids);
  // The response replaces each id with the person behind it, so the property
  // deliberately changes shape here.
  (chat as { participants: unknown }).participants = ids.map(
    (id) => people.get(id) || { _id: id, ...UNKNOWN_PERSON }
  );
  return chat;
}

/**
 * Whether an id names an active account in this organization.
 *
 * An account can live in either table, so both are checked; the chat routes
 * accept ids from either.
 */
async function belongsToOrganization(id: unknown, organizationId: string): Promise<boolean> {
  if (!id) return false;
  const [asUser, asTeam] = await Promise.all([
    User.findOne({ _id: id, organizationId, isActive: true }),
    Team.findOne({ _id: id, organizationId, isActive: true })
  ]);
  return Boolean(asUser || asTeam);
}

/**
 * When a chat last saw activity, for ordering the list.
 *
 * Falls back to the row's own timestamp for a thread with no messages yet, and
 * to `timestamp` for previews written before the field was renamed.
 */
function lastActivity(chat: { lastMessage?: TeamChatPreview | null; updatedAt?: unknown }): number {
  const at = chat.lastMessage?.createdAt ?? chat.lastMessage?.timestamp ?? chat.updatedAt;
  const time = at ? new Date(at as string | Date).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
}

router.use(auth);

router.get(
  '/chats',
  asyncHandler(async (req: Request, res: Response) => {
    const chats = await TeamChat.find({ participants: req.user._id }).lean();

    // One lookup for every participant across every chat.
    const people = await resolveChatParticipants(chats.flatMap((chat) => chat.participants));
    for (const chat of chats) {
      chat.participants = chat.participants.map(
        (id: string) => people.get(id) || { _id: id, ...UNKNOWN_PERSON }
      );
    }

    chats.sort((a, b) => lastActivity(b) - lastActivity(a));
    res.json(chats);
  })
);

router.post(
  '/chats/direct',
  requireOrganization,
  asyncHandler(async (req: Request, res: Response) => {
    const { targetUserId } = req.body;
    if (!targetUserId) throw badRequest('targetUserId is required');
    if (String(targetUserId) === String(req.user._id)) {
      throw badRequest('Cannot open a chat with yourself');
    }
    if (!(await belongsToOrganization(targetUserId, orgId(req)))) {
      throw notFound('Team member');
    }

    // Sorting the pair makes the id stable whichever side opens the chat, so the
    // same two people never end up with two threads.
    const chatId = [req.user._id, targetUserId].sort().join('_');

    const existing = await TeamChat.findOne({ chatId }).lean();
    const chat =
      existing ??
      (
        await TeamChat.create({
          chatId,
          chatType: 'direct',
          participants: [req.user._id, targetUserId],
          createdBy: req.user._id
        })
      ).toObject();

    res.json(await withParticipants(chat));
  })
);

router.post(
  '/chats/group',
  requireOrganization,
  asyncHandler(async (req: Request, res: Response) => {
    const { name, participantIds } = req.body;
    if (!Array.isArray(participantIds) || participantIds.length === 0) {
      throw badRequest('participantIds must be a non-empty array');
    }
    if (!name || !String(name).trim()) throw badRequest('name is required');

    const organizationId = orgId(req);
    const checked = await Promise.all(
      participantIds.map(async (id) =>
        (await belongsToOrganization(id, organizationId)) ? String(id) : null
      )
    );
    if (checked.some((id) => id === null)) {
      throw notFound('One or more members are not in your organization');
    }

    const chat = await TeamChat.create({
      chatId: `group_${Date.now()}_${req.user._id}`,
      chatType: 'group',
      // Every entry is non-null: the guard above threw otherwise.
      participants: [...new Set([String(req.user._id), ...(checked as string[])])],
      groupName: name,
      createdBy: req.user._id
    });

    res.json(await withParticipants(chat.toObject()));
  })
);

router.get(
  '/chats/:chatId/messages',
  asyncHandler(async (req: Request, res: Response) => {
    const { chatId } = req.params;

    // Messages are readable only by participants. An earlier version put the
    // chat id straight into the query, so anyone who knew — or guessed — an id
    // could read somebody else's thread.
    const chat = await TeamChat.findOne({ chatId });
    if (!chat) throw notFound('Chat');
    if (!(chat.participants || []).some((p) => String(p) === String(req.user._id))) {
      throw forbidden('You are not a participant of this chat');
    }

    const filter: Filter = { chatId };
    if (req.query.before) {
      const cutoff = new Date(String(req.query.before));
      if (Number.isNaN(cutoff.getTime())) throw badRequest('before must be a date');
      filter.createdAt = { $lt: cutoff };
    }

    // Bounded: an unrestricted `limit` pulled an entire thread into memory.
    const pageSize = Math.min(
      Math.max(parseInt(String(req.query.limit ?? ''), 10) || DEFAULT_PAGE_SIZE, 1),
      MAX_PAGE_SIZE
    );

    const messages = await TeamMessage.find(filter).sort({ createdAt: -1 }).limit(pageSize).lean();
    await TeamMessage.updateMany(
      { chatId, readBy: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id } }
    );

    res.json(messages.reverse());
  })
);

router.get(
  '/members',
  asyncHandler(async (req: Request, res: Response) => {
    // Tenant isolation. The old queries were `Team.find({ isActive: true })` and
    // `User.find({})` — no filter at all, so the picker listed every account in
    // every organization. That was both a leak and the reason the same name
    // appeared several times: they were separate rows in different tenants.
    const organizationId = req.organization?._id || req.user.organizationId;
    if (!organizationId) {
      res.json([]);
      return;
    }

    const [teamMembers, users] = await Promise.all([
      Team.find({ isActive: true, organizationId }).select(PERSON_FIELDS).sort({ name: 1 }).lean(),
      User.find({ isActive: true, organizationId }).select(PERSON_FIELDS).sort({ name: 1 }).lean()
    ]);

    // One person can exist in both tables — an owner who was also added as an
    // agent — so the list is de-duplicated by id, and the caller is left out
    // because a chat with yourself is meaningless.
    const seen = new Set<string>([String(req.user._id)]);
    const members = [...users, ...teamMembers].filter((person) => {
      const id = String(person._id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    res.json(members);
  })
);

router.get(
  '/unread',
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ unreadCount: await unreadTeamChatCount(req.user._id) });
  })
);

export default router;
