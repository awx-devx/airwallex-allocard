import type { z } from 'zod'
import type { errorEnvelopeSchema } from '@/shared/schemas/error'

export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>
