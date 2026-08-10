/**
 * Subject type on an AttributeValue row.
 * Mirrors AttributeScope — one value per (orgId, key, subjectType, subjectId).
 */
export const AttributeSubjectType = {
  ORG: 'ORG',
  PROJECT: 'PROJECT',
  MEMBER: 'MEMBER',
  CARD: 'CARD',
} as const

export type AttributeSubjectType = (typeof AttributeSubjectType)[keyof typeof AttributeSubjectType]
