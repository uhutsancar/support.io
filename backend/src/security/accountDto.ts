/** Positive-list account serializers for HTTP and Socket.IO boundaries. */

type PlainAccount = Record<string, any> & { toObject?: () => Record<string, any> };

function plain(account: PlainAccount): Record<string, any> {
  return typeof account.toObject === 'function' ? account.toObject() : account;
}

/** The fields an authenticated team directory is allowed to expose. */
export function teamMemberDTO(account: PlainAccount): Record<string, unknown> {
  const value = plain(account);
  return {
    _id: value._id,
    id: value.id ?? value._id,
    email: value.email,
    name: value.name,
    role: value.role,
    avatar: value.avatar ?? null,
    isActive: Boolean(value.isActive),
    status: value.status,
    skills: Array.isArray(value.skills) ? value.skills : [],
    preferences: value.preferences ?? {},
    maxCapacity: value.maxCapacity,
    currentLoad: value.currentLoad,
    permissions: value.permissions ?? {},
    stats: value.stats ?? {},
    lastActive: value.lastActive ?? null,
    phone: value.phone ?? null,
    bio: value.bio ?? null,
    emailVerifiedAt: value.emailVerifiedAt ?? null,
    totpEnabled: Boolean(value.totpEnabledAt),
    seatSuspended: Boolean(value.seatSuspendedAt),
    assignedSites: Array.isArray(value.assignedSites) ? value.assignedSites : [],
    departments: Array.isArray(value.departments) ? value.departments : [],
    createdAt: value.createdAt,
    updatedAt: value.updatedAt
  };
}

/** The minimal public representation of an agent shown to visitors. */
export function publicAgentDTO(account: PlainAccount): Record<string, unknown> {
  const value = plain(account);
  return {
    _id: value._id,
    name: value.name,
    avatar: value.avatar ?? null,
    status: value.status
  };
}
