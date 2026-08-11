import { z } from 'zod'
import {
  closureBlockingItemSchema,
  closurePreflightSchema,
  closureStatusSchema,
  closureStepStateSchema,
  completeClosureInput,
  projectClosureSchema,
  startClosureInput,
} from '@/shared/schemas/closure'

export type ClosureBlockingItem = z.infer<typeof closureBlockingItemSchema>
export type ClosurePreflight = z.infer<typeof closurePreflightSchema>
export type ClosureStepState = z.infer<typeof closureStepStateSchema>
export type ClosureStatus = z.infer<typeof closureStatusSchema>
export type ProjectClosure = z.infer<typeof projectClosureSchema>
export type StartClosureInput = z.infer<typeof startClosureInput>
export type CompleteClosureInput = z.infer<typeof completeClosureInput>
