/**
 * PermissionGate / PermissionGateView are UX only, never a security control.
 * Server `requirePermission` is authoritative.
 *
 * Unlike RequirePermission (default `null` when denied), Gate always explains
 * the denial with a tooltip — it never silently hides the control.
 */
'use client'

import { useCan } from '@/client/lib/permissions/useCan'
import { decidePermissionGateView } from '@/components/patterns/decidePermissionGate'
import type { PermissionGateProps, PermissionGateViewProps } from '@/components/patterns/types'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export function PermissionGateView({
  allowed,
  denialMessage,
  children,
  fallback,
}: PermissionGateViewProps) {
  const decision = decidePermissionGateView({
    allowed,
    hasFallback: fallback !== undefined,
  })
  if (decision === 'children') {
    return children
  }
  const content = decision === 'tooltip-fallback' ? fallback : children
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center" aria-disabled="true">
          {content}
        </span>
      </TooltipTrigger>
      <TooltipContent>{denialMessage}</TooltipContent>
    </Tooltip>
  )
}

export function PermissionGate({
  projectId,
  permission,
  subject,
  reasons,
  fallback,
  children,
}: PermissionGateProps) {
  const { can, explain } = useCan(projectId)
  return (
    <PermissionGateView
      allowed={can(permission, subject)}
      denialMessage={explain(permission, subject, reasons)}
      fallback={fallback}
    >
      {children}
    </PermissionGateView>
  )
}
