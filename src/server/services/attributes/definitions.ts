/**
 * Attribute registry HTTP services — define and update custom attributes.
 * Built-ins are not stored; POST rejects their keys so a custom row cannot
 * shadow a computed one.
 */
import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import {
  createAttributeDefinition,
  findAttributeDefinitionByKey,
  listAttributeDefinitions,
  updateAttributeDefinition,
} from '@/server/repositories/attributeDefinitions'
import { isBuiltinAttributeKey } from '@/server/services/attributes/registry'
import { hashWebhookSecret } from '@/server/services/attributes/webhookSecret'
import { audit } from '@/server/services/audit/log'
import { AttributeSource } from '@/shared/enums/attributeSource'
import type {
  AttributeDefinition,
  AttributeDefinitionList,
  CreateAttributeDefinitionInput,
  ListAttributesQuery,
  UpdateAttributeDefinitionInput,
} from '@/shared/types/attribute'

function isMongoDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 11000
  )
}

export async function listAttributeRegistry(
  ctx: OrgContext,
  query: ListAttributesQuery,
): Promise<AttributeDefinitionList> {
  await connectDb()
  return listAttributeDefinitions(ctx, query)
}

export async function createAttributeRegistryEntry(
  ctx: OrgContext,
  input: CreateAttributeDefinitionInput,
): Promise<AttributeDefinition> {
  await connectDb()

  if (isBuiltinAttributeKey(input.key)) {
    throw AppError.conflict(`Attribute key '${input.key}' is a built-in and cannot be redefined`)
  }

  const existing = await findAttributeDefinitionByKey(ctx, input.key)
  if (existing) {
    throw AppError.conflict(`Attribute key '${input.key}' already exists`)
  }

  try {
    const created = await createAttributeDefinition(ctx, {
      key: input.key,
      label: input.label,
      type: input.type,
      unit: input.unit ?? null,
      scope: input.scope,
      source: input.source,
      connectorId: input.connectorId ?? null,
      refreshIntervalSec: input.refreshIntervalSec ?? null,
      enumValues: input.enumValues ?? null,
      webhookSecretHash:
        input.source === AttributeSource.WEBHOOK && input.webhookSecret
          ? hashWebhookSecret(input.webhookSecret)
          : null,
    })

    await audit(ctx, {
      action: 'attribute.definition.created',
      subjectType: 'attribute',
      subjectId: created.key,
      after: {
        key: created.key,
        source: created.source,
        type: created.type,
        scope: created.scope,
      },
    })

    return created
  } catch (error) {
    if (isMongoDuplicateKey(error)) {
      throw AppError.conflict(`Attribute key '${input.key}' already exists`)
    }
    throw error
  }
}

export async function updateAttributeRegistryEntry(
  ctx: OrgContext,
  key: string,
  input: UpdateAttributeDefinitionInput,
): Promise<AttributeDefinition> {
  await connectDb()

  const existing = await findAttributeDefinitionByKey(ctx, key)
  if (!existing) {
    throw AppError.notFound()
  }

  if (input.webhookSecret !== undefined && existing.source !== AttributeSource.WEBHOOK) {
    throw AppError.validationFailed({
      webhookSecret: ['webhookSecret only applies to WEBHOOK attributes'],
    })
  }

  const updated = await updateAttributeDefinition(ctx, key, {
    ...(input.label !== undefined ? { label: input.label } : {}),
    ...(input.unit !== undefined ? { unit: input.unit } : {}),
    ...(input.connectorId !== undefined ? { connectorId: input.connectorId } : {}),
    ...(input.refreshIntervalSec !== undefined
      ? { refreshIntervalSec: input.refreshIntervalSec }
      : {}),
    ...(input.enumValues !== undefined ? { enumValues: input.enumValues } : {}),
    ...(input.webhookSecret !== undefined
      ? { webhookSecretHash: hashWebhookSecret(input.webhookSecret) }
      : {}),
  })

  if (!updated) {
    throw AppError.notFound()
  }

  await audit(ctx, {
    action: 'attribute.definition.updated',
    subjectType: 'attribute',
    subjectId: updated.key,
    before: {
      label: existing.label,
      unit: existing.unit,
      hasWebhookSecret: existing.hasWebhookSecret,
    },
    after: {
      label: updated.label,
      unit: updated.unit,
      hasWebhookSecret: updated.hasWebhookSecret,
      secretRotated: input.webhookSecret !== undefined,
    },
  })

  return updated
}
