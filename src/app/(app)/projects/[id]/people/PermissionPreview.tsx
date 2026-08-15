'use client'

import { formatPermissionReason, scopeSummary, type ScopeSummaryNames } from '@/client/lib/access'
import type { Permission } from '@/shared/enums/permissions'
import type { AccessScope } from '@/shared/types/accessScope'

export function PermissionPreview({
  complete,
  scope,
  reasons,
  names,
}: {
  complete: boolean
  scope: AccessScope
  reasons?: { permission: Permission; allowed: boolean; message: string }[]
  names?: ScopeSummaryNames
}) {
  if (!complete) {
    return (
      <p className="text-sm text-muted-foreground">Pick a role and finish the scope to preview.</p>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="text-sm">{scopeSummary(scope, names)}</p>
      <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
        {(reasons ?? []).map((reason) => (
          <li key={reason.permission} className="min-w-0 break-all text-sm">
            {formatPermissionReason(reason)}
          </li>
        ))}
      </ul>
    </div>
  )
}
