// The agents an organization invites into its workspace.
//
// Two layers of authorization apply here and they answer different questions:
//
//   checkPermission('manage_users')  may this caller manage the team at all
//   middleware/teamPolicy            *whom* may they manage, and what role may
//                                    they hand out
//
// The first alone let an admin create another admin, demote a peer and delete
// them. Both are needed on every mutating handler.

import express from 'express';
import Team from '../models/Team';
import Conversation from '../models/Conversation';
import Department from '../models/Department';
import { auth } from '../middleware/auth';
import { checkPermission, hasPermission } from '../middleware/rbac';
import {
  isTeamRole,
  canAssignRole,
  canManageMember,
  sanitizePermissions,
  ownedSiteIds,
  ownedDepartments
} from '../middleware/teamPolicy';
import events from '../events';
import { passwordProblem } from '../config/passwords';
import { ACTIVE_CONVERSATION_STATUSES, PRESENCE_STATUSES, isPresenceStatus } from '../domain';
import { notifyAdmin } from '../realtime';
import {
  asyncHandler,
  badRequest,
  conflict,
  forbidden,
  loadOwnedTeamMember,
  notFound,
  orgId,
  requireOrganization
} from '../http';
import { conversationCountsByAgent, agentConversationStats, agentPerformance } from '../db/queries';
import type { Request, Response } from 'express';
import type { Doc, Filter } from '../db/model';
import type { TeamDoc } from '../models/Team';

const router = express.Router();

router.use(auth, requireOrganization);

/** The projections the panel renders a member from; `-password` is not optional. */
const MEMBER_PROJECTION = '-password';
const DEPARTMENT_FIELDS = 'name color';
const SITE_FIELDS = 'name domain';

/**
 * Everything the panel needs to draw a member's row.
 *
 * Typed structurally rather than against one of the model's query classes,
 * because `find*` and `find*AndUpdate` return different chainable types that
 * share these two methods.
 */
interface MemberQuery<T> extends PromiseLike<T> {
  select(projection: string): MemberQuery<T>;
  populate(path: string, select?: string): MemberQuery<T>;
}

function withRelations<T>(query: MemberQuery<T>): MemberQuery<T> {
  return query
    .select(MEMBER_PROJECTION)
    .populate('departments.departmentId', DEPARTMENT_FIELDS)
    .populate('assignedSites', SITE_FIELDS);
}

// ------------------------------------------------------------- own performance

/**
 * The windows this endpoint will report on.
 *
 * Chosen from a fixed set rather than parsed from the query string, so no
 * caller-supplied value ever reaches the SQL interval expression.
 */
const PERFORMANCE_RANGES: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };

// Declared before the "/:id" routes below so "me" is not captured as an id.
router.get(
  '/me/performance',
  asyncHandler(async (req: Request, res: Response) => {
    const range = String(req.query.range || '7d');
    const days = PERFORMANCE_RANGES[range];
    if (!days) {
      throw badRequest(`range must be one of: ${Object.keys(PERFORMANCE_RANGES).join(', ')}`);
    }

    // Scoped to the caller's own id, so an agent only ever reads their own
    // numbers regardless of what they send.
    const performance = await agentPerformance(req.userId, days);
    res.json({ range, days, performance });
  })
);

// --------------------------------------------------------------------- listing

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { siteId } = req.query;
    const query: Filter = { isActive: true, organizationId: orgId(req) };
    if (siteId) query.assignedSites = siteId;

    const members = await Team.find(query)
      .select(MEMBER_PROJECTION)
      .populate('departments.departmentId', DEPARTMENT_FIELDS)
      .sort({ createdAt: -1 });

    // Counted for every member in one grouped query rather than one per row.
    const counts = await conversationCountsByAgent(members.map((m) => m._id));
    res.json(
      members.map((member) => {
        const counted = counts.get(member._id) || {
          activeConversations: 0,
          resolvedConversations: 0
        };
        return {
          ...member.toObject(),
          stats: { ...member.stats, ...counted }
        };
      })
    );
  })
);

router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const member = await withRelations(
      Team.findOne({ _id: req.params.id, organizationId: orgId(req) })
    );
    // The organization filter is inside the query. Loading first and comparing
    // afterwards let a row with an empty organizationId through unchecked.
    if (!member) throw notFound('Team member');
    res.json(member);
  })
);

router.get(
  '/:id/stats',
  asyncHandler(async (req: Request, res: Response) => {
    // This handler used to call `Team.findById(req.params.id)` with no tenant
    // filter at all: any signed-in user could read the workload of any agent in
    // any other organization by guessing an id.
    const member = await loadOwnedTeamMember(req, req.params.id);

    const counted = await agentConversationStats(member._id);
    res.json({
      total: counted.total,
      assigned: counted.assigned,
      pending: counted.pending,
      resolved: counted.resolved,
      closed: counted.closed,
      avgResponseTime: member.stats.averageResponseTime || 0,
      currentLoad: member.stats.activeConversations || 0,
      // The cap a Team row actually carries is `maxCapacity`; `permissions` holds
      // no per-agent limit, so this has always fallen through to the default.
      maxLoad: member.maxCapacity || 10
    });
  })
);

// -------------------------------------------------------------------- creating

router.post(
  '/',
  checkPermission('manage_users'),
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = orgId(req);
    const {
      email,
      password,
      name,
      role = 'agent',
      assignedSites,
      departments,
      permissions
    } = req.body;

    // Role, permissions, sites and departments all arrive in the body; none of
    // them is written without being checked against this organization first.
    if (!isTeamRole(role)) throw badRequest('Invalid role');
    if (!canAssignRole(req.user.role, role)) {
      throw forbidden('You cannot assign this role');
    }

    const passwordIssue = passwordProblem(password);
    if (passwordIssue) throw badRequest(passwordIssue);

    if (
      typeof email !== 'string' ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254
    ) {
      throw badRequest('Invalid email address');
    }
    if (typeof name !== 'string' || !name.trim() || name.length > 100) {
      throw badRequest('Invalid name');
    }

    const cleanPermissions = sanitizePermissions(permissions);
    if (!cleanPermissions) throw badRequest('Invalid permissions');

    const siteIds = await ownedSiteIds(organizationId, assignedSites);
    if (!siteIds) throw badRequest('Unknown site in assignedSites');

    const departmentEntries = await ownedDepartments(organizationId, departments);
    if (!departmentEntries) throw badRequest('Unknown department');

    if (await Team.findOne({ email, isActive: true })) {
      throw conflict('Bu e-posta adresi zaten kullanılıyor');
    }

    const teamMember = new Team({
      email,
      password,
      name,
      role,
      assignedSites: siteIds,
      departments: departmentEntries,
      permissions: cleanPermissions,
      organizationId,
      isActive: true,
      status: 'offline'
    });
    await teamMember.save();

    // The ids were matched against this organization above, so these writes stay
    // inside the tenant.
    await Promise.all(
      departmentEntries.map((dept) =>
        Department.findByIdAndUpdate(dept.departmentId, {
          $addToSet: { members: { userId: teamMember._id, role: dept.role } }
        })
      )
    );

    const memberData = (await withRelations(Team.findById(teamMember._id))) as Doc<TeamDoc>;

    notifyAdmin(req)?.teamMemberChanged(
      'team-member-added',
      memberData._id,
      memberData.assignedSites,
      memberData.toObject() as Record<string, unknown>
    );

    res.status(201).json(memberData);

    events.emit('agent.created', {
      organizationId,
      userId: req.user?._id ?? null,
      entityId: memberData._id,
      metadata: { name: memberData.name, email: memberData.email },
      ip: req.ip,
      ua: req.get('user-agent')
    });
  })
);

// -------------------------------------------------------------------- updating

router.put(
  '/:id',
  checkPermission('manage_users'),
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = orgId(req);
    const { name, role, assignedSites, status, permissions, preferences, isActive } = req.body;

    const existing = await loadOwnedTeamMember(req, req.params.id);

    // A caller manages only below their own rank, and hands out only roles below
    // it. Nobody edits a peer or a superior.
    if (!canManageMember(req.user.role, existing.role)) {
      throw forbidden('You cannot manage this member');
    }
    if (role !== undefined) {
      if (!isTeamRole(role)) throw badRequest('Invalid role');
      if (!canAssignRole(req.user.role, role)) throw forbidden('You cannot assign this role');
    }
    if (status !== undefined && !isPresenceStatus(status)) throw badRequest('Invalid status');
    if (isActive !== undefined && typeof isActive !== 'boolean') {
      throw badRequest('isActive must be a boolean');
    }
    if (name !== undefined && (typeof name !== 'string' || !name.trim() || name.length > 100)) {
      throw badRequest('Invalid name');
    }
    if (
      preferences !== undefined &&
      (typeof preferences !== 'object' || preferences === null || Array.isArray(preferences))
    ) {
      throw badRequest('Invalid preferences');
    }

    const cleanPermissions =
      permissions === undefined ? undefined : sanitizePermissions(permissions);
    if (cleanPermissions === null) throw badRequest('Invalid permissions');

    const siteIds =
      assignedSites === undefined ? undefined : await ownedSiteIds(organizationId, assignedSites);
    if (siteIds === null) throw badRequest('Unknown site in assignedSites');

    // Only fields that were sent, and that passed the checks above, are written.
    const updateData = Object.fromEntries(
      Object.entries({
        name: typeof name === 'string' ? name.trim() : undefined,
        role,
        assignedSites: siteIds,
        status,
        permissions: cleanPermissions,
        preferences,
        isActive
      }).filter(([, value]) => value !== undefined)
    );

    const previousRole = existing.role;
    const member = (await withRelations(
      Team.findOneAndUpdate({ _id: existing._id, organizationId }, updateData, { new: true })
    )) as Doc<TeamDoc>;

    if (role && previousRole !== role) {
      events.emit('agent.role.updated', {
        organizationId,
        userId: req.user?._id ?? null,
        entityId: member._id,
        metadata: { previousRole, newRole: role },
        ip: req.ip,
        ua: req.get('user-agent')
      });
    }

    res.json(member);
  })
);

router.patch(
  '/:id/status',
  asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.body;
    if (!isPresenceStatus(status)) {
      throw badRequest(`status must be one of: ${PRESENCE_STATUSES.join(', ')}`);
    }

    // Only a session used to be required here: a user of any organization could
    // set another organization's agent offline — which breaks auto-assignment —
    // and read that agent's profile out of the response.
    const target = await loadOwnedTeamMember(req, req.params.id);

    const isSelf = String(target._id) === String(req.user._id);
    const mayManage =
      hasPermission(req.user.role, 'manage_team') && canManageMember(req.user.role, target.role);
    if (!isSelf && !mayManage) {
      throw forbidden("You cannot change this member's status");
    }

    const member = (await Team.findOneAndUpdate(
      { _id: target._id, organizationId: orgId(req) },
      { status },
      { new: true }
    ).select(MEMBER_PROJECTION)) as Doc<TeamDoc>;

    notifyAdmin(req)?.teamMemberChanged('agent-status-changed', member._id, member.assignedSites, {
      userId: String(member._id),
      status
    });

    res.json(member);
  })
);

// -------------------------------------------------------------------- deleting

router.delete(
  '/:id',
  checkPermission('manage_users'),
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = orgId(req);
    const member = await loadOwnedTeamMember(req, req.params.id);

    if (!canManageMember(req.user.role, member.role)) {
      throw forbidden('You cannot manage this member');
    }

    const activeConversations = await Conversation.countDocuments({
      assignedAgent: member._id,
      status: { $in: ACTIVE_CONVERSATION_STATUSES }
    });
    if (activeConversations > 0) {
      // Their queue would be orphaned; the caller is told how many to reassign.
      throw conflict(`Cannot delete team member with ${activeConversations} active conversations`);
    }

    await Department.updateMany(
      { 'members.userId': member._id },
      { $pull: { members: { userId: member._id } } }
    );
    await Team.deleteOne({ _id: member._id, organizationId });

    notifyAdmin(req)?.teamMemberChanged('team-member-deleted', member._id, member.assignedSites, {
      userId: String(member._id)
    });

    events.emit('agent.deleted', {
      organizationId,
      userId: req.user?._id ?? null,
      entityId: member._id,
      metadata: { email: member.email, name: member.name },
      ip: req.ip,
      ua: req.get('user-agent')
    });

    res.json({ message: 'Team member deleted successfully' });
  })
);

export default router;
