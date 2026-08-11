/**
 * Purchase requests are tenant-owned. Every method takes `OrgContext` first
 * except the greppable cross-tenant escalation sweep helper.
 */
import { isValidObjectId } from 'mongoose'
import { PurchaseRequestModel } from '@/server/models/PurchaseRequest'
import { toDomain } from '@/server/models/base'
import type { OrgContext } from '@/server/http/types'
import type { ApprovalDecision } from '@/shared/enums/approvalDecision'
import { PurchaseRequestStatus } from '@/shared/enums/purchaseRequestStatus'
import type {
  ApprovalEntry,
  PolicyDecision,
  PurchaseRequest,
  PurchaseRequestList,
} from '@/shared/types/purchaseRequest'

export type CreatePurchaseRequestFields = {
  projectId: string
  requestedBy: string
  amount: number
  currency: string
  vendor: string
  description: string
  justification: string
  categoryId?: string | null
}

export type UpdateDraftPurchaseRequestFields = {
  amount?: number
  currency?: string
  vendor?: string
  description?: string
  justification?: string
  categoryId?: string | null
}

export type ListPurchaseRequestsFilter = {
  page?: number
  pageSize?: number
  requestedBy?: string
}

export type ListPendingForApproverFilter = {
  page?: number
  pageSize?: number
  /** Exclude requests created by this user (self-approval guard at the queue). */
  excludeRequesterId?: string
  /** When set, only PENDING in these projects (MEMBER approver scope). */
  projectIds?: string[]
}

export type SubmitPurchaseRequestFields = {
  policyDecision: PolicyDecision
  status: typeof PurchaseRequestStatus.PENDING | typeof PurchaseRequestStatus.APPROVED
}

export type AppendApprovalEntry = {
  approverId: string
  decision: ApprovalDecision
  reason: string | null
  at: Date
}

export type SetPurchaseRequestStatusExtra = {
  cardId?: string | null
  /** When set, only transition if current status is one of these. */
  fromStatuses?: PurchaseRequestStatus[]
}

/** Default source statuses for REJECTED / APPROVED / EXPIRED transitions. */
const FROM_PENDING: PurchaseRequestStatus[] = [PurchaseRequestStatus.PENDING]

function nullableIso(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null
  }
  return String(value)
}

function toApprovalEntry(raw: Record<string, unknown>): ApprovalEntry {
  return {
    approverId: String(raw.approverId),
    decision: raw.decision as ApprovalDecision,
    reason: raw.reason == null ? null : String(raw.reason),
    at: String(raw.at),
  }
}

function toPolicyDecision(raw: Record<string, unknown> | null | undefined): PolicyDecision | null {
  if (raw == null) {
    return null
  }
  return {
    outcome: raw.outcome as PolicyDecision['outcome'],
    reasons: Array.isArray(raw.reasons) ? raw.reasons.map(String) : [],
    requiredApprovals: Number(raw.requiredApprovals),
  }
}

function toPurchaseRequest(doc: Parameters<typeof toDomain>[0]): PurchaseRequest {
  const raw = toDomain<Record<string, unknown>>(doc)
  const approvals = Array.isArray(raw.approvals)
    ? raw.approvals.map((entry) => toApprovalEntry(entry as Record<string, unknown>))
    : []
  return {
    id: String(raw.id),
    orgId: String(raw.orgId),
    projectId: String(raw.projectId),
    requestedBy: String(raw.requestedBy),
    amount: Number(raw.amount),
    currency: String(raw.currency),
    categoryId: raw.categoryId == null ? null : String(raw.categoryId),
    vendor: String(raw.vendor),
    description: String(raw.description),
    justification: String(raw.justification),
    policyDecision: toPolicyDecision(raw.policyDecision as Record<string, unknown> | null),
    status: raw.status as PurchaseRequestStatus,
    cardId: raw.cardId == null ? null : String(raw.cardId),
    approvals,
    escalatedAt: nullableIso(raw.escalatedAt),
    createdAt: String(raw.createdAt),
    updatedAt: String(raw.updatedAt),
  }
}

/** Create always yields DRAFT with null policyDecision and empty approvals (B7.0). */
export async function createPurchaseRequest(
  ctx: OrgContext,
  input: CreatePurchaseRequestFields,
): Promise<PurchaseRequest> {
  const doc = await PurchaseRequestModel.create({
    orgId: ctx.orgId,
    projectId: input.projectId,
    requestedBy: input.requestedBy,
    amount: input.amount,
    currency: input.currency,
    categoryId: input.categoryId === undefined ? null : input.categoryId,
    vendor: input.vendor,
    description: input.description,
    justification: input.justification,
    policyDecision: null,
    status: PurchaseRequestStatus.DRAFT,
    cardId: null,
    approvals: [],
    escalatedAt: null,
  })
  return toPurchaseRequest(doc)
}

export async function findPurchaseRequestById(
  ctx: OrgContext,
  id: string,
): Promise<PurchaseRequest | null> {
  if (!isValidObjectId(id)) {
    return null
  }
  const doc = await PurchaseRequestModel.findOne({ _id: id, orgId: ctx.orgId }).lean().exec()
  return doc ? toPurchaseRequest(doc) : null
}

/** Patch only while DRAFT. Returns null if missing, cross-org, or not DRAFT. */
export async function updateDraftPurchaseRequest(
  ctx: OrgContext,
  id: string,
  patch: UpdateDraftPurchaseRequestFields,
): Promise<PurchaseRequest | null> {
  if (!isValidObjectId(id)) {
    return null
  }

  const $set: Record<string, unknown> = {}
  if (patch.amount !== undefined) $set.amount = patch.amount
  if (patch.currency !== undefined) $set.currency = patch.currency
  if (patch.vendor !== undefined) $set.vendor = patch.vendor
  if (patch.description !== undefined) $set.description = patch.description
  if (patch.justification !== undefined) $set.justification = patch.justification
  if (patch.categoryId !== undefined) $set.categoryId = patch.categoryId

  if (Object.keys($set).length === 0) {
    return findPurchaseRequestById(ctx, id)
  }

  const doc = await PurchaseRequestModel.findOneAndUpdate(
    {
      _id: id,
      orgId: ctx.orgId,
      status: PurchaseRequestStatus.DRAFT,
    },
    { $set },
    { returnDocument: 'after' },
  )
    .lean()
    .exec()
  return doc ? toPurchaseRequest(doc) : null
}

export async function listPurchaseRequests(
  ctx: OrgContext,
  projectId: string,
  filter: ListPurchaseRequestsFilter = {},
): Promise<PurchaseRequestList> {
  const page = filter.page ?? 1
  const pageSize = filter.pageSize ?? 20

  const query: Record<string, unknown> = { orgId: ctx.orgId, projectId }
  if (filter.requestedBy !== undefined) {
    query.requestedBy = filter.requestedBy
  }

  const [total, docs] = await Promise.all([
    PurchaseRequestModel.countDocuments(query).exec(),
    PurchaseRequestModel.find(query)
      .sort({ createdAt: -1, _id: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean()
      .exec(),
  ])

  return {
    items: docs.map((doc) => toPurchaseRequest(doc)),
    page,
    pageSize,
    total,
  }
}

/**
 * Approver queue: PENDING across the org, oldest first.
 * Optional excludeRequesterId drops the caller's own requests.
 */
export async function listPendingForApprover(
  ctx: OrgContext,
  filter: ListPendingForApproverFilter = {},
): Promise<PurchaseRequestList> {
  const page = filter.page ?? 1
  const pageSize = filter.pageSize ?? 20

  const query: Record<string, unknown> = {
    orgId: ctx.orgId,
    status: PurchaseRequestStatus.PENDING,
  }
  if (filter.excludeRequesterId !== undefined) {
    query.requestedBy = { $ne: filter.excludeRequesterId }
  }
  if (filter.projectIds !== undefined) {
    query.projectId = { $in: filter.projectIds }
  }

  const [total, docs] = await Promise.all([
    PurchaseRequestModel.countDocuments(query).exec(),
    PurchaseRequestModel.find(query)
      .sort({ createdAt: 1, _id: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean()
      .exec(),
  ])

  return {
    items: docs.map((doc) => toPurchaseRequest(doc)),
    page,
    pageSize,
    total,
  }
}

/**
 * Cross-tenant escalation sweep: PENDING requests that have not yet been escalated.
 * allowCrossTenant — worker job only; keep greppable.
 */
export async function listOverdueForEscalation(): Promise<PurchaseRequest[]> {
  const docs = await PurchaseRequestModel.find({
    status: PurchaseRequestStatus.PENDING,
    escalatedAt: null,
  })
    .setOptions({ allowCrossTenant: true })
    .sort({ updatedAt: 1, _id: 1 })
    .lean()
    .exec()
  return docs.map((doc) => toPurchaseRequest(doc))
}

/** DRAFT → PENDING or DRAFT → APPROVED when attaching the submit-time policyDecision. */
export async function submitPurchaseRequest(
  ctx: OrgContext,
  id: string,
  fields: SubmitPurchaseRequestFields,
): Promise<PurchaseRequest | null> {
  if (!isValidObjectId(id)) {
    return null
  }
  const doc = await PurchaseRequestModel.findOneAndUpdate(
    {
      _id: id,
      orgId: ctx.orgId,
      status: PurchaseRequestStatus.DRAFT,
    },
    {
      $set: {
        policyDecision: fields.policyDecision,
        status: fields.status,
      },
    },
    { returnDocument: 'after' },
  )
    .lean()
    .exec()
  return doc ? toPurchaseRequest(doc) : null
}

/** Push an approval entry only while PENDING. */
export async function appendApproval(
  ctx: OrgContext,
  id: string,
  entry: AppendApprovalEntry,
): Promise<PurchaseRequest | null> {
  if (!isValidObjectId(id)) {
    return null
  }
  const doc = await PurchaseRequestModel.findOneAndUpdate(
    {
      _id: id,
      orgId: ctx.orgId,
      status: PurchaseRequestStatus.PENDING,
    },
    {
      $push: {
        approvals: {
          approverId: entry.approverId,
          decision: entry.decision,
          reason: entry.reason,
          at: entry.at,
        },
      },
    },
    { returnDocument: 'after' },
  )
    .lean()
    .exec()
  return doc ? toPurchaseRequest(doc) : null
}

/**
 * Transition to CANCELLED / REJECTED / APPROVED / EXPIRED.
 * Defaults: CANCELLED from DRAFT|PENDING; others from PENDING only.
 */
export async function setPurchaseRequestStatus(
  ctx: OrgContext,
  id: string,
  status:
    | typeof PurchaseRequestStatus.CANCELLED
    | typeof PurchaseRequestStatus.REJECTED
    | typeof PurchaseRequestStatus.APPROVED
    | typeof PurchaseRequestStatus.EXPIRED,
  extra: SetPurchaseRequestStatusExtra = {},
): Promise<PurchaseRequest | null> {
  if (!isValidObjectId(id)) {
    return null
  }

  const fromStatuses =
    extra.fromStatuses ??
    (status === PurchaseRequestStatus.CANCELLED
      ? [PurchaseRequestStatus.DRAFT, PurchaseRequestStatus.PENDING]
      : FROM_PENDING)

  const $set: Record<string, unknown> = { status }
  if (extra.cardId !== undefined) {
    $set.cardId = extra.cardId
  }

  const doc = await PurchaseRequestModel.findOneAndUpdate(
    {
      _id: id,
      orgId: ctx.orgId,
      status: { $in: fromStatuses },
    },
    { $set },
    { returnDocument: 'after' },
  )
    .lean()
    .exec()
  return doc ? toPurchaseRequest(doc) : null
}

/**
 * Set escalatedAt only if currently null — concurrent sweeps are idempotent.
 */
export async function markEscalated(
  ctx: OrgContext,
  id: string,
  escalatedAt: Date,
): Promise<PurchaseRequest | null> {
  if (!isValidObjectId(id)) {
    return null
  }
  const doc = await PurchaseRequestModel.findOneAndUpdate(
    {
      _id: id,
      orgId: ctx.orgId,
      escalatedAt: null,
    },
    { $set: { escalatedAt } },
    { returnDocument: 'after' },
  )
    .lean()
    .exec()
  return doc ? toPurchaseRequest(doc) : null
}
