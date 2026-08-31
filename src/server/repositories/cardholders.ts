/**
 * Cardholders are tenant-owned. Every method takes `OrgContext` first and
 * filters on `ctx.orgId`. Cross-org find → null (handler maps to 404).
 */
import { isValidObjectId } from 'mongoose'
import { CardholderModel } from '@/server/models/Cardholder'
import { toDomain } from '@/server/models/base'
import type { OrgContext } from '@/server/http/types'
import type { CardholderStatus } from '@/shared/enums/cardholderStatus'
import type { CardholderType } from '@/shared/enums/cardholderType'
import type { Cardholder, CardholderList } from '@/shared/types/cardholder'

export type CreateCardholderFields = {
  userId?: string | null
  airwallexCardholderId: string
  type: CardholderType
  status?: CardholderStatus
}

export type ListCardholdersFilter = {
  type?: CardholderType
  status?: CardholderStatus
  userId?: string
  page?: number
  pageSize?: number
}

function toCardholder(doc: Parameters<typeof toDomain>[0]): Cardholder {
  const raw = toDomain<Record<string, unknown>>(doc)
  return {
    id: String(raw.id),
    orgId: String(raw.orgId),
    userId: raw.userId == null ? null : String(raw.userId),
    airwallexCardholderId: String(raw.airwallexCardholderId),
    type: raw.type as Cardholder['type'],
    status: raw.status as Cardholder['status'],
    createdAt: String(raw.createdAt),
    updatedAt: String(raw.updatedAt),
  }
}

export async function createCardholder(
  ctx: OrgContext,
  input: CreateCardholderFields,
): Promise<Cardholder> {
  const doc = await CardholderModel.create({
    orgId: ctx.orgId,
    userId: input.userId === undefined ? null : input.userId,
    airwallexCardholderId: input.airwallexCardholderId,
    type: input.type,
    ...(input.status !== undefined ? { status: input.status } : {}),
  })
  return toCardholder(doc)
}

export async function findCardholderById(ctx: OrgContext, id: string): Promise<Cardholder | null> {
  if (!isValidObjectId(id)) {
    return null
  }
  const doc = await CardholderModel.findOne({ _id: id, orgId: ctx.orgId }).lean().exec()
  return doc ? toCardholder(doc) : null
}

export async function findCardholderByAirwallexId(
  ctx: OrgContext,
  airwallexCardholderId: string,
): Promise<Cardholder | null> {
  const doc = await CardholderModel.findOne({
    orgId: ctx.orgId,
    airwallexCardholderId,
  })
    .lean()
    .exec()
  return doc ? toCardholder(doc) : null
}

export async function findCardholderByUserId(
  ctx: OrgContext,
  userId: string,
): Promise<Cardholder | null> {
  const doc = await CardholderModel.findOne({ orgId: ctx.orgId, userId }).lean().exec()
  return doc ? toCardholder(doc) : null
}

/** Oldest org-level DELEGATE (`userId` null). One per Allocard org. */
export async function findOrgDelegateCardholder(ctx: OrgContext): Promise<Cardholder | null> {
  const doc = await CardholderModel.findOne({
    orgId: ctx.orgId,
    type: 'DELEGATE',
    userId: null,
  })
    .sort({ createdAt: 1, _id: 1 })
    .lean()
    .exec()
  return doc ? toCardholder(doc) : null
}

export async function listCardholders(
  ctx: OrgContext,
  filter: ListCardholdersFilter = {},
): Promise<CardholderList> {
  const page = filter.page ?? 1
  const pageSize = filter.pageSize ?? 20

  const query: Record<string, unknown> = { orgId: ctx.orgId }
  if (filter.type !== undefined) query.type = filter.type
  if (filter.status !== undefined) query.status = filter.status
  if (filter.userId !== undefined) query.userId = filter.userId

  const [total, docs] = await Promise.all([
    CardholderModel.countDocuments(query).exec(),
    CardholderModel.find(query)
      .sort({ createdAt: -1, _id: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean()
      .exec(),
  ])

  return {
    items: docs.map((doc) => toCardholder(doc)),
    page,
    pageSize,
    total,
  }
}

export async function updateCardholderStatus(
  ctx: OrgContext,
  id: string,
  status: CardholderStatus,
): Promise<Cardholder | null> {
  if (!isValidObjectId(id)) {
    return null
  }
  const doc = await CardholderModel.findOneAndUpdate(
    { _id: id, orgId: ctx.orgId },
    { $set: { status } },
    { returnDocument: 'after' },
  )
    .lean()
    .exec()
  return doc ? toCardholder(doc) : null
}

export async function updateCardholderAirwallexId(
  ctx: OrgContext,
  id: string,
  airwallexCardholderId: string,
): Promise<Cardholder | null> {
  if (!isValidObjectId(id)) {
    return null
  }
  const doc = await CardholderModel.findOneAndUpdate(
    { _id: id, orgId: ctx.orgId },
    { $set: { airwallexCardholderId } },
    { returnDocument: 'after' },
  )
    .lean()
    .exec()
  return doc ? toCardholder(doc) : null
}
