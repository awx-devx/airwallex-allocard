/**
 * Client permission helpers — convenience for UX only, never a security control.
 * Surfaces denial text via native `title` (no Radix until F3).
 */
'use client'

import type { ReactNode } from 'react'
import type { Permission } from '@/shared/enums/permissions'
import type { PermissionReason } from '@/shared/types/projectMember'

export type PermissionTooltipProps = {
  permission: Permission
  message?: string
  reasons?: PermissionReason[]
  children: ReactNode
}

export function PermissionTooltip({
  permission,
  message,
  reasons,
  children,
}: PermissionTooltipProps) {
  const fromReasons = reasons?.find((r) => r.permission === permission && !r.allowed)?.message
  const title = message ?? fromReasons ?? `Missing ${permission}`
  return <span title={title}>{children}</span>
}
