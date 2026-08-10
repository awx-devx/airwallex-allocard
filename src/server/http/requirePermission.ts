import {
  computeEffectivePermissions,
  isScopeActive,
  scopeCoversSubject,
  type PermissionSubject,
} from '@/server/services/access/computeEffectivePermissions'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import {
  findActiveProjectMember,
  listActiveProjectMembersForUser,
} from '@/server/repositories/projectMembers'
import { findRoleById } from '@/server/repositories/roles'
import { OrgRole } from '@/shared/enums/orgRole'
import { Permission } from '@/shared/enums/permissions'
import type { ProjectMember } from '@/shared/types/projectMember'

/**
 * Subject for authorization. `projectId` is required for resource-scoped checks;
 * narrower ids (`cardId`, etc.) are checked against AccessScope.
 */
export type RequirePermissionSubject = PermissionSubject & {
  projectId?: string
}

/**
 * Truly org-only — never granted via project membership.
 * MEMBER cannot satisfy these; only OWNER/ADMIN short-circuit allows them.
 */
const ORG_ONLY_PERMISSIONS = new Set<string>(['org.manage'])

/**
 * May be asserted without a project subject: grant if the caller holds the
 * permission on any active project membership (B3.11 org-wide capability).
 * Resource-scoped permissions (card.manage, etc.) are NOT in this set —
 * omitting `projectId` for those remains half-authorization and is denied.
 */
const ORG_WIDE_VIA_MEMBERSHIP = new Set<string>([
  Permission.PROJECT_VIEW,
  Permission.PROJECT_CREATE,
  Permission.MEMBER_VIEW,
  Permission.MEMBER_MANAGE,
  Permission.ROLE_ASSIGN,
  Permission.BUDGET_EDIT,
  // Org-scoped control surfaces (attributes, rules) have no projectId on the wire.
  Permission.CONTROL_EDIT,
])

function isOrgElevated(orgRole: OrgRole): boolean {
  return orgRole === OrgRole.OWNER || orgRole === OrgRole.ADMIN
}

/** True when a concrete project subject is required for resource checks. */
export function requiresProjectSubject(permission: string): boolean {
  if (ORG_ONLY_PERMISSIONS.has(permission)) {
    return false
  }
  if (ORG_WIDE_VIA_MEMBERSHIP.has(permission)) {
    return false
  }
  return (Object.values(Permission) as string[]).includes(permission)
}

async function memberGrantsPermission(
  ctx: OrgContext,
  permission: string,
  membership: ProjectMember,
  subject: RequirePermissionSubject,
  now: Date,
): Promise<boolean> {
  if (!isScopeActive(membership.scope, now)) {
    return false
  }

  const role = await findRoleById(ctx, membership.roleId)
  if (!role) {
    return false
  }

  const effective = computeEffectivePermissions({
    orgRole: ctx.orgRole,
    role,
    scope: membership.scope,
    now,
  })

  if (!effective.permissions.includes(permission as Permission)) {
    return false
  }

  return scopeCoversSubject(membership.scope, {
    cardId: subject.cardId,
    workstreamId: subject.workstreamId,
    categoryId: subject.categoryId,
    userId: subject.userId,
    callerUserId: ctx.userId,
  })
}

/**
 * Assert the caller may perform `permission` on optional `subject`.
 *
 * - Org OWNER/ADMIN short-circuit to full access (never narrowed by a project
 *   role or access scope).
 * - With `subject.projectId`: resolve the active ProjectMember, recompute
 *   effective permissions (same function as preview), then check scope.
 * - Without `projectId`: org-only permissions deny for MEMBER; org-wide
 *   capability permissions (`project.view|create`, `member.*`, `role.assign`,
 *   `budget.edit`) grant if any active membership includes them; other
 *   permissions deny (half-authorization).
 */
export async function requirePermission(
  ctx: OrgContext,
  permission: string,
  subject?: RequirePermissionSubject,
  now: Date = new Date(),
): Promise<void> {
  if (isOrgElevated(ctx.orgRole)) {
    return
  }

  if (ORG_ONLY_PERMISSIONS.has(permission)) {
    throw AppError.permissionDenied(permission)
  }

  const projectId = subject?.projectId
  if (projectId !== undefined && subject !== undefined) {
    const member = await findActiveProjectMember(ctx, projectId, ctx.userId)
    if (!member) {
      throw AppError.permissionDenied(permission)
    }
    const ok = await memberGrantsPermission(ctx, permission, member, subject, now)
    if (!ok) {
      throw AppError.permissionDenied(permission)
    }
    return
  }

  if (!ORG_WIDE_VIA_MEMBERSHIP.has(permission)) {
    throw AppError.permissionDenied(permission)
  }

  const memberships = await listActiveProjectMembersForUser(ctx, ctx.userId)
  for (const membership of memberships) {
    const ok = await memberGrantsPermission(
      ctx,
      permission,
      membership,
      { projectId: membership.projectId },
      now,
    )
    if (ok) {
      return
    }
  }

  throw AppError.permissionDenied(permission)
}

/**
 * Project ids where the caller currently holds `permission` (MEMBER path).
 * OWNER/ADMIN callers should not need this — they see the full org.
 */
export async function projectIdsGrantingPermission(
  ctx: OrgContext,
  permission: Permission,
  now: Date = new Date(),
): Promise<string[]> {
  if (isOrgElevated(ctx.orgRole)) {
    return []
  }

  const memberships = await listActiveProjectMembersForUser(ctx, ctx.userId)
  const ids: string[] = []
  for (const membership of memberships) {
    const ok = await memberGrantsPermission(
      ctx,
      permission,
      membership,
      { projectId: membership.projectId },
      now,
    )
    if (ok) {
      ids.push(membership.projectId)
    }
  }
  return ids
}
