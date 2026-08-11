/**
 * Client permission helpers — convenience for UX only, never a security control.
 * Server `requirePermission` is authoritative.
 */
'use client'

import { usePermissions } from '@/client/hooks/useSession'
import { can as canCheck, explainDenial } from '@/lib/permissions/can'
import type { PermissionSubject } from '@/shared/access/scope'
import type { Permission } from '@/shared/enums/permissions'
import type { MePermissions } from '@/shared/types/mePermissions'
import type { PermissionReason } from '@/shared/types/projectMember'

export type CanHelpers = {
  can: (permission: Permission, subject?: PermissionSubject) => boolean
  explain: (
    permission: Permission,
    subject?: PermissionSubject,
    reasons?: PermissionReason[],
  ) => string
}

/** Pure builder used by `useCan` — test without React. */
export function buildCanFromMe(me: MePermissions | undefined, projectId: string): CanHelpers {
  return {
    can: (permission, subject) => {
      if (!me) return false
      return canCheck(me, projectId, permission, subject)
    },
    explain: (permission, subject, reasons) => {
      if (!me) return 'No access to this project'
      return explainDenial(me, projectId, permission, subject, reasons)
    },
  }
}

export function useCan(projectId: string) {
  const query = usePermissions()
  const helpers = buildCanFromMe(query.data, projectId)
  return {
    ...helpers,
    isLoading: query.isLoading,
    isError: query.isError,
    me: query.data as MePermissions | undefined,
  }
}
