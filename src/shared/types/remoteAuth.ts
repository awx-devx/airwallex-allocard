import { z } from 'zod'
import {
  remoteAuthDecisionSchema,
  remoteAuthInput,
  remoteAuthMerchantSchema,
  simulatePurchaseInput,
} from '@/shared/schemas/remoteAuth'

export type RemoteAuthMerchant = z.infer<typeof remoteAuthMerchantSchema>
export type RemoteAuthInput = z.infer<typeof remoteAuthInput>
export type RemoteAuthDecision = z.infer<typeof remoteAuthDecisionSchema>
export type SimulatePurchaseInput = z.infer<typeof simulatePurchaseInput>
