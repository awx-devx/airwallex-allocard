import { z } from 'zod'
import { defineContract } from '@/shared/contracts/types'
import { meResponseSchema, onboardingStatusSchema } from '@/shared/schemas/auth'
import { signUpInput, updateMeInput, userSchema } from '@/shared/schemas/user'

/**
 * Auth & session contracts.
 * Auth.js catch-all (`/api/auth/[...nextauth]`) is owned by Auth.js — no entry here.
 */
export const authContracts = {
  signUp: defineContract({
    method: 'POST',
    path: '/api/auth/sign-up',
    input: signUpInput,
    output: userSchema,
  }),
  me: defineContract({
    method: 'GET',
    path: '/api/me',
    input: z.void(),
    output: meResponseSchema,
  }),
  updateMe: defineContract({
    method: 'PATCH',
    path: '/api/me',
    input: updateMeInput,
    output: meResponseSchema,
  }),
  onboardingStatus: defineContract({
    method: 'GET',
    path: '/api/onboarding/status',
    input: z.void(),
    output: onboardingStatusSchema,
  }),
} as const

export type AuthContracts = typeof authContracts
