import { Schema, model, models, type HydratedDocument, type Model } from 'mongoose'
import { Permission } from '@/shared/enums/permissions'
import { accessScopeSubSchema, type AccessScopeFields } from '@/server/models/accessScope'
import { baseOptions, tenantScoped } from '@/server/models/base'

/**
 * Storage shape. Dates inside `defaultScope` are `Date` in Mongo;
 * `toJSON` / `toDomain` emit ISO strings matching the public `Role` contract.
 */
export type RoleFields = {
  orgId: string
  key: string
  name: string
  isTemplate: boolean
  permissions: Permission[]
  defaultScope?: AccessScopeFields
  createdAt: Date
  updatedAt: Date
}

const roleSchema = new Schema<RoleFields, Model<RoleFields>>(
  {
    orgId: { type: String, required: true, index: true },
    key: { type: String, required: true, trim: true, maxlength: 64 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    isTemplate: { type: Boolean, required: true, default: false },
    permissions: {
      type: [
        {
          type: String,
          enum: Object.values(Permission),
        },
      ],
      required: true,
      default: [],
    },
    defaultScope: { type: accessScopeSubSchema, required: false },
  },
  {
    ...baseOptions,
    collection: 'roles',
  },
)

roleSchema.plugin(tenantScoped)
roleSchema.index({ orgId: 1, key: 1 }, { unique: true })

export type RoleDoc = HydratedDocument<RoleFields>
export const RoleModel = (models.Role ?? model<RoleFields>('Role', roleSchema)) as Model<RoleFields>
