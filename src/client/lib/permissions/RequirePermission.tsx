/**
 * Client permission helpers — convenience for UX only, never a security control.
 * Server `requirePermission` is authoritative.
 *
 * Default when denied: render `null`. Pass `fallback` for disabled-control patterns (F3).
 */
'use client'

import type { ReactNode } from 'react'
import { PermissionTooltip } from '@/client/lib/permissions/PermissionTooltip'
import { useCan } from '@/client/lib/permissions/useCan'
import type { PermissionSubject } from '@/shared/access/scope'
import type { Permission } from '@/shared/enums/permissions'
import type { PermissionReason } from '@/shared/types/projectMember'

export type RequirePermissionProps = {
  projectId: string
  permission: Permission
  subject?: PermissionSubject
  reasons?: PermissionReason[]
  fallback?: ReactNode
  children: ReactNode
}

export function RequirePermission({
  projectId,
  permission,
  subject,
  reasons,
  fallback = null,
  children,
}: RequirePermissionProps) {
  const { can, explain } = useCan(projectId)
  if (can(permission, subject)) {
    return children
  }
  if (fallback !== null && fallback !== undefined) {
    return (
      <PermissionTooltip permission={permission} message={explain(permission, subject, reasons)}>
        {fallback}
      </PermissionTooltip>
    )
  }
  return null
}
