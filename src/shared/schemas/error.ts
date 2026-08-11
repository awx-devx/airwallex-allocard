import { z } from 'zod'
import { ErrorCode } from '@/shared/enums/errors'

/**
 * Wire shape of every API error body (`serializeError`).
 * Client and server both parse/emit this — one declaration.
 */
export const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.nativeEnum(ErrorCode),
    message: z.string().min(1),
    details: z.unknown().optional(),
  }),
})
