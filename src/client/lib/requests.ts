/**
 * A7 purchase-request & approval screen helpers. Pure — no React.
 *
 * Policy evaluation is server-side (`usePolicyPreview` / submit).
 * This file does not import or reimplement `evaluatePolicy`.
 */
import { cardHref, controlsHref, projectCardsHref } from '@/client/lib/cards'
import { ApprovalDecision } from '@/shared/enums/approvalDecision'
import { ApproverSelection } from '@/shared/enums/approverSelection'
import { OrgRole } from '@/shared/enums/orgRole'
import { Permission } from '@/shared/enums/permissions'
import { PolicyOutcome } from '@/shared/enums/policyOutcome'
import { PurchaseRequestStatus } from '@/shared/enums/purchaseRequestStatus'
import { listApprovalsQuery, listPurchaseRequestsQuery } from '@/shared/schemas/purchaseRequest'
import type { ApprovalRuleBody, ApproverSelector } from '@/shared/types/approvalRule'
import type { ListApprovalsQuery } from '@/shared/types/purchaseRequest'

export { cardHref, controlsHref, projectCardsHref }

const CREATE_DENIED = "You don't have permission to create a purchase request."
const LIST_DENIED = "You don't have permission to view purchase requests."
const DECIDE_DENIED = "You don't have permission to approve requests."
const SELF_APPROVAL = 'You cannot approve your own request.'
const ALREADY_DECIDED = 'You already decided this request.'
const REQUEST_NOT_FOUND = 'This request is not available.'
const EXPIRED_REQUEST = 'This request expired.'
const REJECTED_FALLBACK = 'This request was rejected.'
const BUDGET_SHORTFALL = 'Remaining budget is less than this request.'
const UNLOCKED_CARD = 'This approval unlocked a card.'
const UNLOCKED_HEADING = 'What this approval unlocked'
const UNLOCKED_NONE =
  'Approved. Budget is reserved. A rule may issue a card — none is linked on this request yet.'
const NO_PROJECT_RULES = 'No project approval rules. Org defaults still apply on submit.'
const WIZARD_APPROVAL_RULES_LINK = 'Set approval rules on the controls tab.'
const CHECKING_POLICY = 'Checking policy…'
const POLICY_PREVIEW_FAILED = 'Unable to check policy.'
const NO_APPROVAL_NEEDED = 'No approval needed.'
const NOT_PERMITTED_HEADING = 'Not permitted.'

export const POLICY_PREVIEW_DEBOUNCE_MS = 300

export type RequestListSearch = {
  projectId?: string
  page: number
  pageSize: number
}

export type EmptyCopy = { title: string; description: string }

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

export function requestsHref(): string {
  return '/requests'
}

export function requestHref(requestId: string): string {
  return `/requests/${requireId(requestId, 'requestId')}`
}

export function newRequestHref(projectId?: string): string {
  return appendQuery('/requests/new', [
    ['projectId', projectId !== undefined && projectId.length >= 1 ? projectId : undefined],
  ])
}

export function approvalsHref(): string {
  return '/approvals'
}

export function approvalHref(requestId: string): string {
  return `/approvals/${requireId(requestId, 'requestId')}`
}

export function parseOptionalIdParam(input: string | string[] | undefined): string | undefined {
  const value = firstParam(input)
  if (value === undefined || value.length < 1) {
    return undefined
  }
  return value
}

export function parseRequestListSearchParams(input: {
  projectId?: string | string[]
  page?: string | string[]
  pageSize?: string | string[]
  status?: string | string[]
}): RequestListSearch {
  const projectId = firstParam(input.projectId)
  const page = firstParam(input.page)
  const pageSize = firstParam(input.pageSize)
  const raw: Record<string, string> = {}
  if (page !== undefined) raw.page = page
  if (pageSize !== undefined) raw.pageSize = pageSize

  const parsed = listPurchaseRequestsQuery.safeParse(raw)
  const base: RequestListSearch = parsed.success
    ? { page: parsed.data.page, pageSize: parsed.data.pageSize }
    : { page: 1, pageSize: 20 }

  if (projectId !== undefined && projectId.length >= 1) {
    return { ...base, projectId }
  }
  return base
}

export function requestListHref(filter: {
  projectId?: string
  page?: number
  pageSize?: number
}): string {
  return appendQuery('/requests', [
    [
      'projectId',
      filter.projectId !== undefined && filter.projectId.length >= 1 ? filter.projectId : undefined,
    ],
    ['page', filter.page !== undefined && filter.page !== 1 ? String(filter.page) : undefined],
    [
      'pageSize',
      filter.pageSize !== undefined && filter.pageSize !== 20 ? String(filter.pageSize) : undefined,
    ],
  ])
}

export function parseApprovalsSearchParams(input: {
  page?: string | string[]
  pageSize?: string | string[]
}): ListApprovalsQuery {
  const page = firstParam(input.page)
  const pageSize = firstParam(input.pageSize)
  const raw: Record<string, string> = {}
  if (page !== undefined) raw.page = page
  if (pageSize !== undefined) raw.pageSize = pageSize

  const parsed = listApprovalsQuery.safeParse(raw)
  if (!parsed.success) {
    return { page: 1, pageSize: 20 }
  }
  return parsed.data
}

export function approvalsListHref(filter: { page?: number; pageSize?: number }): string {
  return appendQuery('/approvals', [
    ['page', filter.page !== undefined && filter.page !== 1 ? String(filter.page) : undefined],
    [
      'pageSize',
      filter.pageSize !== undefined && filter.pageSize !== 20 ? String(filter.pageSize) : undefined,
    ],
  ])
}

export function holdsRequestApprove(
  orgRole: string | undefined,
  projects: ReadonlyArray<{ permissions: readonly string[] }> | undefined,
): boolean {
  return holdsPermission(orgRole, projects, Permission.REQUEST_APPROVE)
}

export function holdsPaymentMake(
  orgRole: string | undefined,
  projects: ReadonlyArray<{ permissions: readonly string[] }> | undefined,
): boolean {
  return holdsPermission(orgRole, projects, Permission.PAYMENT_MAKE)
}

export function isSelfApproval(requestedBy: string, viewerUserId: string | undefined): boolean {
  return (
    requestedBy.length >= 1 &&
    viewerUserId !== undefined &&
    viewerUserId.length >= 1 &&
    requestedBy === viewerUserId
  )
}

export function viewerHasDecided(
  approvals: ReadonlyArray<{ approverId: string }>,
  viewerUserId: string | undefined,
): boolean {
  if (viewerUserId === undefined || viewerUserId.length < 1) {
    return false
  }
  return approvals.some((entry) => entry.approverId === viewerUserId)
}

export function isTerminalRequestStatus(status: string): boolean {
  return (
    status === PurchaseRequestStatus.APPROVED ||
    status === PurchaseRequestStatus.REJECTED ||
    status === PurchaseRequestStatus.EXPIRED ||
    status === PurchaseRequestStatus.CANCELLED
  )
}

export function canEditDraft(
  status: string,
  requestedBy: string,
  viewerUserId: string | undefined,
): boolean {
  return status === PurchaseRequestStatus.DRAFT && isSelfApproval(requestedBy, viewerUserId)
}

export function canSubmitDraft(
  status: string,
  requestedBy: string,
  viewerUserId: string | undefined,
): boolean {
  return canEditDraft(status, requestedBy, viewerUserId)
}

export function canCancelRequest(
  status: string,
  requestedBy: string,
  viewerUserId: string | undefined,
): boolean {
  return (
    (status === PurchaseRequestStatus.DRAFT || status === PurchaseRequestStatus.PENDING) &&
    isSelfApproval(requestedBy, viewerUserId)
  )
}

export function canDecideRequest(
  status: string,
  requestedBy: string,
  viewerUserId: string | undefined,
  approvals: ReadonlyArray<{ approverId: string }> = [],
): boolean {
  if (status !== PurchaseRequestStatus.PENDING) {
    return false
  }
  if (viewerUserId === undefined || viewerUserId.length < 1) {
    return false
  }
  if (isSelfApproval(requestedBy, viewerUserId)) {
    return false
  }
  return !viewerHasDecided(approvals, viewerUserId)
}

export function approvedCount(approvals: ReadonlyArray<{ decision: string }>): number {
  return approvals.filter((entry) => entry.decision === ApprovalDecision.APPROVE).length
}

export function approvalProgress(request: {
  approvals: ReadonlyArray<{ decision: string }>
  policyDecision: { requiredApprovals: number } | null
}): { approved: number; required: number } {
  return {
    approved: approvedCount(request.approvals),
    required: request.policyDecision?.requiredApprovals ?? 0,
  }
}

export function formatApprovalProgress(progress: { approved: number; required: number }): string {
  return `${progress.approved} of ${progress.required} approved.`
}

export function rejectionReason(
  approvals: ReadonlyArray<{ decision: string; reason: string | null }>,
): string | null {
  for (let i = approvals.length - 1; i >= 0; i -= 1) {
    const entry = approvals[i]
    if (
      entry &&
      entry.decision === ApprovalDecision.REJECT &&
      entry.reason !== null &&
      entry.reason.length >= 1
    ) {
      return entry.reason
    }
  }
  return null
}

export function recentApprovedSpend(
  items: ReadonlyArray<{
    id: string
    requestedBy: string
    status: string
    vendor: string
    amount: number
    currency: string
  }>,
  requestedBy: string,
  excludeId: string,
): { vendor: string; amount: number; currency: string }[] {
  const matched: { vendor: string; amount: number; currency: string }[] = []
  for (const item of items) {
    if (matched.length >= 3) {
      break
    }
    if (item.requestedBy !== requestedBy) {
      continue
    }
    if (item.status !== PurchaseRequestStatus.APPROVED) {
      continue
    }
    if (item.id === excludeId) {
      continue
    }
    matched.push({ vendor: item.vendor, amount: item.amount, currency: item.currency })
  }
  return matched
}

export function remainingShortfall(remaining: number, amount: number): boolean {
  return amount > remaining
}

export function unlockedCardIds(
  beforeIds: ReadonlyArray<string>,
  afterIds: ReadonlyArray<string>,
): string[] {
  const before = new Set(beforeIds)
  return afterIds.filter((id) => !before.has(id))
}

export function toApprovalRuleBody(rule: {
  threshold: number
  approverSelection: unknown
  requiredCount: number
  escalationAfterMins: number
  escalateTo: unknown
  id?: unknown
  orgId?: unknown
  projectId?: unknown
  createdAt?: unknown
  updatedAt?: unknown
}): ApprovalRuleBody {
  return {
    threshold: rule.threshold,
    approverSelection: rule.approverSelection as ApproverSelector,
    requiredCount: rule.requiredCount,
    escalationAfterMins: rule.escalationAfterMins,
    escalateTo: rule.escalateTo as ApproverSelector,
  }
}

export function emptyApprovalRuleBody(): ApprovalRuleBody {
  return {
    threshold: 0,
    approverSelection: { type: ApproverSelection.PROJECT_OWNER },
    requiredCount: 1,
    escalationAfterMins: 60,
    escalateTo: { type: ApproverSelection.PROJECT_OWNER },
  }
}

export function formatApproverSelector(
  sel: { type: string; roleKey?: string; userIds?: readonly string[] },
  nameOf?: (id: string) => string,
): string {
  if (sel.type === ApproverSelection.ROLE) {
    return `Role ${sel.roleKey ?? ''}`
  }
  if (sel.type === ApproverSelection.NAMED_USERS) {
    const ids = sel.userIds ?? []
    if (ids.length < 1) {
      return `${ids.length} named users`
    }
    return ids.map((id) => nameOf?.(id) ?? id).join(', ')
  }
  if (sel.type === ApproverSelection.PROJECT_OWNER) {
    return 'Project owner'
  }
  return sel.type
}

export function policyPreviewHeading(outcome: string): string {
  if (outcome === PolicyOutcome.NO_APPROVAL_REQUIRED) {
    return NO_APPROVAL_NEEDED
  }
  if (outcome === PolicyOutcome.NOT_PERMITTED) {
    return NOT_PERMITTED_HEADING
  }
  return ''
}

export function formatApprovalRequired(requiredApprovals: number): string {
  return `Approval needed from ${requiredApprovals} approver(s).`
}

export function formatEscalatedAt(iso: string, formatDate: (iso: string) => string): string {
  return `Escalated ${formatDate(iso)}.`
}

export function createRequestDenialMessage(): string {
  return CREATE_DENIED
}

export function listRequestsDenialMessage(): string {
  return LIST_DENIED
}

export function decideRequestDenialMessage(): string {
  return DECIDE_DENIED
}

export function selfApprovalMessage(): string {
  return SELF_APPROVAL
}

export function alreadyDecidedMessage(): string {
  return ALREADY_DECIDED
}

export function requestNotFoundMessage(): string {
  return REQUEST_NOT_FOUND
}

export function expiredRequestMessage(): string {
  return EXPIRED_REQUEST
}

export function rejectedFallbackMessage(): string {
  return REJECTED_FALLBACK
}

export function budgetShortfallMessage(): string {
  return BUDGET_SHORTFALL
}

export function unlockedCardMessage(): string {
  return UNLOCKED_CARD
}

export function unlockedHeading(): string {
  return UNLOCKED_HEADING
}

export function unlockedNoneLinkedMessage(): string {
  return UNLOCKED_NONE
}

export function noProjectRulesMessage(): string {
  return NO_PROJECT_RULES
}

export function wizardApprovalRulesLinkMessage(): string {
  return WIZARD_APPROVAL_RULES_LINK
}

export function checkingPolicyMessage(): string {
  return CHECKING_POLICY
}

export function policyPreviewFailedMessage(): string {
  return POLICY_PREVIEW_FAILED
}

export function selectProjectEmpty(): EmptyCopy {
  return {
    title: 'Select a project',
    description: 'Purchase requests are listed per project.',
  }
}

export function noRequestsEmpty(): EmptyCopy {
  return {
    title: 'No requests yet',
    description: 'Ask to spend — policy runs before you submit.',
  }
}

export function noApprovalsEmpty(): EmptyCopy {
  return {
    title: 'No pending approvals',
    description: 'When a request needs you, it appears here.',
  }
}
