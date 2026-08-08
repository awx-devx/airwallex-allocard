/**
 * Budget change requests are tenant-owned. Every method takes `OrgContext` first.
 * Decisions are conditional on PENDING so concurrent double-decide is safe.
 */
import { isValidObjectId } from 'mongoose'
import { BudgetChangeRequestModel } from '@/server/models/BudgetChangeRequest'
import { toDomain } from '@/server/models/base'
import type { OrgContext } from '@/server/http/types'
import { BudgetChangeRequestStatus } from '@/shared/enums/budgetChangeRequestStatus'
import type { BudgetChangeRequest } from '@/shared/types/budget'

export type CreateChangeRequestInput = {
  projectId: string
  requestedBy: string
  deltaAmount: number
  reason: string
}

function nullableIso(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null
  }
  return String(value)
}

function toChangeRequest(doc: Parameters<typeof toDomain>[0]): BudgetChangeRequest {
  const raw = toDomain<Record<string, unknown>>(doc)
  return {
    id: String(raw.id),
    orgId: String(raw.orgId),
    projectId: String(raw.projectId),
    requestedBy: String(raw.requestedBy),
    deltaAmount: Number(raw.deltaAmount),
    reason: String(raw.reason),
    status: raw.status as BudgetChangeRequestStatus,
    decidedBy: raw.decidedBy == null ? null : String(raw.decidedBy),
    decidedAt: nullableIso(raw.decidedAt),
    createdAt: String(raw.createdAt),
    updatedAt: String(raw.updatedAt),
  }
}

export async function createChangeRequest(
  ctx: OrgContext,
  input: CreateChangeRequestInput,
): Promise<BudgetChangeRequest> {
  const doc = await BudgetChangeRequestModel.create({
    orgId: ctx.orgId,
    projectId: input.projectId,
    requestedBy: input.requestedBy,
    deltaAmount: input.deltaAmount,
    reason: input.reason,
    status: BudgetChangeRequestStatus.PENDING,
    decidedBy: null,
    decidedAt: null,
  })
  return toChangeRequest(doc)
}

export async function findChangeRequestById(
  ctx: OrgContext,
  requestId: string,
): Promise<BudgetChangeRequest | null> {
  if (!isValidObjectId(requestId)) {
    return null
  }
  const doc = await BudgetChangeRequestModel.findOne({
    _id: requestId,
    orgId: ctx.orgId,
  })
    .lean()
    .exec()
  return doc ? toChangeRequest(doc) : null
}

export async function listChangeRequests(
  ctx: OrgContext,
  projectId: string,
): Promise<BudgetChangeRequest[]> {
  const docs = await BudgetChangeRequestModel.find({ orgId: ctx.orgId, projectId })
    .sort({ createdAt: -1, _id: 1 })
    .lean()
    .exec()
  return docs.map((doc) => toChangeRequest(doc))
}

/**
 * Approve or reject only when still PENDING. Returns null if missing, wrong org,
 * or already decided (concurrent double-decide → one winner).
 */
export async function decideChangeRequest(
  ctx: OrgContext,
  requestId: string,
  status: typeof BudgetChangeRequestStatus.APPROVED | typeof BudgetChangeRequestStatus.REJECTED,
  decidedAt: Date = new Date(),
): Promise<BudgetChangeRequest | null> {
  if (!isValidObjectId(requestId)) {
    return null
  }
  const doc = await BudgetChangeRequestModel.findOneAndUpdate(
    {
      _id: requestId,
      orgId: ctx.orgId,
      status: BudgetChangeRequestStatus.PENDING,
    },
    {
      $set: {
        status,
        decidedBy: ctx.userId,
        decidedAt,
      },
    },
    { returnDocument: 'after' },
  )
    .lean()
    .exec()
  return doc ? toChangeRequest(doc) : null
}
