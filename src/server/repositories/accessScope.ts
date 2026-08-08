import type { AccessScopeFields } from '@/server/models/accessScope'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import type { AccessScope } from '@/shared/types/accessScope'

/** Domain AccessScope (ISO dates) → Mongo storage fields (Date). */
export function toAccessScopeFields(scope: AccessScope): AccessScopeFields {
  const fields: AccessScopeFields = { level: scope.level }
  if (scope.workstreamIds !== undefined) fields.workstreamIds = scope.workstreamIds
  if (scope.categoryIds !== undefined) fields.categoryIds = scope.categoryIds
  if (scope.cardIds !== undefined) fields.cardIds = scope.cardIds
  if (scope.memberIds !== undefined) fields.memberIds = scope.memberIds
  if (scope.validFrom !== undefined) fields.validFrom = new Date(scope.validFrom)
  if (scope.validTo !== undefined) fields.validTo = new Date(scope.validTo)
  return fields
}

/** Lean/toJSON scope blob → domain AccessScope. */
export function toAccessScope(raw: unknown): AccessScope {
  const row = (raw ?? {}) as Record<string, unknown>
  const scope: AccessScope = {
    level: row.level as AccessScopeLevel,
  }
  if (Array.isArray(row.workstreamIds)) {
    scope.workstreamIds = row.workstreamIds.map(String)
  }
  if (Array.isArray(row.categoryIds)) {
    scope.categoryIds = row.categoryIds.map(String)
  }
  if (Array.isArray(row.cardIds)) {
    scope.cardIds = row.cardIds.map(String)
  }
  if (Array.isArray(row.memberIds)) {
    scope.memberIds = row.memberIds.map(String)
  }
  if (row.validFrom != null) {
    scope.validFrom = String(row.validFrom)
  }
  if (row.validTo != null) {
    scope.validTo = String(row.validTo)
  }
  return scope
}
