/**
 * Airwallex remote-auth decision wire values (response_status).
 * Not the same as TransactionStatus — AUTHORIZED here means approve the auth request.
 */
export const RemoteAuthResponseStatus = {
  AUTHORIZED: 'AUTHORIZED',
  DECLINED: 'DECLINED',
} as const

export type RemoteAuthResponseStatus =
  (typeof RemoteAuthResponseStatus)[keyof typeof RemoteAuthResponseStatus]
