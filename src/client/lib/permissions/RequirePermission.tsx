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

export type RequirePermissionDecision =
  | { kind: 'children'; children: ReactNode }
  | { kind: 'fallback'; fallback: ReactNode; denialMessage: string; permission: Permission }
  | { kind: 'null' }

/** Pure gate decision — tested without React / TanStack Query. */
export function decideRequirePermission(input: {
  allowed: boolean
  children: ReactNode
  fallback?: ReactNode
  denialMessage: string
  permission: Permission
}): RequirePermissionDecision {
  if (input.allowed) {
    return { kind: 'children', children: input.children }
  }
  if (input.fallback !== null && input.fallback !== undefined) {
    return {
      kind: 'fallback',
      fallback: input.fallback,
      denialMessage: input.denialMessage,
      permission: input.permission,
    }
  }
  return { kind: 'null' }
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
  const decision = decideRequirePermission({
    allowed: can(permission, subject),
    children,
    fallback,
    denialMessage: explain(permission, subject, reasons),
    permission,
  })
  switch (decision.kind) {
    case 'children':
      return decision.children
    case 'fallback':
      return (
        <PermissionTooltip permission={decision.permission} message={decision.denialMessage}>
          {decision.fallback}
        </PermissionTooltip>
      )
    case 'null':
      return null
    default: {
      const _exhaustive: never = decision
      return _exhaustive
    }
  }
}
