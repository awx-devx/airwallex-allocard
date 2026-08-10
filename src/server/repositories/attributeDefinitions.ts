/**
 * Attribute registry is tenant-owned. Every method takes `OrgContext` first and
 * filters on `ctx.orgId`. Cross-org find → null (handler maps to 404).
 * The webhook secret hash never leaves this file except via `findWebhookSecretHash`.
 */
import { AttributeDefinitionModel } from '@/server/models/AttributeDefinition'
import { toDomain } from '@/server/models/base'
import type { OrgContext } from '@/server/http/types'
import type { AttributeScope } from '@/shared/enums/attributeScope'
import { AttributeSource } from '@/shared/enums/attributeSource'
import type { AttributeType } from '@/shared/enums/attributeType'
import type { AttributeDefinition, AttributeDefinitionList } from '@/shared/types/attribute'

export type CreateAttributeDefinitionFields = {
  key: string
  label: string
  type: AttributeType
  unit?: string | null
  scope: AttributeScope
  source: AttributeSource
  connectorId?: string | null
  refreshIntervalSec?: number | null
  enumValues?: string[] | null
  webhookSecretHash?: string | null
}

export type UpdateAttributeDefinitionFields = {
  label?: string
  unit?: string | null
  connectorId?: string | null
  refreshIntervalSec?: number | null
  enumValues?: string[] | null
  webhookSecretHash?: string | null
}

export type ListAttributeDefinitionsFilter = {
  scope?: AttributeScope
  source?: AttributeSource
  page?: number
  pageSize?: number
}

function toAttributeDefinition(doc: Parameters<typeof toDomain>[0]): AttributeDefinition {
  const raw = toDomain<Record<string, unknown>>(doc)
  return {
    id: String(raw.id),
    orgId: String(raw.orgId),
    key: String(raw.key),
    label: String(raw.label),
    type: raw.type as AttributeDefinition['type'],
    unit: raw.unit == null ? null : String(raw.unit),
    scope: raw.scope as AttributeDefinition['scope'],
    source: raw.source as AttributeDefinition['source'],
    connectorId: raw.connectorId == null ? null : String(raw.connectorId),
    refreshIntervalSec: raw.refreshIntervalSec == null ? null : Number(raw.refreshIntervalSec),
    enumValues: Array.isArray(raw.enumValues) ? raw.enumValues.map(String) : null,
    hasWebhookSecret: Boolean(raw.hasWebhookSecret),
    createdAt: String(raw.createdAt),
    updatedAt: String(raw.updatedAt),
  }
}

export async function createAttributeDefinition(
  ctx: OrgContext,
  input: CreateAttributeDefinitionFields,
): Promise<AttributeDefinition> {
  const doc = await AttributeDefinitionModel.create({
    orgId: ctx.orgId,
    key: input.key,
    label: input.label,
    type: input.type,
    unit: input.unit ?? null,
    scope: input.scope,
    source: input.source,
    connectorId: input.connectorId ?? null,
    refreshIntervalSec: input.refreshIntervalSec ?? null,
    enumValues: input.enumValues ?? null,
    hasWebhookSecret: Boolean(input.webhookSecretHash),
    webhookSecretHash: input.webhookSecretHash ?? null,
  })
  return toAttributeDefinition(doc)
}

export async function findAttributeDefinitionByKey(
  ctx: OrgContext,
  key: string,
): Promise<AttributeDefinition | null> {
  const doc = await AttributeDefinitionModel.findOne({ orgId: ctx.orgId, key }).lean().exec()
  return doc ? toAttributeDefinition(doc) : null
}

export async function findAttributeDefinitionsByKeys(
  ctx: OrgContext,
  keys: string[],
): Promise<AttributeDefinition[]> {
  if (keys.length === 0) {
    return []
  }
  const docs = await AttributeDefinitionModel.find({ orgId: ctx.orgId, key: { $in: keys } })
    .lean()
    .exec()
  return docs.map((doc) => toAttributeDefinition(doc))
}

export async function listAttributeDefinitions(
  ctx: OrgContext,
  filter: ListAttributeDefinitionsFilter = {},
): Promise<AttributeDefinitionList> {
  const page = filter.page ?? 1
  const pageSize = filter.pageSize ?? 20

  const query: Record<string, unknown> = { orgId: ctx.orgId }
  if (filter.scope !== undefined) query.scope = filter.scope
  if (filter.source !== undefined) query.source = filter.source

  const [total, docs] = await Promise.all([
    AttributeDefinitionModel.countDocuments(query).exec(),
    AttributeDefinitionModel.find(query)
      .sort({ key: 1, _id: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean()
      .exec(),
  ])

  return {
    items: docs.map((doc) => toAttributeDefinition(doc)),
    page,
    pageSize,
    total,
  }
}

export async function updateAttributeDefinition(
  ctx: OrgContext,
  key: string,
  patch: UpdateAttributeDefinitionFields,
): Promise<AttributeDefinition | null> {
  const $set: Record<string, unknown> = {}
  if (patch.label !== undefined) $set.label = patch.label
  if (patch.unit !== undefined) $set.unit = patch.unit
  if (patch.connectorId !== undefined) $set.connectorId = patch.connectorId
  if (patch.refreshIntervalSec !== undefined) $set.refreshIntervalSec = patch.refreshIntervalSec
  if (patch.enumValues !== undefined) $set.enumValues = patch.enumValues
  if (patch.webhookSecretHash !== undefined) {
    $set.webhookSecretHash = patch.webhookSecretHash
    $set.hasWebhookSecret = Boolean(patch.webhookSecretHash)
  }
  if (Object.keys($set).length === 0) {
    return findAttributeDefinitionByKey(ctx, key)
  }

  const doc = await AttributeDefinitionModel.findOneAndUpdate(
    { orgId: ctx.orgId, key },
    { $set },
    { returnDocument: 'after' },
  )
    .lean()
    .exec()
  return doc ? toAttributeDefinition(doc) : null
}

/** Only caller: the ingest route, verifying a signed push. */
export async function findWebhookSecretHash(ctx: OrgContext, key: string): Promise<string | null> {
  const doc = await AttributeDefinitionModel.findOne({ orgId: ctx.orgId, key })
    .select('+webhookSecretHash')
    .lean()
    .exec()
  const hash = (doc as { webhookSecretHash?: string | null } | null)?.webhookSecretHash
  return hash ?? null
}

/**
 * Cross-tenant bootstrap for webhook ingest (same pattern as invite token lookup).
 * Returns the definition when `(key, webhookSecretHash)` matches; never the hash.
 */
export async function findAttributeDefinitionByWebhookSecret(
  key: string,
  webhookSecretHash: string,
): Promise<AttributeDefinition | null> {
  const doc = await AttributeDefinitionModel.findOne({
    key,
    webhookSecretHash,
    source: AttributeSource.WEBHOOK,
  })
    .select('+webhookSecretHash')
    .setOptions({ allowCrossTenant: true })
    .lean()
    .exec()
  return doc ? toAttributeDefinition(doc) : null
}

export async function deleteAttributeDefinition(ctx: OrgContext, key: string): Promise<boolean> {
  const result = await AttributeDefinitionModel.deleteOne({ orgId: ctx.orgId, key }).exec()
  return result.deletedCount > 0
}
