import { defineContract } from '@/shared/contracts/types'
import {
  remoteAuthDecisionSchema,
  remoteAuthInput,
  simulatePurchaseInput,
} from '@/shared/schemas/remoteAuth'

/**
 * Remote auth + demo simulator.
 * Live path: HMAC raw body then parse as remoteAuthInput (Airwallex major units).
 * Simulator: OWNER+secret; builds the same decide path from minor-unit input.
 */
export const remoteAuthContracts = {
  decide: defineContract({
    method: 'POST',
    path: '/api/remote-auth',
    input: remoteAuthInput,
    output: remoteAuthDecisionSchema,
  }),
  simulatePurchase: defineContract({
    method: 'POST',
    path: '/api/simulate/purchase',
    input: simulatePurchaseInput,
    output: remoteAuthDecisionSchema,
  }),
} as const

export type RemoteAuthContracts = typeof remoteAuthContracts
