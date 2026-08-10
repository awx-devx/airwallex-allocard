/**
 * Mirrors Airwallex card_status. B5 mutates only ACTIVE ⇄ INACTIVE → CLOSED;
 * BLOCKED / LOST / STOLEN / FAILED are Airwallex-driven (webhooks in B8).
 */
export const CardStatus = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  CLOSED: 'CLOSED',
  BLOCKED: 'BLOCKED',
  LOST: 'LOST',
  STOLEN: 'STOLEN',
  FAILED: 'FAILED',
} as const

export type CardStatus = (typeof CardStatus)[keyof typeof CardStatus]
