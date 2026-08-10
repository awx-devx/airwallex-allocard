import { z } from 'zod'
import {
  cardLimitEntrySchema,
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

export type Card = z.infer<typeof cardSchema>
export type CreateCardInput = z.infer<typeof createCardInput>
export type UpdateCardInput = z.infer<typeof updateCardInput>
export type CloseCardInput = z.infer<typeof closeCardInput>
export type PanTokenOutput = z.infer<typeof panTokenOutput>
export type CardLimitEntry = z.infer<typeof cardLimitEntrySchema>
export type CardLimitsOutput = z.infer<typeof cardLimitsOutput>
export type ListCardsQuery = z.infer<typeof listCardsQuery>
export type ListProjectCardsQuery = z.infer<typeof listProjectCardsQuery>
export type CardList = z.infer<typeof cardListSchema>
