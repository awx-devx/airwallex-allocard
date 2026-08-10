import { defineContract } from '@/shared/contracts/types'
import {
  attributeDefinitionListSchema,
  attributeDefinitionSchema,
  attributeValueListSchema,
  attributeValueSchema,
  createAttributeDefinitionInput,
  ingestAttributeValueInput,
  listAttributeValuesQuery,
  listAttributesQuery,
  putAttributeValueInput,
  updateAttributeDefinitionInput,
} from '@/shared/schemas/attribute'

export const attributeContracts = {
  list: defineContract({
    method: 'GET',
    path: '/api/attributes',
    input: listAttributesQuery,
    output: attributeDefinitionListSchema,
  }),
  create: defineContract({
    method: 'POST',
    path: '/api/attributes',
    input: createAttributeDefinitionInput,
    output: attributeDefinitionSchema,
  }),
  update: defineContract({
    method: 'PATCH',
    path: '/api/attributes/:key',
    input: updateAttributeDefinitionInput,
    output: attributeDefinitionSchema,
  }),
  listValues: defineContract({
    method: 'GET',
    path: '/api/attributes/values',
    input: listAttributeValuesQuery,
    output: attributeValueListSchema,
  }),
  putValue: defineContract({
    method: 'PUT',
    path: '/api/attributes/values',
    input: putAttributeValueInput,
    output: attributeValueSchema,
  }),
  ingest: defineContract({
    method: 'POST',
    path: '/api/attributes/ingest',
    input: ingestAttributeValueInput,
    output: attributeValueSchema,
  }),
} as const

export type AttributeContracts = typeof attributeContracts
