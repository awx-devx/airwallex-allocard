/**
 * Card purpose. Maps from Project.cardStructure:
 * shared → SHARED, perMember → MEMBER, vendor → VENDOR, oneTime → ONE_TIME.
 * Not PER_MEMBER — matches ARCHITECTURE + RULES-ENGINE.
 */
export const CardPurpose = {
  SHARED: 'SHARED',
  MEMBER: 'MEMBER',
  VENDOR: 'VENDOR',
  ONE_TIME: 'ONE_TIME',
} as const

export type CardPurpose = (typeof CardPurpose)[keyof typeof CardPurpose]
