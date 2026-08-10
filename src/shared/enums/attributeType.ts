/**
 * Attribute value kinds in the registry (ARCHITECTURE §5).
 * NUMBER is not forced to int — money attrs use minor-unit ints by convention;
 * ratios like campaign.roas are floats.
 */
export const AttributeType = {
  NUMBER: 'NUMBER',
  STRING: 'STRING',
  BOOLEAN: 'BOOLEAN',
  DATE: 'DATE',
  ENUM: 'ENUM',
} as const

export type AttributeType = (typeof AttributeType)[keyof typeof AttributeType]
