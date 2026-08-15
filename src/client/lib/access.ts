/**
 * A3 people-and-access screen helpers. Pure — no React.
 *
 * Preview formatting and last-admin gating are UX only; server
 * `requirePermission` / `computeEffectivePermissions` are authoritative.
 */
import type { TimelineItem } from '@/components/patterns/types'
import { isScopeActive } from '@/shared/access/scope'
import { ROLE_TEMPLATES } from '@/shared/constants/roleTemplates'
import { AccessReviewStatus } from '@/shared/enums/accessReviewStatus'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import type { ActorType } from '@/shared/enums/audit'
import { Permission } from '@/shared/enums/permissions'
import type { AccessScope } from '@/shared/types/accessScope'

export { isScopeActive }

const ADD_MEMBER_DENIED = "You don't have permission to manage members."
const ASSIGN_ROLE_DENIED = "You don't have permission to assign roles."
const MANAGE_REVIEW_DENIED = "You don't have permission to manage access reviews."
const LAST_ACCESS_MANAGER_DENIED = 'Cannot remove the last member who can manage access.'
const NO_ELIGIBLE_MEMBERS = 'Everyone in this organisation is already a member of this project.'

const NOT_YET_VALID = 'Access scope is not yet valid'
const EXPIRED = 'Access scope has expired'

export const PERMISSION_LABELS: Record<Permission, string> = {
  [Permission.PROJECT_VIEW]: 'view project',
  [Permission.PROJECT_EDIT]: 'edit project',
  [Permission.PROJECT_CREATE]: 'create project',
  [Permission.PROJECT_CLOSE]: 'close project',
  [Permission.BUDGET_VIEW]: 'view budget',
  [Permission.BUDGET_EDIT]: 'edit budget',
  [Permission.BUDGET_REQUEST]: 'request budget',
  [Permission.MEMBER_VIEW]: 'view members',
  [Permission.MEMBER_MANAGE]: 'manage members',
  [Permission.ROLE_ASSIGN]: 'assign roles',
  [Permission.CARD_CREATE]: 'create cards',
  [Permission.CARD_VIEW]: 'view cards',
  [Permission.CARD_VIEW_DETAILS]: 'view card details',
  [Permission.CARD_MANAGE]: 'manage cards',
  [Permission.PAYMENT_MAKE]: 'make payments',
  [Permission.REQUEST_APPROVE]: 'approve requests',
  [Permission.CONTROL_EDIT]: 'edit controls',
  [Permission.TRANSACTION_VIEW]: 'view transactions',
  [Permission.REPORT_EXPORT]: 'export reports',
}

export type PermissionGroup = {
  id: string
  label: string
  permissions: readonly Permission[]
}

export const PERMISSION_GROUPS: readonly PermissionGroup[] = [
  {
    id: 'project',
    label: 'Project',
    permissions: [
      Permission.PROJECT_VIEW,
      Permission.PROJECT_EDIT,
      Permission.PROJECT_CREATE,
      Permission.PROJECT_CLOSE,
    ],
  },
  {
    id: 'budget',
    label: 'Budget',
    permissions: [Permission.BUDGET_VIEW, Permission.BUDGET_EDIT, Permission.BUDGET_REQUEST],
  },
  {
    id: 'members',
    label: 'Members',
    permissions: [Permission.MEMBER_VIEW, Permission.MEMBER_MANAGE, Permission.ROLE_ASSIGN],
  },
  {
    id: 'cards',
    label: 'Cards',
    permissions: [
      Permission.CARD_CREATE,
      Permission.CARD_VIEW,
      Permission.CARD_VIEW_DETAILS,
      Permission.CARD_MANAGE,
    ],
  },
  {
    id: 'spend',
    label: 'Spend',
    permissions: [Permission.PAYMENT_MAKE, Permission.REQUEST_APPROVE],
  },
  {
    id: 'controls',
    label: 'Controls',
    permissions: [Permission.CONTROL_EDIT],
  },
  {
    id: 'data',
    label: 'Data',
    permissions: [Permission.TRANSACTION_VIEW, Permission.REPORT_EXPORT],
  },
]

export const SCOPE_LEVEL_LABELS: Record<AccessScopeLevel, string> = {
  [AccessScopeLevel.PROJECT]: 'Project',
  [AccessScopeLevel.WORKSTREAM]: 'Workstream',
  [AccessScopeLevel.CATEGORY]: 'Category',
  [AccessScopeLevel.CARD]: 'Card',
  [AccessScopeLevel.OWN]: 'Own',
  [AccessScopeLevel.ASSIGNED_MEMBERS]: 'Assigned members',
}

export const SETTINGS_NAV = [
  { href: '/settings/roles', label: 'Roles' },
  { href: '/settings/access-reviews', label: 'Access reviews' },
] as const

export type ScopeSummaryNames = {
  workstreams?: Record<string, string>
  categories?: Record<string, string>
  cards?: Record<string, string>
  members?: Record<string, string>
}

export type MemberAccessKind = 'active' | 'expired' | 'not_yet_valid'

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0]
  }
  return value
}

function parseBound(iso: string | undefined): number | null {
  if (iso === undefined) {
    return null
  }
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? null : ms
}

function requireProjectId(projectId: string): string {
  if (projectId.length < 1) {
    throw new Error('projectId is required')
  }
  return projectId
}

function idsForLevel(scope: {
  level: AccessScopeLevel
  workstreamIds?: string[]
  categoryIds?: string[]
  cardIds?: string[]
  memberIds?: string[]
}): string[] {
  switch (scope.level) {
    case AccessScopeLevel.WORKSTREAM:
      return scope.workstreamIds ?? []
    case AccessScopeLevel.CATEGORY:
      return scope.categoryIds ?? []
    case AccessScopeLevel.CARD:
      return scope.cardIds ?? []
    case AccessScopeLevel.ASSIGNED_MEMBERS:
      return scope.memberIds ?? []
    default:
      return []
  }
}

function nameMapForLevel(
  level: AccessScopeLevel,
  names: ScopeSummaryNames | undefined,
): Record<string, string> | undefined {
  switch (level) {
    case AccessScopeLevel.WORKSTREAM:
      return names?.workstreams
    case AccessScopeLevel.CATEGORY:
      return names?.categories
    case AccessScopeLevel.CARD:
      return names?.cards
    case AccessScopeLevel.ASSIGNED_MEMBERS:
      return names?.members
    default:
      return undefined
  }
}

export function formatPermissionReason(reason: {
  permission: Permission
  allowed: boolean
  message: string
}): string {
  const verb = reason.allowed ? 'Can' : 'Cannot'
  return `${verb} ${PERMISSION_LABELS[reason.permission]} — ${reason.message}`
}

export function scopeSummary(
  scope: {
    level: AccessScopeLevel
    workstreamIds?: string[]
    categoryIds?: string[]
    cardIds?: string[]
    memberIds?: string[]
    validFrom?: string
    validTo?: string
  },
  names?: ScopeSummaryNames,
): string {
  const parts = [`Scope: ${SCOPE_LEVEL_LABELS[scope.level]}`]
  const ids = idsForLevel(scope)
  if (ids.length > 0) {
    const map = nameMapForLevel(scope.level, names)
    parts.push(ids.map((id) => map?.[id] ?? id).join(', '))
  }
  if (scope.validFrom !== undefined) {
    parts.push(`from ${scope.validFrom}`)
  }
  if (scope.validTo !== undefined) {
    parts.push(`until ${scope.validTo}`)
  }
  return parts.join(' ')
}

export function scopeWindowReason(
  scope: { validFrom?: string; validTo?: string },
  now: Date,
): typeof NOT_YET_VALID | typeof EXPIRED | null {
  const from = parseBound(scope.validFrom)
  const to = parseBound(scope.validTo)
  const t = now.getTime()
  if (from !== null && t < from) {
    return NOT_YET_VALID
  }
  if (to !== null && t > to) {
    return EXPIRED
  }
  return null
}

export function memberAccessState(
  member: { scope: AccessScope },
  now: Date,
): { kind: MemberAccessKind; reason: string | null } {
  const reason = scopeWindowReason(member.scope, now)
  if (reason === NOT_YET_VALID) {
    return { kind: 'not_yet_valid', reason }
  }
  if (reason === EXPIRED) {
    return { kind: 'expired', reason }
  }
  return { kind: 'active', reason: null }
}

export function isLastAccessManager(
  members: { userId: string; scope: AccessScope; effectivePermissions: Permission[] }[],
  userId: string,
  now: Date,
): boolean {
  const managers = members.filter(
    (member) =>
      isScopeActive(member.scope, now) &&
      member.effectivePermissions.includes(Permission.MEMBER_MANAGE),
  )
  return managers.length === 1 && managers[0]?.userId === userId
}

export function lastAccessManagerDenialMessage(): string {
  return LAST_ACCESS_MANAGER_DENIED
}

export function countMembersHoldingRole(
  roleId: string,
  lists: ReadonlyArray<ReadonlyArray<{ roleId: string }>>,
): number {
  let count = 0
  for (const list of lists) {
    for (const member of list) {
      if (member.roleId === roleId) {
        count += 1
      }
    }
  }
  return count
}

export function isScopeSelectionComplete(scope: AccessScope): boolean {
  const idsOk = (() => {
    switch (scope.level) {
      case AccessScopeLevel.PROJECT:
      case AccessScopeLevel.OWN:
        return true
      case AccessScopeLevel.WORKSTREAM:
        return (scope.workstreamIds?.length ?? 0) >= 1
      case AccessScopeLevel.CATEGORY:
        return (scope.categoryIds?.length ?? 0) >= 1
      case AccessScopeLevel.CARD:
        return (scope.cardIds?.length ?? 0) >= 1
      case AccessScopeLevel.ASSIGNED_MEMBERS:
        return (scope.memberIds?.length ?? 0) >= 1
      default: {
        const _exhaustive: never = scope.level
        return _exhaustive
      }
    }
  })()
  if (!idsOk) {
    return false
  }
  if (scope.validFrom !== undefined && scope.validTo !== undefined) {
    return scope.validTo >= scope.validFrom
  }
  return true
}

export function buildAccessScope(input: {
  level: AccessScopeLevel
  workstreamIds?: string[]
  categoryIds?: string[]
  cardIds?: string[]
  memberIds?: string[]
  validFrom?: string | null
  validTo?: string | null
}): AccessScope {
  const scope: AccessScope = { level: input.level }
  if (input.level === AccessScopeLevel.WORKSTREAM && (input.workstreamIds?.length ?? 0) > 0) {
    scope.workstreamIds = input.workstreamIds
  }
  if (input.level === AccessScopeLevel.CATEGORY && (input.categoryIds?.length ?? 0) > 0) {
    scope.categoryIds = input.categoryIds
  }
  if (input.level === AccessScopeLevel.CARD && (input.cardIds?.length ?? 0) > 0) {
    scope.cardIds = input.cardIds
  }
  if (input.level === AccessScopeLevel.ASSIGNED_MEMBERS && (input.memberIds?.length ?? 0) > 0) {
    scope.memberIds = input.memberIds
  }
  if (input.validFrom) {
    scope.validFrom = input.validFrom
  }
  if (input.validTo) {
    scope.validTo = input.validTo
  }
  return scope
}

/** Fail-open while the session query is in flight — loading is not a denial. */
export function permissionGateAllowed(allowed: boolean, loading: boolean): boolean {
  return loading || allowed
}

export function noEligibleMembersToAddMessage(): string {
  return NO_ELIGIBLE_MEMBERS
}

export function eligibleOrgMembersToAdd(
  orgMembers: {
    status: 'ACTIVE' | 'SUSPENDED'
    user: { id: string; name: string; email: string }
  }[],
  projectMembers: { userId: string }[],
): { id: string; name: string; email: string }[] {
  const taken = new Set(projectMembers.map((member) => member.userId))
  return orgMembers
    .filter((row) => row.status === 'ACTIVE' && !taken.has(row.user.id))
    .map((row) => ({ id: row.user.id, name: row.user.name, email: row.user.email }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function memberHasCards(
  userId: string,
  cards: { cardholderId: string; accessList: string[] }[],
  cardholders: { id: string; userId: string | null }[],
): boolean {
  const holderById = new Map(cardholders.map((holder) => [holder.id, holder]))
  return cards.some((card) => {
    if (card.accessList.includes(userId)) {
      return true
    }
    return holderById.get(card.cardholderId)?.userId === userId
  })
}

export function addMemberHref(projectId: string): string {
  return `/projects/${requireProjectId(projectId)}/people/add`
}

export function peopleHref(projectId: string): string {
  return `/projects/${requireProjectId(projectId)}/people`
}

export function parseAccessReviewSearchParams(input: {
  status?: string | string[]
  projectId?: string | string[]
}): { status?: 'OPEN' | 'RESOLVED'; projectId?: string } {
  const out: { status?: 'OPEN' | 'RESOLVED'; projectId?: string } = {}
  const status = firstParam(input.status)
  if (status === AccessReviewStatus.OPEN || status === AccessReviewStatus.RESOLVED) {
    out.status = status
  }
  const projectId = firstParam(input.projectId)
  if (projectId !== undefined && projectId.length > 0) {
    out.projectId = projectId
  }
  return out
}

export function accessReviewListHref(filter: {
  status?: 'OPEN' | 'RESOLVED'
  projectId?: string
}): string {
  const params = new URLSearchParams()
  if (filter.status !== undefined) {
    params.set('status', filter.status)
  }
  if (filter.projectId !== undefined && filter.projectId.length > 0) {
    params.set('projectId', filter.projectId)
  }
  const qs = params.toString()
  return qs.length > 0 ? `/settings/access-reviews?${qs}` : '/settings/access-reviews'
}

export function previewWouldDeny(
  preview: { reasons: { permission: Permission; allowed: boolean }[] },
  permission: Permission,
): boolean {
  const match = preview.reasons.find((reason) => reason.permission === permission)
  if (match === undefined) {
    return true
  }
  return match.allowed === false
}

export function toAccessHistoryTimelineItem(entry: {
  id: string
  action: string
  actorType: ActorType
  actorId: string
  subjectType: string
  subjectId: string
  at: string
}): TimelineItem {
  return {
    id: entry.id,
    at: entry.at,
    actorType: entry.actorType,
    actorId: entry.actorId,
    summary: entry.action,
    subjectType: entry.subjectType,
    subjectId: entry.subjectId,
  }
}

export function addMemberDenialMessage(): string {
  return ADD_MEMBER_DENIED
}

export function assignRoleDenialMessage(): string {
  return ASSIGN_ROLE_DENIED
}

export function manageAccessReviewDenialMessage(): string {
  return MANAGE_REVIEW_DENIED
}

export function sortRolesForMatrix<T extends { key: string; name: string; isTemplate: boolean }>(
  roles: T[],
): T[] {
  const templateOrder = new Map(ROLE_TEMPLATES.map((template, index) => [template.key, index]))
  const templates = roles.filter((role) => role.isTemplate)
  const custom = roles.filter((role) => !role.isTemplate)
  templates.sort((a, b) => {
    const ia = templateOrder.get(a.key) ?? Number.POSITIVE_INFINITY
    const ib = templateOrder.get(b.key) ?? Number.POSITIVE_INFINITY
    if (ia !== ib) {
      return ia - ib
    }
    return a.name.localeCompare(b.name)
  })
  custom.sort((a, b) => a.name.localeCompare(b.name))
  return [...templates, ...custom]
}
