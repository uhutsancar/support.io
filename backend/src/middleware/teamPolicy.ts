'use strict';

// Ekip yönetiminin yetki kuralları.
//
// `checkPermission('manage_users')` bir kullanıcının ekip yönetebileceğini
// söyler ama KİMİ yönetebileceğini söylemez. Bu boşlukta bir admin başka bir
// admin oluşturabiliyor, başka bir admini düşürüp silebiliyordu; bir temsilci
// iş arkadaşını çevrimdışı yapabiliyordu. Kurallar tek yerde:
//
//   - Owner herkesi yönetir ve admin atayabilir.
//   - Diğerleri yalnızca kendilerinden AŞAĞIDAKİ rütbeyi yönetir ve atar;
//     akranını ya da üstünü değil. Kimse kendi rolünü değiştiremez: bir
//     admin kendi kaydında rütbesi gereği zaten reddedilir, owner ise teams
//     tablosunda değil users tablosunda durur.
//   - Gövdeden gelen site ve departman kimlikleri çağıranın şirketine ait
//     olmak zorunda. Aksi halde üye başka bir şirketin departmanına
//     yazılabiliyordu.

import Site from '../models/Site';
import Department from '../models/Department';
import Team from '../models/Team';
import { isValidObjectId } from '../db/objectId';

export const TEAM_ROLES = ['admin', 'manager', 'agent'] as const;
export type TeamRoleName = (typeof TEAM_ROLES)[number];

const RANK: Record<string, number> = { viewer: 0, agent: 1, manager: 2, admin: 3, owner: 4 };

const rank = (role: unknown): number => (typeof role === 'string' && role in RANK ? RANK[role] : -1);

export function isTeamRole(role: unknown): role is TeamRoleName {
  return typeof role === 'string' && (TEAM_ROLES as readonly string[]).includes(role);
}

/** Çağıranın verebileceği roller: owner hepsini, diğerleri yalnızca altını. */
export function canAssignRole(callerRole: string, role: TeamRoleName): boolean {
  if (callerRole === 'owner') return true;
  return rank(role) < rank(callerRole);
}

/** Çağıran, şu an `memberRole` taşıyan bir üyeyi değiştirebilir mi. */
export function canManageMember(callerRole: string, memberRole: string): boolean {
  if (callerRole === 'owner') return true;
  return rank(memberRole) >= 0 && rank(memberRole) < rank(callerRole);
}

// TeamPermissions'ın bilinen anahtarları. Gövdeden gelen serbest bir nesne
// JSON sütununa olduğu gibi yazılıyordu.
const PERMISSION_KEYS = new Set([
  'canManageConversations',
  'canManageDepartments',
  'canManageTeam',
  'canManageSites',
  'canViewAnalytics',
  'canManageFAQs'
]);

/** Yalnızca bilinen, boolean değerli izin anahtarlarını geçirir; aksi halde null. */
export function sanitizePermissions(value: unknown): Record<string, boolean> | null {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const out: Record<string, boolean> = {};
  for (const [key, flag] of Object.entries(value as Record<string, unknown>)) {
    if (!PERMISSION_KEYS.has(key) || typeof flag !== 'boolean') return null;
    out[key] = flag;
  }
  return out;
}

/** Site kimliklerinin tamamı bu şirkete aitse normalleştirilmiş listeyi döner. */
export async function ownedSiteIds(orgId: string, value: unknown): Promise<string[] | null> {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 200) return null;
  const ids = [...new Set(value.map((v) => String(v && typeof v === 'object' && '_id' in v ? (v as { _id: unknown })._id : v)))];
  if (ids.some((id) => !isValidObjectId(id))) return null;
  if (ids.length === 0) return [];
  const count = await Site.countDocuments({ _id: { $in: ids }, organizationId: orgId });
  return count === ids.length ? ids : null;
}

interface MemberEntry { userId: string; role: 'manager' | 'agent' }

/**
 * Departman üyesi kayıtlarının tamamı bu şirketin ekibindense onları döner.
 *
 * Departman oluşturma ve güncelleme `members[].userId`'leri doğrulamadan hem
 * departmana yazıyor hem de `Team.findByIdAndUpdate` ile o kişinin kaydını
 * değiştiriyordu: başka bir şirketin temsilcisinin kaydına yazılabiliyor,
 * yanıttaki populate de o kişinin adını ve e-postasını döndürüyordu.
 */
export async function ownedMembers(orgId: string, value: unknown): Promise<MemberEntry[] | null> {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 500) return null;
  const entries: MemberEntry[] = [];
  for (const raw of value) {
    const id = raw && typeof raw === 'object' ? (raw as { userId?: unknown }).userId : undefined;
    const userId = id && typeof id === 'object' && '_id' in (id as object) ? (id as { _id: unknown })._id : id;
    if (!isValidObjectId(userId)) return null;
    const role = (raw as { role?: unknown }).role === 'manager' ? 'manager' : 'agent';
    entries.push({ userId: String(userId), role });
  }
  const ids = [...new Set(entries.map((e) => e.userId))];
  if (ids.length === 0) return [];
  const count = await Team.countDocuments({ _id: { $in: ids }, organizationId: orgId });
  return count === ids.length ? entries : null;
}

interface DepartmentEntry { departmentId: string; role: 'manager' | 'agent' }

/** Departman kayıtlarının tamamı bu şirketin sitelerinden birine aitse onları döner. */
export async function ownedDepartments(orgId: string, value: unknown): Promise<DepartmentEntry[] | null> {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 100) return null;
  const entries: DepartmentEntry[] = [];
  for (const raw of value) {
    const id = raw && typeof raw === 'object' ? (raw as { departmentId?: unknown }).departmentId : undefined;
    if (!isValidObjectId(id)) return null;
    const role = (raw as { role?: unknown }).role === 'manager' ? 'manager' : 'agent';
    entries.push({ departmentId: String(id), role });
  }
  if (entries.length === 0) return [];

  const orgSites = await Site.find({ organizationId: orgId }).select('_id').lean();
  const siteIds = orgSites.map((s) => String(s._id));
  const ids = [...new Set(entries.map((e) => e.departmentId))];
  const count = siteIds.length
    ? await Department.countDocuments({ _id: { $in: ids }, siteId: { $in: siteIds } })
    : 0;
  return count === ids.length ? entries : null;
}
