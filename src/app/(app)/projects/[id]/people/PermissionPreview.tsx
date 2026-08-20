'use client'

import { CheckIcon, XIcon } from 'lucide-react'
import {
  PERMISSION_LABELS,
  scopeSummary,
  sortPermissionReasons,
  type ScopeSummaryNames,
} from '@/client/lib/access'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
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
      <ul className="flex max-h-80 min-w-0 flex-wrap gap-1.5 overflow-y-auto">
        {sortPermissionReasons(reasons ?? []).map((reason) => {
          const label = PERMISSION_LABELS[reason.permission]
          return (
            <li key={reason.permission} className="min-w-0">
              <Badge
                variant="outline"
                aria-label={reason.allowed ? `Allowed: ${label}` : `Not allowed: ${label}`}
                className={cn(
                  'max-w-full shadow-none',
                  reason.allowed
                    ? 'border-status-success/25 bg-status-success/10 text-status-success'
                    : 'border-status-danger/25 bg-status-danger/10 text-status-danger',
                )}
              >
                {reason.allowed ? (
                  <CheckIcon className="size-3 shrink-0" aria-hidden />
                ) : (
                  <XIcon className="size-3 shrink-0" aria-hidden />
                )}
                <span className="min-w-0 truncate">{label}</span>
              </Badge>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
