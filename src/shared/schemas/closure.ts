import { z } from 'zod'
import { ClosureBlockingKind } from '@/shared/enums/closureBlockingKind'
import { ClosureStep } from '@/shared/enums/closureStep'
import { ClosureStepStatus } from '@/shared/enums/closureStepStatus'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import { idSchema, isoDateSchema } from '@/shared/schemas/base'

export const closureBlockingItemSchema = z.object({
  kind: z.enum(ClosureBlockingKind),
  subjectType: z.string().min(1),
  subjectId: idSchema,
  summary: z.string().min(1),
})

/**
 * Preflight is fully blocking: `canStart === (blockers.length === 0)`.
 */
export const closurePreflightSchema = z.object({
  projectId: idSchema,
  canStart: z.boolean(),
  blockers: z.array(closureBlockingItemSchema),
})

export const closureStepStateSchema = z.object({
  step: z.enum(ClosureStep),
  status: z.enum(ClosureStepStatus),
  startedAt: isoDateSchema.nullable(),
  completedAt: isoDateSchema.nullable(),
  detail: z.string().nullable(),
})

export const closureStatusSchema = z.object({
  projectId: idSchema,
  projectStatus: z.enum(ProjectStatus),
  currentStep: z.enum(ClosureStep),
  steps: z.array(closureStepStateSchema),
  resumable: z.boolean(),
})

/** Empty body — enter CLOSING only via this path (not generic /transition). */
export const startClosureInput = z.void()

/** Both confirm literals required; irreversible card close + archive. */
export const completeClosureInput = z.object({
  confirmCloseCards: z.literal(true),
  confirmArchive: z.literal(true),
})
