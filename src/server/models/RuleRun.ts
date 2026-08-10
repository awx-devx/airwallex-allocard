import { Schema, model, models, type HydratedDocument, type Model } from 'mongoose'
import { ActorType } from '@/shared/enums/audit'
import { AttributeSubjectType } from '@/shared/enums/attributeSubjectType'
import { RuleRunStatus } from '@/shared/enums/ruleRunStatus'
import { baseOptionsOmitting, tenantScoped } from '@/server/models/base'

export type RuleRunInputFields = {
  key: string
  subjectType: AttributeSubjectType
  subjectId: string
  value: unknown
  observedAt: Date
  ttlSec: number | null
  stale: boolean
}

/**
 * Immutable evaluation record. `desiredState` / `diff` / `actions` / `conflicts`
 * are Mixed snapshots already carrying ISO strings — their shapes live in
 * `src/shared/schemas/ruleRun.ts`.
 *
 * `cardIds` and `projectId` are storage-only denormalisations so the automation
 * history can filter by card or project; both are stripped from `toJSON` and are
 * not part of the public `RuleRun` contract.
 */
export type RuleRunFields = {
  orgId: string
  ruleId: string
  triggeredBy: string
  triggeredByType: ActorType
  triggerEvent: string
  inputs: RuleRunInputFields[]
  matched: boolean
  desiredState: unknown
  diff: unknown
  actions: unknown[]
  conflicts: unknown[]
  status: RuleRunStatus
  skipReason: string | null
  failureReason: string | null
  durationMs: number
  startedAt: Date
  finishedAt: Date
  cardIds: string[]
  projectId: string | null
  createdAt: Date
  updatedAt: Date
}

const ruleRunInputSubSchema = new Schema<RuleRunInputFields>(
  {
    key: { type: String, required: true },
    subjectType: {
      type: String,
      enum: Object.values(AttributeSubjectType),
      required: true,
    },
    subjectId: { type: String, required: true },
    value: { type: Schema.Types.Mixed, default: null },
    observedAt: { type: Date, required: true },
    ttlSec: { type: Number, default: null },
    stale: { type: Boolean, required: true, default: false },
  },
  { _id: false },
)

const ruleRunSchema = new Schema<RuleRunFields, Model<RuleRunFields>>(
  {
    orgId: { type: String, required: true, index: true },
    ruleId: { type: String, required: true },
    triggeredBy: { type: String, required: true },
    triggeredByType: {
      type: String,
      enum: Object.values(ActorType),
      required: true,
    },
    triggerEvent: { type: String, required: true },
    inputs: { type: [ruleRunInputSubSchema], required: true, default: [] },
    matched: { type: Boolean, required: true },
    desiredState: { type: Schema.Types.Mixed, required: true },
    diff: { type: Schema.Types.Mixed, required: true },
    actions: { type: [Schema.Types.Mixed], required: true, default: [] },
    conflicts: { type: [Schema.Types.Mixed], required: true, default: [] },
    status: {
      type: String,
      enum: Object.values(RuleRunStatus),
      required: true,
    },
    skipReason: { type: String, default: null },
    failureReason: { type: String, default: null },
    durationMs: { type: Number, required: true },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date, required: true },
    cardIds: { type: [String], required: true, default: [] },
    projectId: { type: String, default: null },
  },
  {
    ...baseOptionsOmitting(['cardIds', 'projectId']),
    collection: 'ruleRuns',
  },
)

ruleRunSchema.plugin(tenantScoped)
ruleRunSchema.index({ orgId: 1, ruleId: 1, startedAt: -1 })
ruleRunSchema.index({ orgId: 1, startedAt: -1 })
ruleRunSchema.index({ orgId: 1, status: 1, startedAt: -1 })
ruleRunSchema.index({ orgId: 1, cardIds: 1, startedAt: -1 })
ruleRunSchema.index({ orgId: 1, projectId: 1, startedAt: -1 })

export type RuleRunDoc = HydratedDocument<RuleRunFields>
export const RuleRunModel = (models.RuleRun ??
  model<RuleRunFields>('RuleRun', ruleRunSchema)) as Model<RuleRunFields>
