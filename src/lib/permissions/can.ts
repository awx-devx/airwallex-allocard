/**
 * Client `can()` is a convenience for UX only — never a security control.
 * The server `requirePermission` is authoritative.
 */
import { scopeCoversSubject, type PermissionSubject } from '@/shared/access/scope'
import type { Permission } from '@/shared/enums/permissions'
import type { MePermissions } from '@/shared/types/mePermissions'
import type { PermissionReason } from '@/shared/types/projectMember'

export type CanSubject = PermissionSubject

export function can(
  me: MePermissions,
  projectId: string,
  permission: Permission,
  subject?: CanSubject,
): boolean {
  const row = me.projects.find((p) => p.projectId === projectId)
  if (!row) {
    return false
  }
  if (!row.permissions.includes(permission)) {
    return false
  }
  if (subject !== undefined) {
    return scopeCoversSubject(row.scope, subject)
  }
  return true
}

export function explainDenial(
  me: MePermissions,
  projectId: string,
  permission: Permission,
  subject?: CanSubject,
  reasons?: PermissionReason[],
): string {
  if (reasons) {
    const match = reasons.find((r) => r.permission === permission && !r.allowed)
    if (match) {
      return match.message
    }
  }

  const row = me.projects.find((p) => p.projectId === projectId)
  if (!row) {
    return 'No access to this project'
  }
  if (!row.permissions.includes(permission)) {
    return `Missing ${permission}`
  }
  if (subject !== undefined && !scopeCoversSubject(row.scope, subject)) {
    return 'Outside your access scope'
  }
  return `Missing ${permission}`
}
