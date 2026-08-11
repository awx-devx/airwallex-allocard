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

/** Pure title resolution — tested without React. */
export function resolvePermissionTooltipTitle(
  permission: Permission,
  message?: string,
  reasons?: PermissionReason[],
): string {
  const fromReasons = reasons?.find((r) => r.permission === permission && !r.allowed)?.message
  return message ?? fromReasons ?? `Missing ${permission}`
}

export function PermissionTooltip({
  permission,
  message,
  reasons,
  children,
}: PermissionTooltipProps) {
  const title = resolvePermissionTooltipTitle(permission, message, reasons)
  return <span title={title}>{children}</span>
}
