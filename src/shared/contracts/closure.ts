import { z } from 'zod'
import { defineContract } from '@/shared/contracts/types'
import {
  closurePreflightSchema,
  closureStatusSchema,
  completeClosureInput,
  startClosureInput,
} from '@/shared/schemas/closure'

export const closureContracts = {
  preflight: defineContract({
    method: 'GET',
    path: '/api/projects/:id/closure/preflight',
    input: z.void(),
    output: closurePreflightSchema,
  }),
  start: defineContract({
    method: 'POST',
    path: '/api/projects/:id/closure/start',
    input: startClosureInput,
    output: closureStatusSchema,
  }),
  status: defineContract({
    method: 'GET',
    path: '/api/projects/:id/closure/status',
    input: z.void(),
    output: closureStatusSchema,
  }),
  complete: defineContract({
    method: 'POST',
    path: '/api/projects/:id/closure/complete',
    input: completeClosureInput,
    output: closureStatusSchema,
  }),
} as const

export type ClosureContracts = typeof closureContracts
