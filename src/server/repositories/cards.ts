/**
 * Cards are tenant-owned. Every method takes `OrgContext` first and filters on
 * `ctx.orgId`. Cross-org find → null (handler maps to 404). Never stores PAN.
 */
import { isValidObjectId } from 'mongoose'
import { CardModel, type CardControlsFields, type CardFields } from '@/server/models/Card'
import { toDomain } from '@/server/models/base'
import type { OrgContext } from '@/server/http/types'
import { CardStatus } from '@/shared/enums/cardStatus'
import type { CardPurpose } from '@/shared/enums/cardPurpose'
import type { Card, CardList } from '@/shared/types/card'
import type { CardControls } from '@/shared/types/cardControls'

export type CreateCardFields = {
  projectId?: string | null
  categoryId?: string | null
  cardholderId: string
  airwallexCardId: string
  maskedNumber: string
  nickName: string
  purpose: CardPurpose
  status?: CardStatus
  desiredControls: CardControls
  appliedControls: CardControls
  managedByRuleIds?: string[]
  accessList?: string[]
  lastReconciledAt?: string | null
}

export type ListCardsFilter = {
  projectId?: string
  status?: CardStatus
  purpose?: CardPurpose
  cardholderId?: string
  page?: number
  pageSize?: number
}

function controlsToStorage(controls: CardControls): CardControlsFields {
  return {
    allowedTransactionCount: controls.allowedTransactionCount,
    transactionLimits: {
      currency: controls.transactionLimits.currency,
      limits: controls.transactionLimits.limits.map((limit) => ({
        interval: limit.interval,
        amount: limit.amount,
      })),
    },
    activeFrom: controls.activeFrom ? new Date(controls.activeFrom) : null,
    activeTo: controls.activeTo ? new Date(controls.activeTo) : null,
    allowedCurrencies: controls.allowedCurrencies,
    allowedMerchantCategories: controls.allowedMerchantCategories,
    allowedMerchantCountries: controls.allowedMerchantCountries,
    allowedMerchantBrands: controls.allowedMerchantBrands,
    blockedTransactionUsages: controls.blockedTransactionUsages.map((usage) => ({
      transactionScope: usage.transactionScope,
      usageScope: usage.usageScope,
    })),
  }
}

function toCardControls(raw: unknown): CardControls {
  const value = raw as Record<string, unknown>
  const limits = value.transactionLimits as {
    currency: string
    limits: Array<{ interval: string; amount: number }>
  }
  return {
    allowedTransactionCount:
      value.allowedTransactionCount as CardControls['allowedTransactionCount'],
    transactionLimits: {
      currency: String(limits.currency),
      limits: limits.limits.map((limit) => ({
        interval: limit.interval as CardControls['transactionLimits']['limits'][number]['interval'],
        amount: Number(limit.amount),
      })),
    },
    activeFrom: value.activeFrom == null ? null : String(value.activeFrom),
    activeTo: value.activeTo == null ? null : String(value.activeTo),
    allowedCurrencies: (value.allowedCurrencies as string[] | null) ?? null,
    allowedMerchantCategories: (value.allowedMerchantCategories as string[] | null) ?? null,
    allowedMerchantCountries: (value.allowedMerchantCountries as string[] | null) ?? null,
    allowedMerchantBrands: (value.allowedMerchantBrands as string[] | null) ?? null,
    blockedTransactionUsages: Array.isArray(value.blockedTransactionUsages)
      ? value.blockedTransactionUsages.map((usage) => {
          const row = usage as Record<string, unknown>
          return {
            transactionScope: String(row.transactionScope),
            usageScope: String(row.usageScope),
          }
        })
      : [],
  }
}

function toCard(doc: Parameters<typeof toDomain>[0]): Card {
  const raw = toDomain<Record<string, unknown>>(doc)
  return {
    id: String(raw.id),
    orgId: String(raw.orgId),
    projectId: raw.projectId == null ? null : String(raw.projectId),
    categoryId: raw.categoryId == null ? null : String(raw.categoryId),
    cardholderId: String(raw.cardholderId),
    airwallexCardId: String(raw.airwallexCardId),
    maskedNumber: String(raw.maskedNumber),
    nickName: String(raw.nickName),
    purpose: raw.purpose as Card['purpose'],
    status: raw.status as Card['status'],
    desiredControls: toCardControls(raw.desiredControls),
    appliedControls: toCardControls(raw.appliedControls),
    lastReconciledAt: raw.lastReconciledAt == null ? null : String(raw.lastReconciledAt),
    managedByRuleIds: Array.isArray(raw.managedByRuleIds) ? raw.managedByRuleIds.map(String) : [],
    accessList: Array.isArray(raw.accessList) ? raw.accessList.map(String) : [],
    createdAt: String(raw.createdAt),
    updatedAt: String(raw.updatedAt),
  }
}

export async function createCard(ctx: OrgContext, input: CreateCardFields): Promise<Card> {
  const fields: Omit<CardFields, 'createdAt' | 'updatedAt'> = {
    orgId: ctx.orgId,
    projectId: input.projectId === undefined ? null : input.projectId,
    categoryId: input.categoryId === undefined ? null : input.categoryId,
    cardholderId: input.cardholderId,
    airwallexCardId: input.airwallexCardId,
    maskedNumber: input.maskedNumber,
    nickName: input.nickName,
    purpose: input.purpose,
    status: input.status ?? CardStatus.PENDING,
    desiredControls: controlsToStorage(input.desiredControls),
    appliedControls: controlsToStorage(input.appliedControls),
    lastReconciledAt:
      input.lastReconciledAt === undefined || input.lastReconciledAt === null
        ? null
        : new Date(input.lastReconciledAt),
    managedByRuleIds: input.managedByRuleIds ?? [],
    accessList: input.accessList ?? [],
  }
  const doc = await CardModel.create(fields)
  return toCard(doc)
}

export async function findCardById(ctx: OrgContext, id: string): Promise<Card | null> {
  if (!isValidObjectId(id)) {
    return null
  }
  const doc = await CardModel.findOne({ _id: id, orgId: ctx.orgId }).lean().exec()
  return doc ? toCard(doc) : null
}

export async function findCardByAirwallexId(
  ctx: OrgContext,
  airwallexCardId: string,
): Promise<Card | null> {
  const doc = await CardModel.findOne({ orgId: ctx.orgId, airwallexCardId }).lean().exec()
  return doc ? toCard(doc) : null
}

export async function listCards(ctx: OrgContext, filter: ListCardsFilter = {}): Promise<CardList> {
  const page = filter.page ?? 1
  const pageSize = filter.pageSize ?? 20

  const query: Record<string, unknown> = { orgId: ctx.orgId }
  if (filter.projectId !== undefined) query.projectId = filter.projectId
  if (filter.status !== undefined) query.status = filter.status
  if (filter.purpose !== undefined) query.purpose = filter.purpose
  if (filter.cardholderId !== undefined) query.cardholderId = filter.cardholderId

  const [total, docs] = await Promise.all([
    CardModel.countDocuments(query).exec(),
    CardModel.find(query)
      .sort({ createdAt: -1, _id: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean()
      .exec(),
  ])

  return {
    items: docs.map((doc) => toCard(doc)),
    page,
    pageSize,
    total,
  }
}

export async function updateCardStatus(
  ctx: OrgContext,
  id: string,
  status: CardStatus,
): Promise<Card | null> {
  if (!isValidObjectId(id)) {
    return null
  }
  const doc = await CardModel.findOneAndUpdate(
    { _id: id, orgId: ctx.orgId },
    { $set: { status } },
    { returnDocument: 'after' },
  )
    .lean()
    .exec()
  return doc ? toCard(doc) : null
}

export async function updateDesiredControls(
  ctx: OrgContext,
  id: string,
  desiredControls: CardControls,
): Promise<Card | null> {
  if (!isValidObjectId(id)) {
    return null
  }
  const doc = await CardModel.findOneAndUpdate(
    { _id: id, orgId: ctx.orgId },
    { $set: { desiredControls: controlsToStorage(desiredControls) } },
    { returnDocument: 'after' },
  )
    .lean()
    .exec()
  return doc ? toCard(doc) : null
}

export async function updateAppliedControls(
  ctx: OrgContext,
  id: string,
  appliedControls: CardControls,
  lastReconciledAt: Date = new Date(),
): Promise<Card | null> {
  if (!isValidObjectId(id)) {
    return null
  }
  const doc = await CardModel.findOneAndUpdate(
    { _id: id, orgId: ctx.orgId },
    {
      $set: {
        appliedControls: controlsToStorage(appliedControls),
        lastReconciledAt,
      },
    },
    { returnDocument: 'after' },
  )
    .lean()
    .exec()
  return doc ? toCard(doc) : null
}

export async function updateCardNickname(
  ctx: OrgContext,
  id: string,
  nickName: string,
): Promise<Card | null> {
  if (!isValidObjectId(id)) {
    return null
  }
  const doc = await CardModel.findOneAndUpdate(
    { _id: id, orgId: ctx.orgId },
    { $set: { nickName } },
    { returnDocument: 'after' },
  )
    .lean()
    .exec()
  return doc ? toCard(doc) : null
}

export async function updateCardAccessList(
  ctx: OrgContext,
  id: string,
  accessList: string[],
): Promise<Card | null> {
  if (!isValidObjectId(id)) {
    return null
  }
  const doc = await CardModel.findOneAndUpdate(
    { _id: id, orgId: ctx.orgId },
    { $set: { accessList } },
    { returnDocument: 'after' },
  )
    .lean()
    .exec()
  return doc ? toCard(doc) : null
}

export async function updateCardAirwallexFields(
  ctx: OrgContext,
  id: string,
  patch: {
    airwallexCardId?: string
    maskedNumber?: string
    status?: CardStatus
  },
): Promise<Card | null> {
  if (!isValidObjectId(id)) {
    return null
  }
  const $set: Record<string, unknown> = {}
  if (patch.airwallexCardId !== undefined) $set.airwallexCardId = patch.airwallexCardId
  if (patch.maskedNumber !== undefined) $set.maskedNumber = patch.maskedNumber
  if (patch.status !== undefined) $set.status = patch.status
  if (Object.keys($set).length === 0) {
    return findCardById(ctx, id)
  }
  const doc = await CardModel.findOneAndUpdate(
    { _id: id, orgId: ctx.orgId },
    { $set },
    { returnDocument: 'after' },
  )
    .lean()
    .exec()
  return doc ? toCard(doc) : null
}

/** Count cards that are not CLOSED — used by noActiveCards / overview. */
export async function countNonClosedByProject(ctx: OrgContext, projectId: string): Promise<number> {
  return CardModel.countDocuments({
    orgId: ctx.orgId,
    projectId,
    status: { $ne: CardStatus.CLOSED },
  }).exec()
}
