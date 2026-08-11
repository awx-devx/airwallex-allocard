/**
 * Access reviews are tenant-owned. Every method takes `OrgContext` first.
 */
import { isValidObjectId } from 'mongoose'
import { AccessReviewModel } from '@/server/models/AccessReview'
import { toDomain } from '@/server/models/base'
import type { OrgContext } from '@/server/http/types'
import { AccessReviewResolution, AccessReviewStatus } from '@/shared/enums/accessReviewStatus'
import type { AccessReview } from '@/shared/types/accessReview'

export type CreateAccessReviewInput = {
  projectId: string
  reason: string
  subjectId: string
  userId: string
  flaggedBy?: string | null
  flaggedAt?: Date
}

export type ListAccessReviewsFilter = {
  status?: AccessReviewStatus
  projectId?: string
}

function toAccessReview(doc: Parameters<typeof toDomain>[0]): AccessReview {
  const raw = toDomain<Record<string, unknown>>(doc)
  return {
    id: String(raw.id),
    orgId: String(raw.orgId),
    projectId: String(raw.projectId),
    status: raw.status as AccessReviewStatus,
    reason: String(raw.reason),
    subjectType: 'projectMember',
    subjectId: String(raw.subjectId),
    userId: String(raw.userId),
    flaggedAt: String(raw.flaggedAt),
    flaggedBy: raw.flaggedBy == null ? null : String(raw.flaggedBy),
    resolvedAt: raw.resolvedAt == null ? null : String(raw.resolvedAt),
    resolvedBy: raw.resolvedBy == null ? null : String(raw.resolvedBy),
    resolution: (raw.resolution as AccessReviewResolution | null) ?? null,
  }
}

export async function createAccessReview(
  ctx: OrgContext,
  input: CreateAccessReviewInput,
): Promise<AccessReview> {
  const doc = await AccessReviewModel.create({
    orgId: ctx.orgId,
    projectId: input.projectId,
    status: AccessReviewStatus.OPEN,
    reason: input.reason,
    subjectType: 'projectMember',
    subjectId: input.subjectId,
    userId: input.userId,
    flaggedAt: input.flaggedAt ?? new Date(),
    flaggedBy: input.flaggedBy === undefined ? null : input.flaggedBy,
    resolvedAt: null,
    resolvedBy: null,
    resolution: null,
  })
  return toAccessReview(doc)
}

/**
 * Idempotent create: skip when an OPEN review already exists for
 * `(orgId, subjectId, reason)`.
 */
export async function createAccessReviewIfAbsent(
  ctx: OrgContext,
  input: CreateAccessReviewInput,
): Promise<AccessReview | null> {
  const existing = await AccessReviewModel.findOne({
    orgId: ctx.orgId,
    subjectId: input.subjectId,
    reason: input.reason,
    status: AccessReviewStatus.OPEN,
  })
    .lean()
    .exec()
  if (existing) {
    return null
  }
  return createAccessReview(ctx, input)
}

export async function findAccessReviewById(
  ctx: OrgContext,
  reviewId: string,
): Promise<AccessReview | null> {
  if (!isValidObjectId(reviewId)) {
    return null
  }
  const doc = await AccessReviewModel.findOne({ _id: reviewId, orgId: ctx.orgId }).lean().exec()
  return doc ? toAccessReview(doc) : null
}

export async function listAccessReviews(
  ctx: OrgContext,
  filter: ListAccessReviewsFilter = {},
): Promise<AccessReview[]> {
  const query: Record<string, unknown> = { orgId: ctx.orgId }
  if (filter.status !== undefined) query.status = filter.status
  if (filter.projectId !== undefined) query.projectId = filter.projectId

  const docs = await AccessReviewModel.find(query).sort({ flaggedAt: -1, _id: 1 }).lean().exec()
  return docs.map((doc) => toAccessReview(doc))
}

export async function resolveAccessReview(
  ctx: OrgContext,
  reviewId: string,
  resolution: AccessReviewResolution,
  resolvedAt: Date = new Date(),
): Promise<AccessReview | null> {
  if (!isValidObjectId(reviewId)) {
    return null
  }
  const doc = await AccessReviewModel.findOneAndUpdate(
    { _id: reviewId, orgId: ctx.orgId, status: AccessReviewStatus.OPEN },
    {
      $set: {
        status: AccessReviewStatus.RESOLVED,
        resolution,
        resolvedAt,
        resolvedBy: ctx.userId,
      },
    },
    { returnDocument: 'after' },
  )
    .lean()
    .exec()
  return doc ? toAccessReview(doc) : null
}
