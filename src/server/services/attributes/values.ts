/**
 * Attribute value writes — MANUAL via session, WEBHOOK via signed secret.
 * Both emit `attribute.updated` the moment the value lands (RULES-ENGINE §2).
 */
import { connectDb } from '@/server/db/connect'
import { publishEvent } from '@/server/events/bus'
import { DomainEventType, type AttributeUpdatedPayload } from '@/server/events/types'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import {
  findAttributeDefinitionByKey,
  findAttributeDefinitionByWebhookSecret,
} from '@/server/repositories/attributeDefinitions'
import { listAttributeValues, putAttributeValue } from '@/server/repositories/attributeValues'
import { hashWebhookSecret } from '@/server/services/attributes/webhookSecret'
import { audit } from '@/server/services/audit/log'
import { ActorType } from '@/shared/enums/audit'
import { AttributeSource } from '@/shared/enums/attributeSource'
import { AttributeType } from '@/shared/enums/attributeType'
import { OrgRole } from '@/shared/enums/orgRole'
import type {
  AttributeDefinition,
  AttributeLiteral,
  AttributeValue,
  AttributeValueList,
  IngestAttributeValueInput,
  ListAttributeValuesQuery,
  PutAttributeValueInput,
} from '@/shared/types/attribute'

const ATTRIBUTE_SECRET_HEADER = 'x-allocard-attribute-secret'

function assertValueMatchesType(
  type: AttributeType,
  value: AttributeLiteral,
  enumValues: string[] | null,
): void {
  switch (type) {
    case AttributeType.NUMBER:
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw AppError.validationFailed({ value: ['Expected a finite number'] })
      }
      return
    case AttributeType.STRING:
      if (typeof value !== 'string') {
        throw AppError.validationFailed({ value: ['Expected a string'] })
      }
      return
    case AttributeType.BOOLEAN:
      if (typeof value !== 'boolean') {
        throw AppError.validationFailed({ value: ['Expected a boolean'] })
      }
      return
    case AttributeType.DATE:
      if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
        throw AppError.validationFailed({ value: ['Expected an ISO datetime string'] })
      }
      return
    case AttributeType.ENUM:
      if (typeof value !== 'string' || !enumValues?.includes(value)) {
        throw AppError.validationFailed({
          value: [`Expected one of: ${(enumValues ?? []).join(', ')}`],
        })
      }
      return
    default: {
      const _exhaustive: never = type
      throw AppError.internal(`Unhandled attribute type: ${_exhaustive}`)
    }
  }
}

function assertSubjectMatchesScope(definition: AttributeDefinition, subjectType: string): void {
  // AttributeScope and AttributeSubjectType share the same string values.
  if (definition.scope !== subjectType) {
    throw AppError.validationFailed({
      subjectType: [`Subject type must be ${definition.scope} for this attribute`],
    })
  }
}

async function emitAttributeUpdated(ctx: OrgContext, value: AttributeValue): Promise<void> {
  await publishEvent<typeof DomainEventType.ATTRIBUTE_UPDATED, AttributeUpdatedPayload>({
    type: DomainEventType.ATTRIBUTE_UPDATED,
    orgId: ctx.orgId,
    subjectType: 'attribute',
    subjectId: value.key,
    payload: {
      key: value.key,
      subjectType: value.subjectType,
      subjectId: value.subjectId,
      source: value.source,
      observedAt: value.observedAt,
    },
  })
}

export async function listStoredAttributeValues(
  ctx: OrgContext,
  query: ListAttributeValuesQuery,
): Promise<AttributeValueList> {
  await connectDb()
  return listAttributeValues(ctx, query)
}

export async function putManualAttributeValue(
  ctx: OrgContext,
  input: PutAttributeValueInput,
): Promise<AttributeValue> {
  await connectDb()

  const definition = await findAttributeDefinitionByKey(ctx, input.key)
  if (!definition) {
    throw AppError.notFound()
  }
  if (definition.source !== AttributeSource.MANUAL) {
    throw AppError.conflict(`Attribute '${input.key}' is not MANUAL (source=${definition.source})`)
  }

  assertSubjectMatchesScope(definition, input.subjectType)
  assertValueMatchesType(definition.type, input.value, definition.enumValues)

  const value = await putAttributeValue(ctx, {
    key: input.key,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    value: input.value,
    ...(input.observedAt !== undefined ? { observedAt: input.observedAt } : {}),
    source: AttributeSource.MANUAL,
    ttlSec: input.ttlSec ?? null,
  })

  await emitAttributeUpdated(ctx, value)

  await audit(ctx, {
    action: 'attribute.value.put',
    subjectType: 'attribute',
    subjectId: value.key,
    after: {
      subjectType: value.subjectType,
      subjectId: value.subjectId,
      value: value.value,
      observedAt: value.observedAt,
      source: value.source,
    },
  })

  return value
}

/**
 * WEBHOOK ingest: auth is the shared secret header, not a session.
 * Org is recovered from the definition matched by `(key, secret hash)`.
 */
export async function ingestWebhookAttributeValue(
  input: IngestAttributeValueInput,
  secretHeader: string | null,
): Promise<AttributeValue> {
  await connectDb()

  if (!secretHeader) {
    throw AppError.unauthenticated('Missing attribute secret')
  }

  const definition = await findAttributeDefinitionByWebhookSecret(
    input.key,
    hashWebhookSecret(secretHeader),
  )
  if (!definition) {
    // Same status whether the key is unknown or the secret is wrong —
    // confirming either would help an attacker.
    throw AppError.unauthenticated('Invalid attribute secret')
  }

  assertSubjectMatchesScope(definition, input.subjectType)
  assertValueMatchesType(definition.type, input.value, definition.enumValues)

  const ctx: OrgContext = {
    orgId: definition.orgId,
    userId: 'system',
    orgRole: OrgRole.OWNER,
  }

  const value = await putAttributeValue(ctx, {
    key: input.key,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    value: input.value,
    ...(input.observedAt !== undefined ? { observedAt: input.observedAt } : {}),
    source: AttributeSource.WEBHOOK,
    ttlSec: input.ttlSec ?? null,
  })

  await emitAttributeUpdated(ctx, value)

  await audit(ctx, {
    action: 'attribute.value.ingested',
    subjectType: 'attribute',
    subjectId: value.key,
    actorType: ActorType.SYSTEM,
    actorId: 'webhook',
    after: {
      subjectType: value.subjectType,
      subjectId: value.subjectId,
      value: value.value,
      observedAt: value.observedAt,
      source: value.source,
    },
  })

  return value
}

export { ATTRIBUTE_SECRET_HEADER }
