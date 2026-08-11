/**
 * Project closure progress — one document per project, tenant-owned.
 * Every method takes `OrgContext` first and filters on `ctx.orgId`.
 */
import { ProjectClosureModel, defaultClosureSteps } from '@/server/models/ProjectClosure'
import { toDomain } from '@/server/models/base'
import type { OrgContext } from '@/server/http/types'
import { ClosureStep } from '@/shared/enums/closureStep'
import type { ClosureStepStatus } from '@/shared/enums/closureStepStatus'
import type { FinalReport } from '@/shared/types/report'
import type { ClosureStepState, ProjectClosure } from '@/shared/types/closure'

export type UpsertStartClosureInput = {
  projectId: string
  startedBy: string
  /** Defaults to PREFLIGHT when omitted. */
  currentStep?: ClosureStep
  /** Defaults to all seven steps PENDING when omitted. */
  steps?: Array<{
    step: ClosureStep
    status: ClosureStepStatus
    startedAt?: Date | null
    completedAt?: Date | null
    detail?: string | null
  }>
  startedAt?: Date
}

export type UpdateClosureStepPatch = {
  status: ClosureStepStatus
  startedAt?: Date | null
  completedAt?: Date | null
  detail?: string | null
}

export type MarkCompleteClosureInput = {
  /**
   * When provided, marks the closure finished.
   * Omit to only store/update `finalReportSnapshot` (e.g. FINAL_REPORT before ARCHIVE).
   */
  completedAt?: Date
  finalReportSnapshot: FinalReport
}

function nullableIso(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null
  }
  return String(value)
}

function toStepState(raw: Record<string, unknown>): ClosureStepState {
  return {
    step: raw.step as ClosureStep,
    status: raw.status as ClosureStepStatus,
    startedAt: nullableIso(raw.startedAt),
    completedAt: nullableIso(raw.completedAt),
    detail: raw.detail == null ? null : String(raw.detail),
  }
}

function toProjectClosure(doc: Parameters<typeof toDomain>[0]): ProjectClosure {
  const raw = toDomain<Record<string, unknown>>(doc)
  const steps = Array.isArray(raw.steps)
    ? raw.steps.map((entry) => toStepState(entry as Record<string, unknown>))
    : []
  return {
    id: String(raw.id),
    orgId: String(raw.orgId),
    projectId: String(raw.projectId),
    currentStep: raw.currentStep as ClosureStep,
    steps,
    startedBy: String(raw.startedBy),
    startedAt: String(raw.startedAt),
    completedAt: nullableIso(raw.completedAt),
    finalReportSnapshot: (raw.finalReportSnapshot as FinalReport | null) ?? null,
    createdAt: String(raw.createdAt),
    updatedAt: String(raw.updatedAt),
  }
}

/**
 * Create closure progress on first start; resume returns the existing doc unchanged.
 */
export async function upsertStart(
  ctx: OrgContext,
  input: UpsertStartClosureInput,
): Promise<ProjectClosure> {
  const startedAt = input.startedAt ?? new Date()
  const currentStep = input.currentStep ?? ClosureStep.PREFLIGHT
  const steps =
    input.steps?.map((s) => ({
      step: s.step,
      status: s.status,
      startedAt: s.startedAt === undefined ? null : s.startedAt,
      completedAt: s.completedAt === undefined ? null : s.completedAt,
      detail: s.detail === undefined ? null : s.detail,
    })) ?? defaultClosureSteps()

  const doc = await ProjectClosureModel.findOneAndUpdate(
    { orgId: ctx.orgId, projectId: input.projectId },
    {
      $setOnInsert: {
        orgId: ctx.orgId,
        projectId: input.projectId,
        currentStep,
        steps,
        startedBy: input.startedBy,
        startedAt,
        completedAt: null,
        finalReportSnapshot: null,
      },
    },
    { upsert: true, returnDocument: 'after' },
  )
    .lean()
    .exec()

  if (!doc) {
    throw new Error('upsertStart returned null after upsert')
  }
  return toProjectClosure(doc)
}

export async function findByProject(
  ctx: OrgContext,
  projectId: string,
): Promise<ProjectClosure | null> {
  const doc = await ProjectClosureModel.findOne({ orgId: ctx.orgId, projectId }).lean().exec()
  return doc ? toProjectClosure(doc) : null
}

/**
 * Patch one step by `step` key. Optionally advance `currentStep`.
 * Cross-org / missing → null.
 */
export async function updateStep(
  ctx: OrgContext,
  projectId: string,
  step: ClosureStep,
  patch: UpdateClosureStepPatch,
  nextCurrentStep?: ClosureStep,
): Promise<ProjectClosure | null> {
  const $set: Record<string, unknown> = {
    'steps.$.status': patch.status,
  }
  if (patch.startedAt !== undefined) $set['steps.$.startedAt'] = patch.startedAt
  if (patch.completedAt !== undefined) $set['steps.$.completedAt'] = patch.completedAt
  if (patch.detail !== undefined) $set['steps.$.detail'] = patch.detail
  if (nextCurrentStep !== undefined) $set.currentStep = nextCurrentStep

  const doc = await ProjectClosureModel.findOneAndUpdate(
    { orgId: ctx.orgId, projectId, 'steps.step': step },
    { $set },
    { returnDocument: 'after' },
  )
    .lean()
    .exec()
  return doc ? toProjectClosure(doc) : null
}

/**
 * Store the final report snapshot. Pass `completedAt` to mark the closure finished.
 * Cross-org / missing → null.
 */
export async function markComplete(
  ctx: OrgContext,
  projectId: string,
  input: MarkCompleteClosureInput,
): Promise<ProjectClosure | null> {
  const $set: Record<string, unknown> = {
    finalReportSnapshot: input.finalReportSnapshot,
  }
  if (input.completedAt !== undefined) {
    $set.completedAt = input.completedAt
  }

  const doc = await ProjectClosureModel.findOneAndUpdate(
    { orgId: ctx.orgId, projectId },
    { $set },
    { returnDocument: 'after' },
  )
    .lean()
    .exec()
  return doc ? toProjectClosure(doc) : null
}
