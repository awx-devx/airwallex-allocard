import { call } from '@/client/api/client'
import type { ContractCaller } from '@/client/hooks/useSession'

/** Typed call wrapper for hook query-option tests. */
export const mockCaller: ContractCaller = (contract, args) => call(contract, args)
