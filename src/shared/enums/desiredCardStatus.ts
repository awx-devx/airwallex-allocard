/**
 * Status values rules may desire / merge (RULES-ENGINE §4).
 * Most restrictive: CLOSED > INACTIVE > ACTIVE.
 * Broader CardStatus values (PENDING, BLOCKED, …) are Airwallex-driven, not rule outputs.
 */
export const DesiredCardStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  CLOSED: 'CLOSED',
} as const

export type DesiredCardStatus = (typeof DesiredCardStatus)[keyof typeof DesiredCardStatus]
