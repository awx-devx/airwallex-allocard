import { Schema, model, models, type HydratedDocument, type Model } from 'mongoose'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import { baseOptions, tenantScoped } from '@/server/models/base'

export type WorkstreamFields = {
  id: string
  name: string
}

export type CardStructureFields = {
  shared: boolean
  perMember: boolean
  vendor: boolean
  oneTime: boolean
}

/** Denormalised ledger projection — Date in Mongo; ISO on the wire via toDomain. */
export type BudgetSnapshotFields = {
  approved: number
  committed: number
  actual: number
  remaining: number
  utilisationPct: number
  overCommitted: boolean
  updatedAt: Date
}

/**
 * Storage shape. Dates are `Date` in Mongo; `toJSON` / `toDomain` emit ISO strings
 * matching the public `Project` contract.
 */
export type ProjectFields = {
  orgId: string
  name: string
  code: string
  description: string
  status: ProjectStatus
  ownerId: string | null
  costCentre: string | null
  startDate: Date | null
  endDate: Date | null
  workstreams: WorkstreamFields[]
  cardStructure: CardStructureFields
  /** Null until the first budget ledger write. */
  budgetSnapshot: BudgetSnapshotFields | null
  approvedAt: Date | null
  launchedAt: Date | null
  closedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const workstreamSchema = new Schema<WorkstreamFields>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
  },
  { _id: false },
)

const cardStructureSchema = new Schema<CardStructureFields>(
  {
    shared: { type: Boolean, required: true, default: false },
    perMember: { type: Boolean, required: true, default: false },
    vendor: { type: Boolean, required: true, default: false },
    oneTime: { type: Boolean, required: true, default: false },
  },
  { _id: false },
)

const budgetSnapshotSchema = new Schema<BudgetSnapshotFields>(
  {
    approved: { type: Number, required: true },
    committed: { type: Number, required: true },
    actual: { type: Number, required: true },
    remaining: { type: Number, required: true },
    utilisationPct: { type: Number, required: true },
    overCommitted: { type: Boolean, required: true },
    updatedAt: { type: Date, required: true },
  },
  { _id: false },
)

const defaultCardStructure = (): CardStructureFields => ({
  shared: false,
  perMember: false,
  vendor: false,
  oneTime: false,
})

const projectSchema = new Schema<ProjectFields, Model<ProjectFields>>(
  {
    orgId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    code: { type: String, required: true, trim: true, maxlength: 64 },
    description: { type: String, default: '', maxlength: 2000 },
    status: {
      type: String,
      enum: Object.values(ProjectStatus),
      required: true,
      default: ProjectStatus.DRAFT,
    },
    ownerId: { type: String, default: null },
    costCentre: { type: String, default: null },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    workstreams: { type: [workstreamSchema], required: true, default: [] },
    cardStructure: {
      type: cardStructureSchema,
      required: true,
      default: defaultCardStructure,
    },
    budgetSnapshot: { type: budgetSnapshotSchema, default: null },
    approvedAt: { type: Date, default: null },
    launchedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
  },
  {
    ...baseOptions,
    collection: 'projects',
  },
)

projectSchema.plugin(tenantScoped)
projectSchema.index({ orgId: 1, code: 1 }, { unique: true })
projectSchema.index({ orgId: 1, status: 1, updatedAt: -1 })
projectSchema.index({ orgId: 1, ownerId: 1 })

export type ProjectDoc = HydratedDocument<ProjectFields>
export const ProjectModel = (models.Project ??
  model<ProjectFields>('Project', projectSchema)) as Model<ProjectFields>
