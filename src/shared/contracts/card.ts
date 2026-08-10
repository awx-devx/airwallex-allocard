import { z } from 'zod'
import { defineContract } from '@/shared/contracts/types'
import {
  cardLimitsOutput,
  cardListSchema,
  cardSchema,
  closeCardInput,
  createCardInput,
  listCardsQuery,
  listProjectCardsQuery,
  panTokenOutput,
  updateCardInput,
} from '@/shared/schemas/card'

export const cardContracts = {
  list: defineContract({
    method: 'GET',
    path: '/api/cards',
    input: listCardsQuery,
    output: cardListSchema,
  }),
  listForProject: defineContract({
    method: 'GET',
    path: '/api/projects/:id/cards',
    input: listProjectCardsQuery,
    output: cardListSchema,
  }),
  create: defineContract({
    method: 'POST',
    path: '/api/projects/:id/cards',
    input: createCardInput,
    output: cardSchema,
  }),
  get: defineContract({
    method: 'GET',
    path: '/api/cards/:id',
    input: z.void(),
    output: cardSchema,
  }),
  update: defineContract({
    method: 'PATCH',
    path: '/api/cards/:id',
    input: updateCardInput,
    output: cardSchema,
  }),
  freeze: defineContract({
    method: 'POST',
    path: '/api/cards/:id/freeze',
    input: z.void(),
    output: cardSchema,
  }),
  unfreeze: defineContract({
    method: 'POST',
    path: '/api/cards/:id/unfreeze',
    input: z.void(),
    output: cardSchema,
  }),
  close: defineContract({
    method: 'POST',
    path: '/api/cards/:id/close',
    input: closeCardInput,
    output: cardSchema,
  }),
  limits: defineContract({
    method: 'GET',
    path: '/api/cards/:id/limits',
    input: z.void(),
    output: cardLimitsOutput,
  }),
  panToken: defineContract({
    method: 'POST',
    path: '/api/cards/:id/pan-token',
    input: z.void(),
    output: panTokenOutput,
  }),
  reconcile: defineContract({
    method: 'POST',
    path: '/api/cards/:id/reconcile',
    input: z.void(),
    output: cardSchema,
  }),
} as const

export type CardContracts = typeof cardContracts
