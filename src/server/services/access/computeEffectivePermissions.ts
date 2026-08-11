import { isScopeActive, type PermissionSubject } from '@/shared/access/scope'
import { ALL_PERMISSIONS } from '@/shared/constants/roleTemplates'
import { OrgRole } from '@/shared/enums/orgRole'
import type { Permission } from '@/shared/enums/permissions'
import type { AccessScope } from '@/shared/types/accessScope'
import type { PermissionReason } from '@/shared/types/projectMember'
import type { Role } from '@/shared/types/role'

export type { PermissionSubject }
export { isScopeActive, scopeCoversSubject } from '@/shared/access/scope'

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

function parseBound(iso: string | undefined): number | null {
  if (iso === undefined) {
    return null
  }
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? null : ms
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
