import { Schema, model, models, type HydratedDocument, type Model } from 'mongoose'
import { ActorType } from '@/shared/enums/audit'
import { baseOptions, tenantScoped } from '@/server/models/base'

/** Domain shape after `toDomain` — dates are ISO strings. */
export type AuditLog = {
  id: string
  orgId: string
  projectId?: string
  actorType: ActorType
  actorId: string
  action: string
  subjectType: string
  subjectId: string
  before?: unknown
  after?: unknown
  metadata: Record<string, unknown>
  at: string
}

type AuditLogFields = {
  orgId: string
  projectId?: string
  actorType: ActorType
  actorId: string
  action: string
  subjectType: string
  subjectId: string
  before?: unknown
  after?: unknown
  metadata: Record<string, unknown>
  at: Date
}

const auditLogSchema = new Schema<AuditLogFields, Model<AuditLogFields>>(
  {
    orgId: { type: String, required: true, index: true },
    projectId: { type: String },
    actorType: {
      type: String,
      enum: Object.values(ActorType),
      required: true,
    },
    actorId: { type: String, required: true },
    action: { type: String, required: true },
    subjectType: { type: String, required: true },
    subjectId: { type: String, required: true },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    metadata: { type: Schema.Types.Mixed, required: true, default: {} },
    at: { type: Date, required: true },
  },
  {
    ...baseOptions,
    timestamps: false,
    collection: 'auditLogs',
  },
)

auditLogSchema.plugin(tenantScoped)
auditLogSchema.index({ orgId: 1, at: -1 })
auditLogSchema.index({ orgId: 1, subjectType: 1, subjectId: 1 })

export type AuditLogDoc = HydratedDocument<AuditLogFields>
export const AuditLogModel = (models.AuditLog ??
  model<AuditLogFields>('AuditLog', auditLogSchema)) as Model<AuditLogFields>
