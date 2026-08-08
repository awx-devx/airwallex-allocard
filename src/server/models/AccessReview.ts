import { Schema, model, models, type HydratedDocument, type Model } from 'mongoose'
import { AccessReviewResolution, AccessReviewStatus } from '@/shared/enums/accessReviewStatus'
import { baseOptions, tenantScoped } from '@/server/models/base'

/**
 * Storage shape. Dates are `Date` in Mongo; `toJSON` / `toDomain` emit ISO strings.
 */
export type AccessReviewFields = {
  orgId: string
  projectId: string
  status: AccessReviewStatus
  reason: string
  subjectType: 'projectMember'
  subjectId: string
  userId: string
  flaggedAt: Date
  flaggedBy: string | null
  resolvedAt: Date | null
  resolvedBy: string | null
  resolution: AccessReviewResolution | null
  createdAt: Date
  updatedAt: Date
}

const accessReviewSchema = new Schema<AccessReviewFields, Model<AccessReviewFields>>(
  {
    orgId: { type: String, required: true, index: true },
    projectId: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(AccessReviewStatus),
      required: true,
      default: AccessReviewStatus.OPEN,
    },
    reason: { type: String, required: true, maxlength: 500 },
    subjectType: {
      type: String,
      enum: ['projectMember'],
      required: true,
      default: 'projectMember',
    },
    subjectId: { type: String, required: true },
    userId: { type: String, required: true },
    flaggedAt: { type: Date, required: true },
    flaggedBy: { type: String, default: null },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: String, default: null },
    resolution: {
      type: String,
      enum: Object.values(AccessReviewResolution),
      default: null,
      required: false,
    },
  },
  {
    ...baseOptions,
    collection: 'accessReviews',
  },
)

accessReviewSchema.plugin(tenantScoped)
accessReviewSchema.index({ orgId: 1, status: 1, flaggedAt: -1 })
accessReviewSchema.index({ orgId: 1, projectId: 1, status: 1 })

export type AccessReviewDoc = HydratedDocument<AccessReviewFields>
export const AccessReviewModel = (models.AccessReview ??
  model<AccessReviewFields>('AccessReview', accessReviewSchema)) as Model<AccessReviewFields>
