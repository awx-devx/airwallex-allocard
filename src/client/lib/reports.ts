/**
 * A9 report, audit, and closure screen helpers. Pure — no React.
 *
 * Totals come from B9 report hooks. This file does not import or reimplement
 * `projectBudget`. Amounts stay integer minor units.
 */
import type { BudgetBarProps } from '@/components/patterns/types'
import { accessReviewListHref, peopleHref } from '@/client/lib/access'
import { budgetHref, projectionToBudgetBarProps } from '@/client/lib/budget'
import { cardHref } from '@/client/lib/cards'
import { requestHref } from '@/client/lib/requests'
import { transactionHref, transactionListHref } from '@/client/lib/transactions'
import { ClosureStep } from '@/shared/enums/closureStep'
import { OrgRole } from '@/shared/enums/orgRole'
import { Permission } from '@/shared/enums/permissions'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import { isoDateSchema } from '@/shared/schemas/base'

export {
  accessReviewListHref,
  budgetHref,
  cardHref,
  peopleHref,
  requestHref,
  transactionHref,
  transactionListHref,
}

export const SETTLE_POLL_MS = 5000
export const CLOSE_CONFIRM_PHRASE = 'CLOSE'
export const ARCHIVE_CONFIRM_PHRASE = 'ARCHIVE'

export const CLOSURE_STEPS = [
  { id: ClosureStep.PREFLIGHT, label: 'Pre-flight' },
  { id: ClosureStep.FREEZE, label: 'Freeze' },
  { id: ClosureStep.SETTLE, label: 'Settle' },
  { id: ClosureStep.REVOKE, label: 'Revoke access' },
  { id: ClosureStep.CLOSE_CARDS, label: 'Close cards' },
  { id: ClosureStep.FINAL_REPORT, label: 'Final report' },
  { id: ClosureStep.ARCHIVE, label: 'Archive' },
] as const satisfies readonly { id: ClosureStep; label: string }[]

const CLOSURE_STEP_IDS = new Set<string>(Object.values(ClosureStep))

export type AuditListSearch = {
  subjectType?: string
  subjectId?: string
  actorId?: string
  action?: string
  projectId?: string
  from?: string
  to?: string
}

export type ExportSearch = {
  projectId?: string
  from?: string
  to?: string
}

export type EmptyCopy = { title: string; description: string }

export type ConfirmCopy = {
  title: string
  confirmLabel: string
  phrase: string
  prompt: string
  description?: string
}

const EXPORT_DENIED = "You don't have permission to export reports."
const AUDIT_DENIED = "You don't have permission to view the audit log."
const CLOSE_DENIED = "You don't have permission to close this project."
const PROJECT_NOT_FOUND = 'This project is not available.'
const FINAL_REPORT_MISSING = 'No final report yet.'
const MIXED_CURRENCY = 'Some projects are in another currency and are excluded from totals.'
const EXPORT_IN_PROGRESS = 'Export in progress — you can keep using the page.'
const CLOSURE_BLOCKED = 'Cannot start until these are resolved.'
const CLOSURE_RESUME = 'This closure is in progress. Continuing from the current step.'
const SETTLE_WAITING = 'Waiting for pending authorizations to clear or expire.'
const POST_CLOSE_CLEARING = 'Pending transactions will still clear after cards are closed.'
const ARCHIVED_PROJECT = 'This project is archived. It is read-only.'
const START_CLOSURE = 'Start closure'
const CLOSE_CARDS_AND_ARCHIVE = 'Close cards and archive'
const CLOSE_PROJECT = 'Close project'
const RESUME_CLOSURE = 'Resume closure'
const FINAL_REPORT = 'Final report'
const VIEW_IN_AUDIT = 'View in audit'

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0]
  }
  return value
}

function requireId(id: string, name: string): string {
  if (id.length < 1) {
    throw new Error(`${name} is required`)
  }
  return id
}

function appendQuery(
  path: string,
  entries: ReadonlyArray<readonly [string, string | undefined]>,
): string {
  const params = new URLSearchParams()
  for (const [key, value] of entries) {
    if (value !== undefined) {
      params.set(key, value)
    }
  }
  const qs = params.toString()
  return qs.length > 0 ? `${path}?${qs}` : path
}

function holdsPermission(
  orgRole: string | undefined,
  projects: ReadonlyArray<{ permissions: readonly string[] }> | undefined,
  permission: Permission,
): boolean {
  if (orgRole === OrgRole.OWNER || orgRole === OrgRole.ADMIN) {
    return true
  }
  return Boolean(projects?.some((row) => row.permissions.includes(permission)))
}

function isClosureStep(value: string | undefined): value is ClosureStep {
  return value !== undefined && CLOSURE_STEP_IDS.has(value)
}

export function reportsHref(): string {
  return '/reports'
}

export function organizationReportHref(): string {
  return '/reports/organization'
}

export function projectReportHref(projectId: string): string {
  return `/reports/project/${requireId(projectId, 'projectId')}`
}

export function auditHref(): string {
  return '/audit'
}

export function auditListHref(filter: AuditListSearch): string {
  return appendQuery('/audit', [
    [
      'subjectType',
      filter.subjectType !== undefined && filter.subjectType.length >= 1
        ? filter.subjectType
        : undefined,
    ],
    [
      'subjectId',
      filter.subjectId !== undefined && filter.subjectId.length >= 1 ? filter.subjectId : undefined,
    ],
    [
      'actorId',
      filter.actorId !== undefined && filter.actorId.length >= 1 ? filter.actorId : undefined,
    ],
    [
      'action',
      filter.action !== undefined && filter.action.length >= 1 ? filter.action : undefined,
    ],
    [
      'projectId',
      filter.projectId !== undefined && filter.projectId.length >= 1 ? filter.projectId : undefined,
    ],
    ['from', filter.from !== undefined && filter.from.length >= 1 ? filter.from : undefined],
    ['to', filter.to !== undefined && filter.to.length >= 1 ? filter.to : undefined],
  ])
}

export function closureHref(projectId: string): string {
  return `/projects/${requireId(projectId, 'projectId')}/closure`
}

export function finalReportHref(projectId: string): string {
  return `/projects/${requireId(projectId, 'projectId')}/report/final`
}

export function parseOptionalIdParam(input: string | string[] | undefined): string | undefined {
  const value = firstParam(input)
  if (value === undefined || value.length < 1) {
    return undefined
  }
  return value
}

export function parseIsoQueryParam(input: string | string[] | undefined): string | undefined {
  const value = firstParam(input)
  if (value === undefined) {
    return undefined
  }
  const parsed = isoDateSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

function parseFreeStringParam(input: string | string[] | undefined): string | undefined {
  const value = firstParam(input)
  if (value === undefined || value.length < 1) {
    return undefined
  }
  return value
}

export function parseAuditSearchParams(input: {
  subjectType?: string | string[]
  subjectId?: string | string[]
  actorId?: string | string[]
  action?: string | string[]
  projectId?: string | string[]
  from?: string | string[]
  to?: string | string[]
}): AuditListSearch {
  const result: AuditListSearch = {}
  const subjectType = parseFreeStringParam(input.subjectType)
  const subjectId = parseOptionalIdParam(input.subjectId)
  const actorId = parseOptionalIdParam(input.actorId)
  const action = parseFreeStringParam(input.action)
  const projectId = parseOptionalIdParam(input.projectId)
  const from = parseIsoQueryParam(input.from)
  const to = parseIsoQueryParam(input.to)
  if (subjectType !== undefined) result.subjectType = subjectType
  if (subjectId !== undefined) result.subjectId = subjectId
  if (actorId !== undefined) result.actorId = actorId
  if (action !== undefined) result.action = action
  if (projectId !== undefined) result.projectId = projectId
  if (from !== undefined) result.from = from
  if (to !== undefined) result.to = to
  return result
}

export function parseExportSearchParams(input: {
  projectId?: string | string[]
  from?: string | string[]
  to?: string | string[]
}): ExportSearch {
  const result: ExportSearch = {}
  const projectId = parseOptionalIdParam(input.projectId)
  const from = parseIsoQueryParam(input.from)
  const to = parseIsoQueryParam(input.to)
  if (projectId !== undefined) result.projectId = projectId
  if (from !== undefined) result.from = from
  if (to !== undefined) result.to = to
  return result
}

export function exportCatalogueHref(filter: ExportSearch): string {
  return appendQuery('/reports', [
    [
      'projectId',
      filter.projectId !== undefined && filter.projectId.length >= 1 ? filter.projectId : undefined,
    ],
    ['from', filter.from !== undefined && filter.from.length >= 1 ? filter.from : undefined],
    ['to', filter.to !== undefined && filter.to.length >= 1 ? filter.to : undefined],
  ])
}

export function exportBody(filter: ExportSearch): ExportSearch {
  const result: ExportSearch = {}
  if (filter.projectId !== undefined && filter.projectId.length >= 1) {
    result.projectId = filter.projectId
  }
  if (filter.from !== undefined && filter.from.length >= 1) {
    result.from = filter.from
  }
  if (filter.to !== undefined && filter.to.length >= 1) {
    result.to = filter.to
  }
  return result
}

export function holdsReportExport(
  orgRole: string | undefined,
  projects: ReadonlyArray<{ permissions: readonly string[] }> | undefined,
): boolean {
  return holdsPermission(orgRole, projects, Permission.REPORT_EXPORT)
}

export function holdsMemberManage(
  orgRole: string | undefined,
  projects: ReadonlyArray<{ permissions: readonly string[] }> | undefined,
): boolean {
  return holdsPermission(orgRole, projects, Permission.MEMBER_MANAGE)
}

export function holdsProjectClose(
  orgRole: string | undefined,
  projects: ReadonlyArray<{ permissions: readonly string[] }> | undefined,
): boolean {
  return holdsPermission(orgRole, projects, Permission.PROJECT_CLOSE)
}

export function isProjectArchived(status: string): boolean {
  return status === ProjectStatus.ARCHIVED
}

export function isProjectClosing(status: string): boolean {
  return status === ProjectStatus.CLOSING
}

export function isProjectCloseable(status: string): boolean {
  return status === ProjectStatus.ACTIVE
}

export function closureActiveStep(status: string, currentStep: string | undefined): ClosureStep {
  if (status === ProjectStatus.CLOSING && isClosureStep(currentStep)) {
    return currentStep
  }
  return ClosureStep.PREFLIGHT
}

export function stepStatusOf(
  steps: ReadonlyArray<{ step: string; status: string }>,
  step: string,
): string | undefined {
  return steps.find((row) => row.step === step)?.status
}

export function settleIsDone(steps: ReadonlyArray<{ step: string; status: string }>): boolean {
  return stepStatusOf(steps, ClosureStep.SETTLE) === 'DONE'
}

export function shouldPollSettle(
  currentStep: string,
  steps: ReadonlyArray<{ step: string; status: string }>,
): boolean {
  if (currentStep !== ClosureStep.SETTLE) {
    return false
  }
  const status = stepStatusOf(steps, ClosureStep.SETTLE)
  return status === 'BLOCKED' || status === 'IN_PROGRESS'
}

export function canClickStart(input: {
  projectStatus: string
  canStart: boolean
  archived: boolean
}): boolean {
  return input.projectStatus === ProjectStatus.ACTIVE && input.canStart && !input.archived
}

export function canClickComplete(input: {
  projectStatus: string
  steps: ReadonlyArray<{ step: string; status: string }>
  archived: boolean
}): boolean {
  return (
    input.projectStatus === ProjectStatus.CLOSING && settleIsDone(input.steps) && !input.archived
  )
}

export function blockerHref(
  item: { subjectType: string; subjectId: string },
  projectId: string,
): string {
  requireId(projectId, 'projectId')
  if (item.subjectType === 'transaction') {
    return transactionHref(item.subjectId)
  }
  if (item.subjectType === 'purchaseRequest') {
    return requestHref(item.subjectId)
  }
  if (item.subjectType === 'card') {
    return cardHref(item.subjectId)
  }
  return peopleHref(projectId)
}

export function orgTotalsExcludeSomeProjects(
  projects: ReadonlyArray<{ approved: number }>,
  totals: { approved: number },
): boolean {
  let sum = 0
  for (const row of projects) {
    sum += row.approved
  }
  return sum !== totals.approved
}

export function reportOverCommitted(remaining: number): boolean {
  return remaining < 0
}

export function reportToBudgetBar(report: {
  approved: number
  committed: number
  actual: number
  remaining: number
  utilisationPct: number
  currency: string
}): BudgetBarProps {
  return projectionToBudgetBarProps(
    {
      approved: report.approved,
      committed: report.committed,
      actual: report.actual,
      remaining: report.remaining,
      utilisationPct: report.utilisationPct,
      overCommitted: reportOverCommitted(report.remaining),
    },
    report.currency,
  )
}

export function memberDisplayName(
  userId: string,
  members: ReadonlyArray<{ userId: string; user?: { name?: string } }>,
): string {
  const match = members.find((row) => row.userId === userId)
  const name = match?.user?.name
  if (name !== undefined && name.length >= 1) {
    return name
  }
  return userId
}

export function completeClosureInput(): { confirmCloseCards: true; confirmArchive: true } {
  return { confirmCloseCards: true, confirmArchive: true }
}

export function exportReportsDenialMessage(): string {
  return EXPORT_DENIED
}

export function viewAuditDenialMessage(): string {
  return AUDIT_DENIED
}

export function closeProjectDenialMessage(): string {
  return CLOSE_DENIED
}

export function projectNotFoundMessage(): string {
  return PROJECT_NOT_FOUND
}

export function finalReportMissingMessage(): string {
  return FINAL_REPORT_MISSING
}

export function mixedCurrencyMessage(): string {
  return MIXED_CURRENCY
}

export function exportInProgressMessage(): string {
  return EXPORT_IN_PROGRESS
}

export function closureBlockedHeading(): string {
  return CLOSURE_BLOCKED
}

export function closureResumeMessage(): string {
  return CLOSURE_RESUME
}

export function settleWaitingMessage(): string {
  return SETTLE_WAITING
}

export function postCloseClearingMessage(): string {
  return POST_CLOSE_CLEARING
}

export function archivedProjectMessage(): string {
  return ARCHIVED_PROJECT
}

export function startClosureLabel(): string {
  return START_CLOSURE
}

export function closeCardsAndArchiveLabel(): string {
  return CLOSE_CARDS_AND_ARCHIVE
}

export function closeProjectLink(): string {
  return CLOSE_PROJECT
}

export function resumeClosureLink(): string {
  return RESUME_CLOSURE
}

export function finalReportLink(): string {
  return FINAL_REPORT
}

export function viewInAuditLink(): string {
  return VIEW_IN_AUDIT
}

export function noReportEmpty(): EmptyCopy {
  return {
    title: 'No report yet',
    description: 'Budget versus actual appears once a project has a ledger.',
  }
}

export function noOrgProjectsEmpty(): EmptyCopy {
  return {
    title: 'No projects to roll up',
    description: 'Projects you can export will appear here.',
  }
}

export function noAuditEmpty(): EmptyCopy {
  return {
    title: 'No audit entries',
    description: 'Try a wider filter, or pick a subject.',
  }
}

export function closeCardsConfirm(): ConfirmCopy {
  return {
    title: 'Close all project cards?',
    confirmLabel: 'Close cards',
    phrase: CLOSE_CONFIRM_PHRASE,
    prompt: 'Type CLOSE to close all project cards.',
    description: postCloseClearingMessage(),
  }
}

export function archiveConfirm(): ConfirmCopy {
  return {
    title: 'Archive this project?',
    confirmLabel: 'Archive',
    phrase: ARCHIVE_CONFIRM_PHRASE,
    prompt: 'Type ARCHIVE to archive this project.',
  }
}
