import { z } from 'zod'
import { meResponseSchema, onboardingStatusSchema } from '@/shared/schemas/auth'

export type MeResponse = z.infer<typeof meResponseSchema>
export type OnboardingStatus = z.infer<typeof onboardingStatusSchema>
