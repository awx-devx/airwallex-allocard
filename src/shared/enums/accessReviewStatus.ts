export const AccessReviewStatus = {
  OPEN: 'OPEN',
  RESOLVED: 'RESOLVED',
} as const

export type AccessReviewStatus = (typeof AccessReviewStatus)[keyof typeof AccessReviewStatus]

/** How an open access review was closed (B9: confirm or revoke). */
export const AccessReviewResolution = {
  CONFIRM: 'CONFIRM',
  REVOKE: 'REVOKE',
} as const

export type AccessReviewResolution =
  (typeof AccessReviewResolution)[keyof typeof AccessReviewResolution]
