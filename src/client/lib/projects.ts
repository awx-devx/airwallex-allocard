/**
 * A2 project-screen helpers. Pure — no React.
 *
 * Create-gating is UX only; server `requirePermission` is authoritative.
 */
import type { TimelineItem } from '@/components/patterns/types'
import { OrgRole } from '@/shared/enums/orgRole'
import { Permission } from '@/shared/enums/permissions'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import type { ActorType } from '@/shared/enums/audit'
import { listProjectsQuery, projectReadyForApproval } from '@/shared/schemas/project'
import type { MePermissions } from '@/shared/types/mePermissions'
import type { ListProjectsQuery, Project, ProjectSort } from '@/shared/types/project'

export type WizardStep = {
  id: string
  label: string
  optional: boolean
}

export const WIZARD_STEPS: readonly WizardStep[] = [
  { id: 'details', label: 'Details', optional: false },
  { id: 'budget', label: 'Budget', optional: false },
  { id: 'card-structure', label: 'Card structure', optional: false },
  { id: 'review', label: 'Review', optional: false },
  { id: 'launch', label: 'Launch', optional: false },
]

const SORT_COLUMN_IDS = ['updatedAt', 'name', 'createdAt', 'startDate', 'status'] as const
type SortColumnId = (typeof SORT_COLUMN_IDS)[number]

const CREATE_DENIED = "You don't have permission to create a project."

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0]
  }
  return value
}

function isSortColumnId(id: string): id is SortColumnId {
  return (SORT_COLUMN_IDS as readonly string[]).includes(id)
}

export function wizardStepIndex(id: string): number {
  const index = WIZARD_STEPS.findIndex((step) => step.id === id)
  if (index < 0) {
    throw new Error(`Unknown wizard step: ${id}`)
  }
  return index
}

export function nextWizardStepId(id: string): string | null {
  const index = wizardStepIndex(id)
  return WIZARD_STEPS[index + 1]?.id ?? null
}

export function prevWizardStepId(id: string): string | null {
  const index = wizardStepIndex(id)
  return WIZARD_STEPS[index - 1]?.id ?? null
}

export function canCreateProject(input: {
  orgRole: OrgRole | undefined
  me: MePermissions | undefined
}): boolean {
  if (input.orgRole === OrgRole.OWNER || input.orgRole === OrgRole.ADMIN) {
    return true
  }
  if (input.orgRole === OrgRole.MEMBER && input.me) {
    return input.me.projects.some((row) => row.permissions.includes(Permission.PROJECT_CREATE))
  }
  return false
}

export function createProjectDenialMessage(): string {
  return CREATE_DENIED
}

export function activeOrgRole(
  memberships: { orgId: string; orgRole: OrgRole }[],
  activeOrgId: string | null,
): OrgRole | undefined {
  if (activeOrgId === null) {
    return undefined
  }
  return memberships.find((row) => row.orgId === activeOrgId)?.orgRole
}

export function draftWizardHref(projectId: string): string {
  if (projectId.length < 1) {
    throw new Error('projectId is required')
  }
  return `/projects/new?draftId=${projectId}`
}

export function parseDraftId(input: { draftId?: string | string[] | undefined }): string | null {
  const raw = firstParam(input.draftId)
  if (raw === undefined || raw.length < 1) {
    return null
  }
  return raw
}

/** Trim a workstream name for Add / first-save. Empty after trim is omitted. */
export function normalisedWorkstreamName(raw: string): string | null {
  const name = raw.trim()
  if (name.length < 1 || name.length > 120) return null
  return name
}

/** Pending chips plus a typed-but-not-added name, in order. */
export function queueWorkstreamNames(pending: string[], draft: string): string[] {
  const next = normalisedWorkstreamName(draft)
  return next ? [...pending, next] : pending
}

/** Drop a locally queued workstream by index. Out of range is a no-op. */
export function withoutPendingWorkstream(pending: string[], index: number): string[] {
  if (index < 0 || index >= pending.length) return pending
  return pending.filter((_, i) => i !== index)
}

export function parseProjectListSearchParams(input: {
  status?: string | string[]
  ownerId?: string | string[]
  costCentre?: string | string[]
  page?: string | string[]
  pageSize?: string | string[]
  sort?: string | string[]
}): ListProjectsQuery {
  const raw: Record<string, string> = {}
  const status = firstParam(input.status)
  const ownerId = firstParam(input.ownerId)
  const costCentre = firstParam(input.costCentre)
  const page = firstParam(input.page)
  const pageSize = firstParam(input.pageSize)
  const sort = firstParam(input.sort)
  if (status !== undefined) raw.status = status
  if (ownerId !== undefined) raw.ownerId = ownerId
  if (costCentre !== undefined) raw.costCentre = costCentre
  if (page !== undefined) raw.page = page
  if (pageSize !== undefined) raw.pageSize = pageSize
  if (sort !== undefined) raw.sort = sort

  const parsed = listProjectsQuery.safeParse(raw)
  if (!parsed.success) {
    return { page: 1, pageSize: 20 }
  }
  return parsed.data
}

export function projectListHref(filter: {
  status?: ProjectStatus
  ownerId?: string
  costCentre?: string
  page?: number
  pageSize?: number
  sort?: ProjectSort
}): string {
  const params = new URLSearchParams()
  if (filter.status !== undefined) {
    params.set('status', filter.status)
  }
  if (filter.ownerId !== undefined) {
    params.set('ownerId', filter.ownerId)
  }
  if (filter.costCentre !== undefined) {
    params.set('costCentre', filter.costCentre)
  }
  if (filter.page !== undefined && filter.page !== 1) {
    params.set('page', String(filter.page))
  }
  if (filter.pageSize !== undefined && filter.pageSize !== 20) {
    params.set('pageSize', String(filter.pageSize))
  }
  if (filter.sort !== undefined) {
    params.set('sort', filter.sort)
  }
  const qs = params.toString()
  return qs.length > 0 ? `/projects?${qs}` : '/projects'
}

export function sortingToProjectSort(
  sorting: { id: string; direction: 'asc' | 'desc' } | null,
): ProjectSort | undefined {
  if (sorting === null || !isSortColumnId(sorting.id)) {
    return undefined
  }
  return sorting.direction === 'desc' ? (`-${sorting.id}` as ProjectSort) : sorting.id
}

export function projectSortToSorting(
  sort: ProjectSort | undefined,
): { id: string; direction: 'asc' | 'desc' } | null {
  if (sort === undefined) {
    return null
  }
  if (sort.startsWith('-')) {
    return { id: sort.slice(1), direction: 'desc' }
  }
  return { id: sort, direction: 'asc' }
}

function isProjectList(value: unknown): value is { items: Array<{ id: string }> } {
  if (typeof value !== 'object' || value === null || !('items' in value)) {
    return false
  }
  const items = (value as { items: unknown }).items
  if (!Array.isArray(items)) {
    return false
  }
  return items.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      'id' in item &&
      typeof (item as { id: unknown }).id === 'string',
  )
}

export function projectFromListCache(
  entries: ReadonlyArray<readonly [unknown, unknown]>,
  id: string,
): Project | undefined {
  for (const [, data] of entries) {
    if (!isProjectList(data)) {
      continue
    }
    const found = data.items.find((item) => item.id === id)
    if (found) {
      return found as Project
    }
  }
  return undefined
}

export function isReadyForApprovalInput(
  project: {
    name: string
    ownerId: string | null
    startDate: string | null
    endDate: string | null
  },
  hasBudget: boolean,
): boolean {
  return projectReadyForApproval.safeParse({
    name: project.name,
    ownerId: project.ownerId,
    startDate: project.startDate,
    endDate: project.endDate,
    hasBudget,
  }).success
}

export function hasBudgetFrom(
  project: { budgetSnapshot: { approved: number } | null },
  budgetApprovedAmount: number | null,
): boolean {
  return (budgetApprovedAmount ?? 0) > 0 || (project.budgetSnapshot?.approved ?? 0) > 0
}

export function toTimelineItem(item: {
  id: string
  at: string
  actorType: ActorType
  actorId: string
  summary: string
  subjectType: string
  subjectId: string
}): TimelineItem {
  return {
    id: item.id,
    at: item.at,
    actorType: item.actorType,
    actorId: item.actorId,
    summary: item.summary,
    subjectType: item.subjectType,
    subjectId: item.subjectId,
  }
}

export function cardStructureReviewLines(cs: {
  shared: boolean
  perMember: boolean
  vendor: boolean
  oneTime: boolean
}): string[] {
  return [
    cs.perMember
      ? 'This project intends per-member cards (issued by an enabled rule, not this switch).'
      : 'This project does not intend per-member cards.',
  ]
}

export const CARD_STRUCTURE_FLAGS = [
  {
    key: 'perMember' as const,
    label: 'Per-member',
    description: 'A personal card per person, if an enabled issuance rule covers their role.',
  },
]

export function launchExplainerMessage(): string {
  return 'When you launch, the project goes live. Member cards come from an enabled issuance rule, not from the structure switches.'
}

export function missingIssuanceRuleMessage(): string {
  return 'No cards will be issued on launch. There is no enabled issuance rule yet. Add the member-card template on Controls and turn it on.'
}

export function openControlsLabel(): string {
  return 'Open Controls'
}

export function shouldWarnNoCardsOnLaunch(input: {
  rulesLoaded: boolean
  hasEnabledIssuanceRule: boolean
}): boolean {
  return input.rulesLoaded && !input.hasEnabledIssuanceRule
}

/** Workspace route tabs — exactly these six; no Settings. */
export const WORKSPACE_TAB_HREFS = [
  { tab: 'Overview', href: (id: string) => `/projects/${id}`, phase: 'A3' },
  { tab: 'People', href: (id: string) => `/projects/${id}/people`, phase: 'A3' },
  { tab: 'Budget', href: (id: string) => `/projects/${id}/budget`, phase: 'A4' },
  { tab: 'Cards', href: (id: string) => `/projects/${id}/cards`, phase: 'A5' },
  { tab: 'Controls', href: (id: string) => `/projects/${id}/controls`, phase: 'A6' },
  { tab: 'Activity', href: (id: string) => `/projects/${id}/activity`, phase: 'A8' },
] as const
