import { z } from 'zod'
import {
  attributeDefinitionListSchema,
  attributeDefinitionSchema,
  attributeLiteralSchema,
  attributeValueListSchema,
  attributeValueSchema,
  createAttributeDefinitionInput,
  ingestAttributeValueInput,
  listAttributeValuesQuery,
  listAttributesQuery,
  putAttributeValueInput,
  updateAttributeDefinitionInput,
} from '@/shared/schemas/attribute'

export type AttributeLiteral = z.infer<typeof attributeLiteralSchema>
export type AttributeDefinition = z.infer<typeof attributeDefinitionSchema>
export type CreateAttributeDefinitionInput = z.infer<typeof createAttributeDefinitionInput>
export type UpdateAttributeDefinitionInput = z.infer<typeof updateAttributeDefinitionInput>
export type AttributeValue = z.infer<typeof attributeValueSchema>
export type ListAttributesQuery = z.infer<typeof listAttributesQuery>
export type AttributeDefinitionList = z.infer<typeof attributeDefinitionListSchema>
export type ListAttributeValuesQuery = z.infer<typeof listAttributeValuesQuery>
export type AttributeValueList = z.infer<typeof attributeValueListSchema>
export type PutAttributeValueInput = z.infer<typeof putAttributeValueInput>
export type IngestAttributeValueInput = z.infer<typeof ingestAttributeValueInput>
