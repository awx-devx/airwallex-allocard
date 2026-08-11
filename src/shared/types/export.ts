import { z } from 'zod'
import { exportInput } from '@/shared/schemas/export'

export type ExportInput = z.infer<typeof exportInput>
