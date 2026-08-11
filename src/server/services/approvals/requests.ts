/**
 * Purchase-request lifecycle: create → update → submit → cancel / decide.
 * Never calls Airwallex — emits domain events; B6 reacts.
 */
import { connectDb } from '@/server/db/connect'
import { publishEvent } from '@/server/events/bus'
import { DomainEventType } from '@/server/events/types'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import { listApplicableApprovalRules } from '@/server/repositories/approvalRules'
import { findEntriesByProject } from '@/server/repositories/budgetEntries'
import { findProjectById } from '@/server/repositories/projects'
import {
  appendApproval,
  createPurchaseRequest as createPurchaseRequestRecord,
  findPurchaseRequestById,
  setPurchaseRequestStatus,
  submitPurchaseRequest as submitPurchaseRequestRecord,
  updateDraftPurchaseRequest,
} from '@/server/repositories/purchaseRequests'
import { audit } from '@/server/services/audit/log'
import { evaluatePolicy } from '@/server/services/approvals/policy'
import { hasMetRequiredApprovals } from '@/server/services/approvals/routing'
import { getProjectBudget } from '@/server/services/budget/get'
import { appendBudgetEntry } from '@/server/services/budget/ledger'
import { ActorType } from '@/shared/enums/audit'
import { ApprovalDecision } from '@/shared/enums/approvalDecision'
import { BudgetEntrySourceType } from '@/shared/enums/budgetEntrySourceType'
import { BudgetEntryType } from '@/shared/enums/budgetEntryType'
import { ErrorCode } from '@/shared/enums/errors'
import { PolicyOutcome } from '@/shared/enums/policyOutcome'
import { PurchaseRequestStatus } from '@/shared/enums/purchaseRequestStatus'
import type {
  CreatePurchaseRequestInput,
  DecidePurchaseRequestInput,
  PolicyDecision,
  PolicyPreviewInput,
  PurchaseRequest,
  UpdatePurchaseRequestInput,
} from '@/shared/types/purchaseRequest'

export type RunPolicyCheckOverrides = {
  rolePermitted?: boolean
  roleDenialReason?: string
  accessScopePermitted?: boolean
  accessScopeDenialReason?: string
  /** When set, replaces the computed remaining-budget denial list. */
  spendingRuleDenials?: string[]
}

async function requireProject(ctx: OrgContext, projectId: string) {
  const project = await findProjectById(ctx, projectId)
  if (!project) {
    throw AppError.notFound()
  }
  return project
}

async function requireRequest(ctx: OrgContext, id: string): Promise<PurchaseRequest> {
  const request = await findPurchaseRequestById(ctx, id)
  if (!request) {
    throw AppError.notFound()
  }
  return request
}

function assertRequester(ctx: OrgContext, request: PurchaseRequest, message: string): void {
  if (request.requestedBy !== ctx.userId) {
    throw new AppError(ErrorCode.PERMISSION_DENIED, message)
  }
}

/**
 * Shared policy check for preview and submit.
 * Defaults: role/scope permitted (HTTP enforces); spending denial from remaining budget
 * when a budget row exists; approval rules from listApplicableApprovalRules.
 */
export async function runPolicyCheck(
  ctx: OrgContext,
  projectId: string,
  amount: number,
  _categoryId?: string | null,
  overrides: RunPolicyCheckOverrides = {},
): Promise<PolicyDecision> {
  await requireProject(ctx, projectId)

  let spendingRuleDenials = overrides.spendingRuleDenials
  if (spendingRuleDenials === undefined) {
    const detail = await getProjectBudget(ctx, projectId)
    spendingRuleDenials = []
    if (detail.budget && amount > detail.projection.remaining) {
      spendingRuleDenials = [`Insufficient remaining budget (${detail.projection.remaining})`]
    }
  }

  const rules = await listApplicableApprovalRules(ctx, projectId)

  return evaluatePolicy({
    amount,
    rolePermitted: overrides.rolePermitted ?? true,
    roleDenialReason: overrides.roleDenialReason,
    accessScopePermitted: overrides.accessScopePermitted ?? true,
    accessScopeDenialReason: overrides.accessScopeDenialReason,
    spendingRuleDenials,
    approvalRules: rules.map((rule) => ({
      threshold: rule.threshold,
      requiredCount: rule.requiredCount,
    })),
  })
}

/** Alias used by preview / future B7.7. */
export async function buildPolicyDecision(
  ctx: OrgContext,
  projectId: string,
  input: { amount: number; categoryId?: string | null },
  overrides?: RunPolicyCheckOverrides,
): Promise<PolicyDecision> {
  return runPolicyCheck(ctx, projectId, input.amount, input.categoryId, overrides)
}

async function writeCommitment(ctx: OrgContext, request: PurchaseRequest): Promise<void> {
  await appendBudgetEntry(ctx, request.projectId, {
    type: BudgetEntryType.COMMITMENT,
    amount: request.amount,
    currency: request.currency,
    categoryId: request.categoryId,
    sourceType: BudgetEntrySourceType.PURCHASE_REQUEST,
    sourceId: request.id,
    createdBy: ctx.userId,
  })
}

/** RELEASE when a COMMITMENT for this request exists and no RELEASE yet. */
export async function releaseIfCommitted(
  ctx: OrgContext,
  request: PurchaseRequest,
): Promise<boolean> {
  const entries = await findEntriesByProject(ctx, request.projectId)
  const related = entries.filter(
    (entry) =>
      entry.sourceType === BudgetEntrySourceType.PURCHASE_REQUEST && entry.sourceId === request.id,
  )
  const hasCommitment = related.some((entry) => entry.type === BudgetEntryType.COMMITMENT)
  const hasRelease = related.some((entry) => entry.type === BudgetEntryType.RELEASE)
  if (!hasCommitment || hasRelease) {
    return false
  }

  await appendBudgetEntry(ctx, request.projectId, {
    type: BudgetEntryType.RELEASE,
    amount: request.amount,
    currency: request.currency,
    categoryId: request.categoryId,
    sourceType: BudgetEntrySourceType.PURCHASE_REQUEST,
    sourceId: request.id,
    createdBy: ctx.userId,
  })
  return true
}

function requestPayload(request: PurchaseRequest) {
  return {
    requestId: request.id,
    projectId: request.projectId,
    amount: request.amount,
    currency: request.currency,
    status: request.status,
    requestedBy: request.requestedBy,
  }
}

/** Create always → DRAFT. */
export async function createPurchaseRequest(
  ctx: OrgContext,
  projectId: string,
  input: CreatePurchaseRequestInput,
): Promise<PurchaseRequest> {
  await connectDb()
  await requireProject(ctx, projectId)

  const created = await createPurchaseRequestRecord(ctx, {
    projectId,
    requestedBy: ctx.userId,
    amount: input.amount,
    currency: input.currency,
    vendor: input.vendor,
    description: input.description,
    justification: input.justification,
    categoryId: input.categoryId,
  })

  await audit(ctx, {
    action: 'request.created',
    subjectType: 'purchaseRequest',
    subjectId: created.id,
    projectId,
    actorType: ActorType.USER,
    actorId: ctx.userId,
    after: created,
  })

  await publishEvent({
    type: DomainEventType.REQUEST_CREATED,
    orgId: ctx.orgId,
    projectId,
    subjectType: 'purchaseRequest',
    subjectId: created.id,
    payload: requestPayload(created),
  })

  return created
}

/** Patch only while DRAFT, and only by the requester. */
export async function updatePurchaseRequest(
  ctx: OrgContext,
  id: string,
  input: UpdatePurchaseRequestInput,
): Promise<PurchaseRequest> {
  await connectDb()

  const before = await requireRequest(ctx, id)
  assertRequester(ctx, before, 'Only the requester can update this request')
  if (before.status !== PurchaseRequestStatus.DRAFT) {
    throw AppError.conflict('Only DRAFT requests can be updated')
  }

  const after = await updateDraftPurchaseRequest(ctx, id, input)
  if (!after) {
    throw AppError.conflict('Only DRAFT requests can be updated')
  }

  await audit(ctx, {
    action: 'request.updated',
    subjectType: 'purchaseRequest',
    subjectId: after.id,
    projectId: after.projectId,
    actorType: ActorType.USER,
    actorId: ctx.userId,
    before,
    after,
  })

  return after
}

/** Policy preview — same evaluation path as submit. */
export async function previewPolicy(
  ctx: OrgContext,
  input: PolicyPreviewInput,
  overrides?: RunPolicyCheckOverrides,
): Promise<PolicyDecision> {
  await connectDb()
  return runPolicyCheck(ctx, input.projectId, input.amount, input.categoryId, overrides)
}

/**
 * Submit DRAFT: run policy → PENDING | APPROVED, or reject with reasons.
 * NOT_PERMITTED → 422 VALIDATION_FAILED with `policy` field errors.
 */
export async function submitPurchaseRequest(
  ctx: OrgContext,
  id: string,
  overrides?: RunPolicyCheckOverrides,
): Promise<PurchaseRequest> {
  await connectDb()

  const before = await requireRequest(ctx, id)
  assertRequester(ctx, before, 'Only the requester can submit this request')
  if (before.status !== PurchaseRequestStatus.DRAFT) {
    throw AppError.conflict('Only DRAFT requests can be submitted')
  }

  const decision = await runPolicyCheck(
    ctx,
    before.projectId,
    before.amount,
    before.categoryId,
    overrides,
  )

  if (decision.outcome === PolicyOutcome.NOT_PERMITTED) {
    throw AppError.validationFailed({ policy: decision.reasons })
  }

  const nextStatus =
    decision.outcome === PolicyOutcome.NO_APPROVAL_REQUIRED
      ? PurchaseRequestStatus.APPROVED
      : PurchaseRequestStatus.PENDING

  const after = await submitPurchaseRequestRecord(ctx, id, {
    policyDecision: decision,
    status: nextStatus,
  })
  if (!after) {
    throw AppError.conflict('Only DRAFT requests can be submitted')
  }

  if (after.status === PurchaseRequestStatus.APPROVED) {
    await writeCommitment(ctx, after)
  }

  await audit(ctx, {
    action: 'request.submitted',
    subjectType: 'purchaseRequest',
    subjectId: after.id,
    projectId: after.projectId,
    actorType: ActorType.USER,
    actorId: ctx.userId,
    before,
    after,
    metadata: { outcome: decision.outcome },
  })

  await publishEvent({
    type: DomainEventType.REQUEST_SUBMITTED,
    orgId: ctx.orgId,
    projectId: after.projectId,
    subjectType: 'purchaseRequest',
    subjectId: after.id,
    payload: requestPayload(after),
  })

  if (after.status === PurchaseRequestStatus.APPROVED) {
    await publishEvent({
      type: DomainEventType.REQUEST_APPROVED,
      orgId: ctx.orgId,
      projectId: after.projectId,
      subjectType: 'purchaseRequest',
      subjectId: after.id,
      payload: requestPayload(after),
    })
  }

  return after
}

/** Cancel DRAFT or PENDING; RELEASE if a commitment was written. */
export async function cancelPurchaseRequest(ctx: OrgContext, id: string): Promise<PurchaseRequest> {
  await connectDb()

  const before = await requireRequest(ctx, id)
  assertRequester(ctx, before, 'Only the requester can cancel this request')
  if (
    before.status !== PurchaseRequestStatus.DRAFT &&
    before.status !== PurchaseRequestStatus.PENDING
  ) {
    throw AppError.conflict('Only DRAFT or PENDING requests can be cancelled')
  }

  const after = await setPurchaseRequestStatus(ctx, id, PurchaseRequestStatus.CANCELLED)
  if (!after) {
    throw AppError.conflict('Only DRAFT or PENDING requests can be cancelled')
  }

  await releaseIfCommitted(ctx, after)

  await audit(ctx, {
    action: 'request.cancelled',
    subjectType: 'purchaseRequest',
    subjectId: after.id,
    projectId: after.projectId,
    actorType: ActorType.USER,
    actorId: ctx.userId,
    before,
    after,
  })

  await publishEvent({
    type: DomainEventType.REQUEST_CANCELLED,
    orgId: ctx.orgId,
    projectId: after.projectId,
    subjectType: 'purchaseRequest',
    subjectId: after.id,
    payload: requestPayload(after),
  })

  return after
}

/**
 * Approver decide. Requester cannot decide own request.
 * APPROVE may leave PENDING until requiredCount distinct approvers; then COMMITMENT.
 * REJECT requires reason; RELEASE if committed.
 */
export async function decidePurchaseRequest(
  ctx: OrgContext,
  id: string,
  input: DecidePurchaseRequestInput,
): Promise<PurchaseRequest> {
  await connectDb()

  const before = await requireRequest(ctx, id)
  if (before.status !== PurchaseRequestStatus.PENDING) {
    throw AppError.conflict('Request is already decided')
  }
  if (before.requestedBy === ctx.userId) {
    throw new AppError(ErrorCode.PERMISSION_DENIED, 'Requester cannot decide their own request')
  }
  if (
    input.decision === ApprovalDecision.REJECT &&
    (input.reason === undefined || input.reason === '')
  ) {
    throw AppError.validationFailed({ reason: ['reason is required when decision is REJECT'] })
  }

  const withApproval = await appendApproval(ctx, id, {
    approverId: ctx.userId,
    decision: input.decision,
    reason: input.reason ?? null,
    at: new Date(),
  })
  if (!withApproval) {
    throw AppError.conflict('Request is already decided')
  }

  let after = withApproval

  if (input.decision === ApprovalDecision.REJECT) {
    const rejected = await setPurchaseRequestStatus(ctx, id, PurchaseRequestStatus.REJECTED)
    if (!rejected) {
      throw AppError.conflict('Request is already decided')
    }
    after = rejected
    await releaseIfCommitted(ctx, after)

    await audit(ctx, {
      action: 'request.decided',
      subjectType: 'purchaseRequest',
      subjectId: after.id,
      projectId: after.projectId,
      actorType: ActorType.USER,
      actorId: ctx.userId,
      before,
      after,
      metadata: { decision: input.decision, reason: input.reason },
    })

    await publishEvent({
      type: DomainEventType.REQUEST_REJECTED,
      orgId: ctx.orgId,
      projectId: after.projectId,
      subjectType: 'purchaseRequest',
      subjectId: after.id,
      payload: { ...requestPayload(after), reason: input.reason },
    })

    return after
  }

  const required =
    before.policyDecision?.requiredApprovals ?? after.policyDecision?.requiredApprovals ?? 1

  if (hasMetRequiredApprovals(after.approvals, required)) {
    const approved = await setPurchaseRequestStatus(ctx, id, PurchaseRequestStatus.APPROVED)
    if (!approved) {
      throw AppError.conflict('Request is already decided')
    }
    after = approved
    await writeCommitment(ctx, after)

    await audit(ctx, {
      action: 'request.decided',
      subjectType: 'purchaseRequest',
      subjectId: after.id,
      projectId: after.projectId,
      actorType: ActorType.USER,
      actorId: ctx.userId,
      before,
      after,
      metadata: { decision: input.decision },
    })

    await publishEvent({
      type: DomainEventType.REQUEST_APPROVED,
      orgId: ctx.orgId,
      projectId: after.projectId,
      subjectType: 'purchaseRequest',
      subjectId: after.id,
      payload: requestPayload(after),
    })

    return after
  }

  await audit(ctx, {
    action: 'request.decided',
    subjectType: 'purchaseRequest',
    subjectId: after.id,
    projectId: after.projectId,
    actorType: ActorType.USER,
    actorId: ctx.userId,
    before,
    after,
    metadata: { decision: input.decision },
  })

  return after
}
