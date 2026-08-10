import { Schema, model, models, type HydratedDocument, type Model } from 'mongoose'
import { RuleScopeLevel } from '@/shared/enums/ruleScopeLevel'
import { baseOptions, tenantScoped } from '@/server/models/base'

export type RuleScopeFields = {
  level: RuleScopeLevel
  projectId?: string
}

export type RuleTriggerFields = {
  events?: string[]
  schedule?: string
  debounceSec?: number
}

/**
 * Rule DSL document. `when` / `then` / `else` are stored as Mixed — the shape is
 * owned by `src/shared/schemas/rule.ts` and validated there, not by Mongoose.
 * `version` is bumped by the repository on every PATCH.
 */
export type RuleFields = {
  orgId: string
  scope: RuleScopeFields
  name: string
  description: string | null
  enabled: boolean
  priority: number
  trigger: RuleTriggerFields
  when: unknown
  then: unknown[]
  else?: unknown[]
  createdBy: string
  version: number
  createdAt: Date
  updatedAt: Date
}

const ruleScopeSubSchema = new Schema<RuleScopeFields>(
  {
    level: {
      type: String,
      enum: Object.values(RuleScopeLevel),
      required: true,
    },
    projectId: { type: String },
  },
  { _id: false },
)

const ruleTriggerSubSchema = new Schema<RuleTriggerFields>(
  {
    events: { type: [String], default: undefined },
    schedule: { type: String },
    debounceSec: { type: Number },
  },
  { _id: false },
)

const ruleSchema = new Schema<RuleFields, Model<RuleFields>>(
  {
    orgId: { type: String, required: true, index: true },
    scope: { type: ruleScopeSubSchema, required: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: null },
    enabled: { type: Boolean, required: true, default: false },
    priority: { type: Number, required: true, default: 100 },
    trigger: { type: ruleTriggerSubSchema, required: true },
    when: { type: Schema.Types.Mixed, required: true },
    then: { type: [Schema.Types.Mixed], required: true },
    else: { type: [Schema.Types.Mixed], default: undefined },
    createdBy: { type: String, required: true },
    version: { type: Number, required: true, default: 1 },
  },
  {
    ...baseOptions,
    collection: 'rules',
  },
)

ruleSchema.plugin(tenantScoped)
ruleSchema.index({ orgId: 1, enabled: 1, priority: 1 })
ruleSchema.index({ orgId: 1, 'scope.projectId': 1, enabled: 1 })

export type RuleDoc = HydratedDocument<RuleFields>
export const RuleModel = (models.Rule ?? model<RuleFields>('Rule', ruleSchema)) as Model<RuleFields>
