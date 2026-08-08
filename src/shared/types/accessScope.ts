import { z } from 'zod'
import { accessScopeSchema } from '@/shared/schemas/accessScope'

export type AccessScope = z.infer<typeof accessScopeSchema>
