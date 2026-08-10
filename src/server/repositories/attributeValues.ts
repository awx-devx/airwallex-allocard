/**
 * Attribute values are tenant-owned; one row per (orgId, key, subjectType, subjectId).
 * Writes are upserts — the current value replaces the previous one, and `observedAt`
 * always reflects when the source produced it, not when we stored it.
 */
import { AttributeValueModel } from '@/server/models/AttributeValue'
import { toDomain } from '@/server/models/base'
import type { OrgContext } from '@/server/http/types'
import type { AttributeSource } from '@/shared/enums/attributeSource'
import type { AttributeSubjectType } from '@/shared/enums/attributeSubjectType'
import type { AttributeLiteral, AttributeValue, AttributeValueList } from '@/shared/types/attribute'

export type AttributeSubjectRef = {
  subjectType: AttributeSubjectType
  subjectId: string
}

export type PutAttributeValueFields = AttributeSubjectRef & {
  key: string
  value: AttributeLiteral
  observedAt?: string | Date
  source: AttributeSource
  ttlSec?: number | null
}

export type ListAttributeValuesFilter = {
  key?: string
  keys?: string[]
  subjectType?: AttributeSubjectType
  subjectId?: string
  page?: number
  pageSize?: number
}

function toAttributeValue(doc: Parameters<typeof toDomain>[0]): AttributeValue {
  const raw = toDomain<Record<string, unknown>>(doc)
  return {
    id: String(raw.id),
    orgId: String(raw.orgId),
    key: String(raw.key),
    subjectType: raw.subjectType as AttributeValue['subjectType'],
    subjectId: String(raw.subjectId),
    value: (raw.value ?? null) as AttributeLiteral,
    observedAt: String(raw.observedAt),
    source: raw.source as AttributeValue['source'],
    ttlSec: raw.ttlSec == null ? null : Number(raw.ttlSec),
    createdAt: String(raw.createdAt),
    updatedAt: String(raw.updatedAt),
  }
}

export async function putAttributeValue(
  ctx: OrgContext,
  input: PutAttributeValueFields,
): Promise<AttributeValue> {
  const observedAt = input.observedAt ? new Date(input.observedAt) : new Date()
  const doc = await AttributeValueModel.findOneAndUpdate(
    {
      orgId: ctx.orgId,
      key: input.key,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
    },
    {
      $set: {
        value: input.value,
        observedAt,
        source: input.source,
        ttlSec: input.ttlSec ?? null,
      },
    },
    { returnDocument: 'after', upsert: true },
  )
    .lean()
    .exec()
  return toAttributeValue(doc)
}

export async function findAttributeValue(
  ctx: OrgContext,
  key: string,
  subject: AttributeSubjectRef,
): Promise<AttributeValue | null> {
  const doc = await AttributeValueModel.findOne({
    orgId: ctx.orgId,
    key,
    subjectType: subject.subjectType,
    subjectId: subject.subjectId,
  })
    .lean()
    .exec()
  return doc ? toAttributeValue(doc) : null
}

/** Batched context load for the evaluation pipeline — one query, many keys/subjects. */
export async function findAttributeValuesForSubjects(
  ctx: OrgContext,
  keys: string[],
  subjects: AttributeSubjectRef[],
): Promise<AttributeValue[]> {
  if (keys.length === 0 || subjects.length === 0) {
    return []
  }
  const docs = await AttributeValueModel.find({
    orgId: ctx.orgId,
    key: { $in: keys },
    $or: subjects.map((subject) => ({
      subjectType: subject.subjectType,
      subjectId: subject.subjectId,
    })),
  })
    .lean()
    .exec()
  return docs.map((doc) => toAttributeValue(doc))
}

export async function listAttributeValues(
  ctx: OrgContext,
  filter: ListAttributeValuesFilter = {},
): Promise<AttributeValueList> {
  const page = filter.page ?? 1
  const pageSize = filter.pageSize ?? 20

  const query: Record<string, unknown> = { orgId: ctx.orgId }
  if (filter.key !== undefined) query.key = filter.key
  if (filter.keys !== undefined) query.key = { $in: filter.keys }
  if (filter.subjectType !== undefined) query.subjectType = filter.subjectType
  if (filter.subjectId !== undefined) query.subjectId = filter.subjectId

  const [total, docs] = await Promise.all([
    AttributeValueModel.countDocuments(query).exec(),
    AttributeValueModel.find(query)
      .sort({ key: 1, _id: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean()
      .exec(),
  ])

  return {
    items: docs.map((doc) => toAttributeValue(doc)),
    page,
    pageSize,
    total,
  }
}

export async function deleteAttributeValue(
  ctx: OrgContext,
  key: string,
  subject: AttributeSubjectRef,
): Promise<boolean> {
  const result = await AttributeValueModel.deleteOne({
    orgId: ctx.orgId,
    key,
    subjectType: subject.subjectType,
    subjectId: subject.subjectId,
  }).exec()
  return result.deletedCount > 0
}
