import { Schema, model, models, type HydratedDocument, type Model } from 'mongoose'
import { InviteStatus } from '@/shared/enums/inviteStatus'
import { OrgRole } from '@/shared/enums/orgRole'
import { baseOptionsOmitting, tenantScoped } from '@/server/models/base'

/**
 * Storage shape. `tokenHash` is never part of the public `Invite` domain type —
 * `select: false` + transform omit keep it off the wire.
 */
export type InviteFields = {
  orgId: string
  email: string
  orgRole: OrgRole
  tokenHash: string
  expiresAt: Date
  status: InviteStatus
  invitedBy: string
  createdAt: Date
  updatedAt: Date
}

const inviteSchema = new Schema<InviteFields, Model<InviteFields>>(
  {
    orgId: { type: String, required: true, index: true },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    orgRole: {
      type: String,
      enum: Object.values(OrgRole),
      required: true,
    },
    tokenHash: { type: String, required: true, unique: true, select: false },
    expiresAt: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(InviteStatus),
      required: true,
      default: InviteStatus.PENDING,
    },
    invitedBy: { type: String, required: true },
  },
  {
    ...baseOptionsOmitting(['tokenHash']),
    collection: 'invites',
  },
)

inviteSchema.plugin(tenantScoped)
inviteSchema.index({ orgId: 1, email: 1, status: 1 })

export type InviteDoc = HydratedDocument<InviteFields>
export const InviteModel = (models.Invite ??
  model<InviteFields>('Invite', inviteSchema)) as Model<InviteFields>
