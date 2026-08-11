import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import type { AccessScope } from '@/shared/types/accessScope'

/** Subject fields checked against an AccessScope (used by requirePermission / preview / client can). */
export type PermissionSubject = {
  cardId?: string
  workstreamId?: string
  categoryId?: string
  /** Resource owner / member user id — compared for OWN / ASSIGNED_MEMBERS. */
  userId?: string
  /** Caller — required for OWN checks. */
  callerUserId?: string
}

function parseBound(iso: string | undefined): number | null {
  if (iso === undefined) {
    return null
  }
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? null : ms
}

/** Inclusive `[validFrom, validTo]` window. Missing bounds are open. Invalid ISO → open. */
export function isScopeActive(scope: AccessScope, now: Date): boolean {
  const t = now.getTime()
  const from = parseBound(scope.validFrom)
  const to = parseBound(scope.validTo)
  if (from !== null && t < from) {
    return false
  }
  if (to !== null && t > to) {
    return false
  }
  return true
}

/**
 * Whether `scope` covers the concrete subject.
 * Scope never adds permissions — it only narrows which subjects they apply to.
 */
export function scopeCoversSubject(scope: AccessScope, subject: PermissionSubject): boolean {
  switch (scope.level) {
    case AccessScopeLevel.PROJECT:
      return true
    case AccessScopeLevel.WORKSTREAM: {
      const id = subject.workstreamId
      return id !== undefined && (scope.workstreamIds?.includes(id) ?? false)
    }
    case AccessScopeLevel.CATEGORY: {
      const id = subject.categoryId
      return id !== undefined && (scope.categoryIds?.includes(id) ?? false)
    }
    case AccessScopeLevel.CARD: {
      const id = subject.cardId
      return id !== undefined && (scope.cardIds?.includes(id) ?? false)
    }
    case AccessScopeLevel.OWN: {
      const { userId, callerUserId } = subject
      return userId !== undefined && callerUserId !== undefined && userId === callerUserId
    }
    case AccessScopeLevel.ASSIGNED_MEMBERS: {
      const id = subject.userId
      return id !== undefined && (scope.memberIds?.includes(id) ?? false)
    }
    default: {
      const _exhaustive: never = scope.level
      return _exhaustive
    }
  }
}
