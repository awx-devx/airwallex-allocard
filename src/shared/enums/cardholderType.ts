export const CardholderType = {
  INDIVIDUAL: 'INDIVIDUAL',
  DELEGATE: 'DELEGATE',
} as const

export type CardholderType = (typeof CardholderType)[keyof typeof CardholderType]
