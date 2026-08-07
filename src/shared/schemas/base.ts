import { z } from 'zod'

/** Money in integer minor units with an ISO 4217 currency code. */
export const moneySchema = z.object({
  amount: z.number().int(),
  currency: z.string().length(3),
})

/** ISO 8601 datetime on the wire. */
export const isoDateSchema = z.string().datetime()

/** Domain id — always a string; never an ObjectId. */
export const idSchema = z.string().min(1)

/** Cursor-based list query. */
export const paginationSchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(100).default(20),
})

/** Cursor-based list response envelope. */
export function cursorPageSchema<T extends z.ZodType>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    nextCursor: z.string().nullable(),
  })
}

export type Money = z.infer<typeof moneySchema>
export type IsoDate = z.infer<typeof isoDateSchema>
export type Id = z.infer<typeof idSchema>
export type Pagination = z.infer<typeof paginationSchema>
export type CursorPage<T> = {
  items: T[]
  nextCursor: string | null
}
