import { z } from 'zod'
import { AttributeScope } from '@/shared/enums/attributeScope'
import { AttributeSource } from '@/shared/enums/attributeSource'
import { AttributeSubjectType } from '@/shared/enums/attributeSubjectType'
import { AttributeType } from '@/shared/enums/attributeType'
import { idSchema, isoDateSchema } from '@/shared/schemas/base'

/** Wire value for an attribute — typed loosely; money attrs stay int minor units by convention. */
export const attributeLiteralSchema = z.union([z.number(), z.string(), z.boolean(), z.null()])

/**
 * Registry entry. COMPUTED rows are built-in; POST only creates MANUAL/WEBHOOK/CONNECTOR.
 * `webhookSecret` is never stored on this public shape (write-only on create/patch).
 */
export const attributeDefinitionSchema = z.object({
  id: idSchema,
  orgId: idSchema,
  key: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/, {
      message: 'key must be dotted lowercase identifiers, e.g. campaign.roas',
    }),
  label: z.string().min(1).max(120),
  type: z.enum(AttributeType),
  unit: z.string().min(1).max(40).nullable(),
  scope: z.enum(AttributeScope),
  source: z.enum(AttributeSource),
  connectorId: idSchema.nullable(),
  refreshIntervalSec: z.number().int().positive().nullable(),
  /** Present when type=ENUM; otherwise null. */
  enumValues: z.array(z.string().min(1)).min(1).nullable(),
  /** True when WEBHOOK source has a secret configured (secret itself never returned). */
  hasWebhookSecret: z.boolean(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
})

export const createAttributeDefinitionInput = z
  .object({
    key: attributeDefinitionSchema.shape.key,
    label: attributeDefinitionSchema.shape.label,
    type: z.enum(AttributeType),
    unit: z.string().min(1).max(40).nullable().optional(),
    scope: z.enum(AttributeScope),
    source: z.enum([AttributeSource.MANUAL, AttributeSource.WEBHOOK, AttributeSource.CONNECTOR]),
    connectorId: idSchema.optional(),
    refreshIntervalSec: z.number().int().positive().optional(),
    enumValues: z.array(z.string().min(1)).min(1).optional(),
    /** Required when source=WEBHOOK; stored hashed; never echoed. */
    webhookSecret: z.string().min(16).max(256).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.type === AttributeType.ENUM &&
      (value.enumValues === undefined || value.enumValues.length === 0)
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'enumValues required when type is ENUM',
        path: ['enumValues'],
      })
    }
    if (value.source === AttributeSource.WEBHOOK && !value.webhookSecret) {
      ctx.addIssue({
        code: 'custom',
        message: 'webhookSecret required when source is WEBHOOK',
        path: ['webhookSecret'],
      })
    }
    if (value.source === AttributeSource.CONNECTOR && !value.connectorId) {
      ctx.addIssue({
        code: 'custom',
        message: 'connectorId required when source is CONNECTOR',
        path: ['connectorId'],
      })
    }
    if (value.source === AttributeSource.CONNECTOR && value.refreshIntervalSec === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'refreshIntervalSec required when source is CONNECTOR',
        path: ['refreshIntervalSec'],
      })
    }
  })

export const updateAttributeDefinitionInput = z
  .object({
    label: z.string().min(1).max(120).optional(),
    unit: z.string().min(1).max(40).nullable().optional(),
    connectorId: idSchema.nullable().optional(),
    refreshIntervalSec: z.number().int().positive().nullable().optional(),
    enumValues: z.array(z.string().min(1)).min(1).nullable().optional(),
    /** Rotate WEBHOOK secret; omit to leave unchanged. */
    webhookSecret: z.string().min(16).max(256).optional(),
  })
  .refine(
    (value) =>
      value.label !== undefined ||
      value.unit !== undefined ||
      value.connectorId !== undefined ||
      value.refreshIntervalSec !== undefined ||
      value.enumValues !== undefined ||
      value.webhookSecret !== undefined,
    { message: 'At least one field is required' },
  )

export const attributeValueSchema = z.object({
  id: idSchema,
  orgId: idSchema,
  key: z.string().min(1),
  subjectType: z.enum(AttributeSubjectType),
  subjectId: idSchema,
  value: attributeLiteralSchema,
  observedAt: isoDateSchema,
  source: z.enum(AttributeSource),
  ttlSec: z.number().int().positive().nullable(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
})

export const listAttributesQuery = z.object({
  scope: z.enum(AttributeScope).optional(),
  source: z.enum(AttributeSource).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export const attributeDefinitionListSchema = z.object({
  items: z.array(attributeDefinitionSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
})

export const listAttributeValuesQuery = z.object({
  key: z.string().min(1).optional(),
  subjectType: z.enum(AttributeSubjectType).optional(),
  subjectId: idSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export const attributeValueListSchema = z.object({
  items: z.array(attributeValueSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
})

/** PUT MANUAL value. Service rejects if definition source ≠ MANUAL. */
export const putAttributeValueInput = z.object({
  key: z.string().min(1),
  subjectType: z.enum(AttributeSubjectType),
  subjectId: idSchema,
  value: attributeLiteralSchema,
  /** Defaults to now at write if omitted. */
  observedAt: isoDateSchema.optional(),
  ttlSec: z.number().int().positive().nullable().optional(),
})

/**
 * WEBHOOK ingest body. Auth is the signed secret (header), not session.
 * Invented header name for later tasks: `x-allocard-attribute-secret`.
 */
export const ingestAttributeValueInput = z.object({
  key: z.string().min(1),
  subjectType: z.enum(AttributeSubjectType),
  subjectId: idSchema,
  value: attributeLiteralSchema,
  observedAt: isoDateSchema.optional(),
  ttlSec: z.number().int().positive().nullable().optional(),
})
