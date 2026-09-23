// Departments: how a site routes its conversations, and who staffs each queue.
//
// A department belongs to a site, and the site belongs to the organization, so
// every handler here has to check ownership two levels up. That check used to
// be written out in each of the six handlers — load the department, load its
// site, compare organization ids, answer 404 four different ways — which is
// how `GET /:id/stats` ended up doing it in a different order from the others.
// `loadOwnedDepartment` does the whole thing in one call; see src/http/guards.ts.

import express from 'express';
import Department from '../models/Department';
import Team from '../models/Team';
import { auth } from '../middleware/auth';
import { checkPermission } from '../middleware/rbac';
import { ownedMembers } from '../middleware/teamPolicy';
import events from '../events';
import { departmentConversationStats } from '../db/queries';
import {
  asyncHandler,
  badRequest,
  conflict,
  loadOwnedDepartment,
  loadOwnedSite,
  orgId,
  requireOrganization
} from '../http';
import type { Request, Response } from 'express';
import type { Doc } from '../db/model';
import type { DepartmentDoc } from '../models/Department';

const router = express.Router();

router.use(auth, requireOrganization);

/** The projection the panel renders a member row from. */
const MEMBER_FIELDS = 'name email avatar status';

interface MemberEntry {
  userId: string;
  role: 'manager' | 'agent';
}

/**
 * Mirrors a department's membership onto each agent's own record.
 *
 * Both sides are kept because the panel reads membership from whichever end it
 * happens to have loaded. The ids are validated by `ownedMembers` before they
 * get here, so these writes are always inside the caller's organization.
 */
async function syncMemberships(
  organizationId: string,
  departmentId: unknown,
  removed: readonly string[],
  added: readonly MemberEntry[]
): Promise<void> {
  await Promise.all([
    ...removed.map((memberId) =>
      Team.findOneAndUpdate(
        { _id: memberId, organizationId },
        { $pull: { departments: { departmentId } } }
      )
    ),
    ...added.map((member) =>
      Team.findOneAndUpdate(
        { _id: member.userId, organizationId },
        { $addToSet: { departments: { departmentId, role: member.role } } }
      )
    )
  ]);
}

/** The members a request asks for, rejected as a whole if any is a stranger. */
async function validatedMembers(organizationId: string, value: unknown): Promise<MemberEntry[]> {
  const members = await ownedMembers(organizationId, value);
  if (!members) throw badRequest('Unknown team member in members');
  return members;
}

router.get(
  '/site/:siteId',
  asyncHandler(async (req: Request, res: Response) => {
    const site = await loadOwnedSite(req, req.params.siteId);
    const departments = await Department.find({ siteId: site._id, isActive: true })
      .populate('members.userId', MEMBER_FIELDS)
      .sort({ createdAt: -1 });
    res.json(departments);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const department = await loadOwnedDepartment(req, req.params.id);
    await department.populate('members.userId', `${MEMBER_FIELDS} stats`);
    res.json(department);
  })
);

router.post(
  '/',
  checkPermission('manage_team'),
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = orgId(req);
    const { name, description, siteId, color, icon, members, autoAssignRules, businessHours } =
      req.body;

    const site = await loadOwnedSite(req, siteId);
    const memberEntries = await validatedMembers(organizationId, members);

    const department = new Department({
      name,
      description,
      siteId: site._id,
      color,
      icon,
      members: memberEntries.map((m) => ({ ...m, addedAt: new Date() })),
      autoAssignRules: autoAssignRules || { enabled: false, strategy: 'round-robin' },
      businessHours: businessHours || { enabled: false }
    });
    await department.save();

    await syncMemberships(organizationId, department._id, [], memberEntries);
    await department.populate('members.userId', MEMBER_FIELDS);
    res.status(201).json(department);
  })
);

router.put(
  '/:id',
  checkPermission('manage_team'),
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = orgId(req);
    const { name, description, color, icon, members, autoAssignRules, businessHours, isActive } =
      req.body;

    const department = await loadOwnedDepartment(req, req.params.id);

    // An absent `members` means "unchanged". Treating it as an empty list — which
    // is what an earlier version did — silently emptied the department.
    const memberEntries: MemberEntry[] =
      members === undefined
        ? department.members.map((m) => ({
            userId: String(m.userId),
            role: m.role === 'manager' ? 'manager' : 'agent'
          }))
        : await validatedMembers(organizationId, members);

    const previousIds = department.members.map((m) => String(m.userId));
    const nextIds = memberEntries.map((m) => m.userId);
    const removed = previousIds.filter((id) => !nextIds.includes(id));
    const added = memberEntries.filter((m) => !previousIds.includes(m.userId));

    const before = snapshotPolicy(department);

    department.name = name;
    department.description = description;
    department.color = color;
    department.icon = icon;
    // Joining dates survive an edit that only reorders or re-roles the list.
    const joinedAt = new Map(department.members.map((m) => [String(m.userId), m.addedAt]));
    department.members = memberEntries.map((m) => ({
      ...m,
      addedAt: joinedAt.get(m.userId) || new Date()
    }));
    department.autoAssignRules = autoAssignRules;
    department.businessHours = businessHours;
    if (isActive !== undefined) department.isActive = isActive;
    await department.save();

    emitPolicyChange(req, department, before);
    await syncMemberships(organizationId, department._id, removed, added);
    await department.populate('members.userId', MEMBER_FIELDS);
    res.json(department);
  })
);

router.post(
  '/:id/members',
  checkPermission('manage_team'),
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = orgId(req);
    const department = await loadOwnedDepartment(req, req.params.id);

    const [entry] = await validatedMembers(organizationId, [
      { userId: req.body?.userId, role: req.body?.role }
    ]);
    if (!entry) throw badRequest('Unknown team member');

    if (department.members.some((m) => String(m.userId) === entry.userId)) {
      throw conflict('User is already a member');
    }

    department.members.push({ userId: entry.userId, role: entry.role, addedAt: new Date() });
    await department.save();

    await syncMemberships(organizationId, department._id, [], [entry]);
    await department.populate('members.userId', MEMBER_FIELDS);
    res.json(department);
  })
);

router.delete(
  '/:id/members/:userId',
  checkPermission('manage_team'),
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = orgId(req);
    const department = await loadOwnedDepartment(req, req.params.id);

    const { userId } = req.params;
    department.members = department.members.filter((m) => String(m.userId) !== userId);
    await department.save();

    await syncMemberships(organizationId, department._id, [userId], []);
    await department.populate('members.userId', MEMBER_FIELDS);
    res.json(department);
  })
);

router.get(
  '/:id/stats',
  asyncHandler(async (req: Request, res: Response) => {
    // This handler used to resolve ownership in its own way, and a reader had to
    // compare it against the other five to be sure it was equivalent.
    const department = await loadOwnedDepartment(req, req.params.id);
    const counted = await departmentConversationStats(department._id);

    res.json({
      totalConversations: counted.total,
      unassigned: counted.unassigned,
      assigned: counted.assigned,
      pending: counted.pending,
      resolved: counted.resolved,
      closed: counted.closed,
      activeMembers: department.members.length,
      avgResponseTime: department.stats?.averageResponseTime || 0
    });
  })
);

router.delete(
  '/:id',
  checkPermission('manage_team'),
  asyncHandler(async (req: Request, res: Response) => {
    const department = await loadOwnedDepartment(req, req.params.id);

    const { active: activeConversations } = await departmentConversationStats(department._id);
    if (activeConversations > 0) {
      // Deleting the department would orphan live conversations, so the caller is
      // told what is in the way rather than just refused.
      throw conflict(`Cannot delete department with ${activeConversations} active conversations`);
    }

    await Team.updateMany(
      { 'departments.departmentId': department._id },
      { $pull: { departments: { departmentId: department._id } } }
    );
    await Department.findByIdAndDelete(department._id);
    res.json({ message: 'Department deleted successfully' });
  })
);

// ---------------------------------------------------------------- audit trail

interface PolicySnapshot {
  sla: string;
  businessHours: string;
}

/** SLA and business-hours policy are audited, so their previous value is kept. */
function snapshotPolicy(department: Doc<DepartmentDoc>): PolicySnapshot {
  return {
    sla: JSON.stringify(department.sla || {}),
    businessHours: JSON.stringify(department.businessHours || {})
  };
}

/**
 * Emits `sla.updated` when the policy actually changed.
 *
 * The comparison is on the serialised form because these are `json` columns
 * read and written whole. Failing to build the event must not fail the request
 * that already succeeded, so the emit is isolated — but unlike the empty catch
 * this replaces, the reason is logged instead of discarded.
 */
function emitPolicyChange(
  req: Request,
  department: Doc<DepartmentDoc>,
  before: PolicySnapshot
): void {
  const after = snapshotPolicy(department);
  if (before.sla === after.sla && before.businessHours === after.businessHours) return;

  try {
    events.emit('sla.updated', {
      organizationId: orgId(req),
      userId: req.user?._id ?? null,
      entityId: department._id,
      metadata: {
        previous: JSON.parse(before.sla),
        current: JSON.parse(after.sla),
        previousBusinessHours: JSON.parse(before.businessHours),
        currentBusinessHours: JSON.parse(after.businessHours)
      },
      ip: req.ip,
      ua: req.get('user-agent')
    });
  } catch (error) {
    console.error('[departments] could not emit sla.updated', error);
  }
}

export default router;
