/** Subject namespace for an attribute definition (ARCHITECTURE §5). */
export const AttributeScope = {
  ORG: 'ORG',
  PROJECT: 'PROJECT',
  MEMBER: 'MEMBER',
  CARD: 'CARD',
} as const

export type AttributeScope = (typeof AttributeScope)[keyof typeof AttributeScope]
