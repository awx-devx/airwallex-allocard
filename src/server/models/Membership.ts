import { Schema, model, models, type HydratedDocument, type Model } from 'mongoose'
import { MembershipStatus } from '@/shared/enums/membershipStatus'
import { OrgRole } from '@/shared/enums/orgRole'
import { baseOptions, tenantScoped } from '@/server/models/base'

export type MembershipFields = {
  orgId: string
  userId: string
  orgRole: OrgRole
  status: MembershipStatus
  joinedAt: Date
  createdAt: Date
  updatedAt: Date
}

const membershipSchema = new Schema<MembershipFields, Model<MembershipFields>>(
  {
    orgId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    orgRole: {
      type: String,
      enum: Object.values(OrgRole),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(MembershipStatus),
      required: true,
      default: MembershipStatus.ACTIVE,
    },
    joinedAt: { type: Date, required: true },
  },
  {
    ...baseOptions,
    collection: 'memberships',
  },
)

membershipSchema.plugin(tenantScoped)
membershipSchema.index({ orgId: 1, userId: 1 }, { unique: true })

export type MembershipDoc = HydratedDocument<MembershipFields>
export const MembershipModel = (models.Membership ??
  model<MembershipFields>('Membership', membershipSchema)) as Model<MembershipFields>
