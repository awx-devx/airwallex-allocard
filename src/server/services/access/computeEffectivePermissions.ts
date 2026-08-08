import { ALL_PERMISSIONS } from '@/shared/constants/roleTemplates'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { OrgRole } from '@/shared/enums/orgRole'
import type { Permission } from '@/shared/enums/permissions'
import type { AccessScope } from '@/shared/types/accessScope'
import type { PermissionReason } from '@/shared/types/projectMember'
import type { Role } from '@/shared/types/role'

export type ComputeEffectivePermissionsInput = {
  orgRole: OrgRole
  role: Role
  scope: AccessScope
  now: Date
}

export type ComputeEffectivePermissionsResult = {
  permissions: Permission[]
  scope: AccessScope
  reasons: PermissionReason[]
}

/** Subject fields checked against an AccessScope (used by requirePermission / preview). */
export type PermissionSubject = {
  cardId?: string
  workstreamId?: string
  categoryId?: string
  /** Resource owner / member user id — compared for OWN / ASSIGNED_MEMBERS. */
  userId?: string
  /** Caller — required for OWN checks. */
  callerUserId?: string
}

function parseBound(iso: string | undefined): number | null {
  if (iso === undefined) {
    return null
  }
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? null : ms
}

/** Inclusive `[validFrom, validTo]` window. Missing bounds are open. */
export function isScopeActive(scope: AccessScope, now: Date): boolean {
  const t = now.getTime()
  const from = parseBound(scope.validFrom)
  const to = parseBound(scope.validTo)
  if (from !== null && t < from) {
    return false
  }
  if (to !== null && t > to) {
    return false
  }
  return true
}

function timeWindowDenialMessage(scope: AccessScope, now: Date): string {
  const from = parseBound(scope.validFrom)
  const t = now.getTime()
  if (from !== null && t < from) {
    return 'Access scope is not yet valid'
  }
  return 'Access scope has expired'
}

function isOrgElevated(orgRole: OrgRole): boolean {
  return orgRole === OrgRole.OWNER || orgRole === OrgRole.ADMIN
}

/**
 * Whether `scope` covers the concrete subject.
 * Scope never adds permissions — it only narrows which subjects they apply to.
 */
export function scopeCoversSubject(scope: AccessScope, subject: PermissionSubject): boolean {
  switch (scope.level) {
    case AccessScopeLevel.PROJECT:
      return true
    case AccessScopeLevel.WORKSTREAM: {
      const id = subject.workstreamId
      return id !== undefined && (scope.workstreamIds?.includes(id) ?? false)
    }
    case AccessScopeLevel.CATEGORY: {
      const id = subject.categoryId
      return id !== undefined && (scope.categoryIds?.includes(id) ?? false)
    }
    case AccessScopeLevel.CARD: {
      const id = subject.cardId
      return id !== undefined && (scope.cardIds?.includes(id) ?? false)
    }
    case AccessScopeLevel.OWN: {
      const { userId, callerUserId } = subject
      return userId !== undefined && callerUserId !== undefined && userId === callerUserId
    }
    case AccessScopeLevel.ASSIGNED_MEMBERS: {
      const id = subject.userId
      return id !== undefined && (scope.memberIds?.includes(id) ?? false)
    }
    default: {
      const _exhaustive: never = scope.level
      return _exhaustive
    }
  }
}

/**
 * Pure effective-permission computation — single authority for preview and enforcement.
 *
 * Composition:
 * 1. Org OWNER/ADMIN widen to all permissions (never narrowed by project role or time window).
 * 2. Otherwise start from the role's permissions.
 * 3. Outside a time-bounded window → empty set.
 * 4. Scope is echoed for subject narrowing; it never adds permissions.
 * 5. `reasons[]` covers every Permission grant/denial.
 */
export function computeEffectivePermissions(
  input: ComputeEffectivePermissionsInput,
): ComputeEffectivePermissionsResult {
  const { orgRole, role, scope, now } = input

  if (isOrgElevated(orgRole)) {
    const reasons: PermissionReason[] = ALL_PERMISSIONS.map((permission) => ({
      permission,
      allowed: true,
      message: `Granted by organisation ${orgRole} role`,
    }))
    return {
      permissions: [...ALL_PERMISSIONS],
      scope,
      reasons,
    }
  }

  if (!isScopeActive(scope, now)) {
    const message = timeWindowDenialMessage(scope, now)
    const reasons: PermissionReason[] = ALL_PERMISSIONS.map((permission) => ({
      permission,
      allowed: false,
      message,
    }))
    return {
      permissions: [],
      scope,
      reasons,
    }
  }

  const granted = new Set<Permission>(role.permissions)
  const permissions = ALL_PERMISSIONS.filter((permission) => granted.has(permission))
  const reasons: PermissionReason[] = ALL_PERMISSIONS.map((permission) => {
    if (granted.has(permission)) {
      return {
        permission,
        allowed: true,
        message: `Granted by ${role.name} role`,
      }
    }
    return {
      permission,
      allowed: false,
      message: `Not granted by ${role.name} role`,
    }
  })

  return { permissions, scope, reasons }
}
