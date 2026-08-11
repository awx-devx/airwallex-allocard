import { Schema, model, models, type HydratedDocument, type Model } from 'mongoose'
import { ClosureStep } from '@/shared/enums/closureStep'
import { ClosureStepStatus } from '@/shared/enums/closureStepStatus'
import { baseOptions, tenantScoped } from '@/server/models/base'

/**
 * Storage shape. Dates are `Date` in Mongo; `toJSON` / `toDomain` emit ISO strings.
 * `finalReportSnapshot` holds the completed finalReport JSON (or null while open).
 */
export type ClosureStepStateFields = {
  step: ClosureStep
  status: ClosureStepStatus
  startedAt: Date | null
  completedAt: Date | null
  detail: string | null
}

export type ProjectClosureFields = {
  orgId: string
  projectId: string
  currentStep: ClosureStep
  steps: ClosureStepStateFields[]
  startedBy: string
  startedAt: Date
  completedAt: Date | null
  finalReportSnapshot: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date
}

/** All seven closure steps in order, each PENDING. */
export function defaultClosureSteps(): ClosureStepStateFields[] {
  return (Object.values(ClosureStep) as ClosureStep[]).map((step) => ({
    step,
    status: ClosureStepStatus.PENDING,
    startedAt: null,
    completedAt: null,
    detail: null,
  }))
}

const closureStepStateSubSchema = new Schema<ClosureStepStateFields>(
  {
    step: {
      type: String,
      enum: Object.values(ClosureStep),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(ClosureStepStatus),
      required: true,
    },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    detail: { type: String, default: null },
  },
  { _id: false },
)

const projectClosureSchema = new Schema<ProjectClosureFields, Model<ProjectClosureFields>>(
  {
    orgId: { type: String, required: true, index: true },
    projectId: { type: String, required: true },
    currentStep: {
      type: String,
      enum: Object.values(ClosureStep),
      required: true,
    },
    steps: {
      type: [closureStepStateSubSchema],
      required: true,
    },
    startedBy: { type: String, required: true },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date, default: null },
    finalReportSnapshot: { type: Schema.Types.Mixed, default: null },
  },
  {
    ...baseOptions,
    collection: 'projectClosures',
  },
)

projectClosureSchema.plugin(tenantScoped)
projectClosureSchema.index({ projectId: 1 }, { unique: true })
projectClosureSchema.index({ orgId: 1, projectId: 1 })

export type ProjectClosureDoc = HydratedDocument<ProjectClosureFields>
export const ProjectClosureModel = (models.ProjectClosure ??
  model<ProjectClosureFields>(
    'ProjectClosure',
    projectClosureSchema,
  )) as Model<ProjectClosureFields>
