import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'

/**
 * B0 stub: org OWNER/ADMIN are allowed; everyone else is denied.
 * B3 replaces this with real effective-permission computation.
 */
export async function requirePermission(
  ctx: OrgContext,
  permission: string,
  subject?: { projectId?: string; cardId?: string },
): Promise<void> {
  void subject // B3 will authorize against the subject

  if (ctx.orgRole === 'OWNER' || ctx.orgRole === 'ADMIN') {
    return
  }
  throw AppError.permissionDenied(permission)
}
