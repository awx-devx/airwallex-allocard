import { z } from 'zod'
import { defineContract } from '@/shared/contracts/types'
import {
  cardholderListSchema,
  cardholderSchema,
  createCardholderInput,
  listCardholdersQuery,
} from '@/shared/schemas/cardholder'

export const cardholderContracts = {
  list: defineContract({
    method: 'GET',
    path: '/api/cardholders',
    input: listCardholdersQuery,
    output: cardholderListSchema,
  }),
  create: defineContract({
    method: 'POST',
    path: '/api/cardholders',
    input: createCardholderInput,
    output: cardholderSchema,
  }),
  get: defineContract({
    method: 'GET',
    path: '/api/cardholders/:id',
    input: z.void(),
    output: cardholderSchema,
  }),
} as const

export type CardholderContracts = typeof cardholderContracts
