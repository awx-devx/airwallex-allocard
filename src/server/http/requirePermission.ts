import {
  computeEffectivePermissions,
  isScopeActive,
  scopeCoversSubject,
  type PermissionSubject,
} from '@/server/services/access/computeEffectivePermissions'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import { findActiveProjectMember } from '@/server/repositories/projectMembers'
import { findRoleById } from '@/server/repositories/roles'
import { OrgRole } from '@/shared/enums/orgRole'
import { Permission } from '@/shared/enums/permissions'

/**
 * Subject for authorization. `projectId` is required for subject-scoped
 * permissions; narrower ids (`cardId`, etc.) are checked against AccessScope.
 */
export type RequirePermissionSubject = PermissionSubject & {
  projectId?: string
}

/**
 * Org-level permissions that are not tied to a project member record.
 * MEMBER cannot satisfy these yet — only OWNER/ADMIN short-circuit allows them.
 */
const ORG_LEVEL_PERMISSIONS = new Set<string>(['org.manage', Permission.PROJECT_CREATE])

function isOrgElevated(orgRole: OrgRole): boolean {
  return orgRole === OrgRole.OWNER || orgRole === OrgRole.ADMIN
}

/** Permissions that must be checked against a project (and optional sub-subject). */
export function requiresProjectSubject(permission: string): boolean {
  if (ORG_LEVEL_PERMISSIONS.has(permission)) {
    return false
  }
  return (Object.values(Permission) as string[]).includes(permission)
}

/**
 * Assert the caller may perform `permission` on optional `subject`.
 *
 * - Org OWNER/ADMIN short-circuit to full access (documented: never narrowed by
 *   a project role or access scope).
 * - Subject-scoped permissions require `subject.projectId`; omitting it is
 *   half-authorization and is rejected.
 * - With a project subject: resolve the active ProjectMember, recompute
 *   effective permissions (same function as preview), then check scope against
 *   the concrete subject (cardId / workstreamId / …).
 */
export async function requirePermission(
  ctx: OrgContext,
  permission: string,
  subject?: RequirePermissionSubject,
  now: Date = new Date(),
): Promise<void> {
  // Org elevated roles bypass project membership entirely.
  if (isOrgElevated(ctx.orgRole)) {
    return
  }

  if (requiresProjectSubject(permission) && subject?.projectId === undefined) {
    throw AppError.permissionDenied(permission)
  }

  const projectId = subject?.projectId
  if (projectId === undefined || subject === undefined) {
    // Org-level permission as MEMBER — no grant path yet.
    throw AppError.permissionDenied(permission)
  }

  const member = await findActiveProjectMember(ctx, projectId, ctx.userId)
  if (!member) {
    throw AppError.permissionDenied(permission)
  }

  if (!isScopeActive(member.scope, now)) {
    throw AppError.permissionDenied(permission)
  }

  const role = await findRoleById(ctx, member.roleId)
  if (!role) {
    throw AppError.permissionDenied(permission)
  }

  const effective = computeEffectivePermissions({
    orgRole: ctx.orgRole,
    role,
    scope: member.scope,
    now,
  })

  if (!effective.permissions.includes(permission as Permission)) {
    throw AppError.permissionDenied(permission)
  }

  if (
    !scopeCoversSubject(member.scope, {
      cardId: subject.cardId,
      workstreamId: subject.workstreamId,
      categoryId: subject.categoryId,
      userId: subject.userId,
      callerUserId: ctx.userId,
    })
  ) {
    throw AppError.permissionDenied(permission)
  }
}
