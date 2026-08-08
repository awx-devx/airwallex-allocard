import { Schema } from 'mongoose'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'

/**
 * Storage shape for embedded AccessScope.
 * Dates are `Date` in Mongo; `toJSON` / `toDomain` emit ISO strings.
 */
export type AccessScopeFields = {
  level: AccessScopeLevel
  workstreamIds?: string[]
  categoryIds?: string[]
  cardIds?: string[]
  memberIds?: string[]
  validFrom?: Date
  validTo?: Date
}

export const accessScopeSubSchema = new Schema<AccessScopeFields>(
  {
    level: {
      type: String,
      enum: Object.values(AccessScopeLevel),
      required: true,
    },
    workstreamIds: { type: [String], required: false },
    categoryIds: { type: [String], required: false },
    cardIds: { type: [String], required: false },
    memberIds: { type: [String], required: false },
    validFrom: { type: Date, required: false },
    validTo: { type: Date, required: false },
  },
  { _id: false },
)
