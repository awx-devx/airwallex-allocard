import { z } from 'zod'
import {
  cardholderListSchema,
  cardholderSchema,
  createCardholderInput,
  listCardholdersQuery,
} from '@/shared/schemas/cardholder'

export type Cardholder = z.infer<typeof cardholderSchema>
export type CreateCardholderInput = z.infer<typeof createCardholderInput>
export type ListCardholdersQuery = z.infer<typeof listCardholdersQuery>
export type CardholderList = z.infer<typeof cardholderListSchema>
