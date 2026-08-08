import { Schema, model, models, type HydratedDocument, type Model } from 'mongoose'
import { Permission } from '@/shared/enums/permissions'
import { accessScopeSubSchema, type AccessScopeFields } from '@/server/models/accessScope'
import { baseOptions, tenantScoped } from '@/server/models/base'

/**
 * Storage shape. `scope` dates and `addedAt` / `removedAt` are `Date` in Mongo;
 * `toJSON` / `toDomain` emit ISO strings matching the public `ProjectMember` contract.
 */
export type ProjectMemberFields = {
  orgId: string
  projectId: string
  userId: string
  roleId: string
  scope: AccessScopeFields
  /** Materialised cache — recomputed wholesale on role/scope/role-def changes. */
  effectivePermissions: Permission[]
  addedBy: string
  addedAt: Date
  removedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const projectMemberSchema = new Schema<ProjectMemberFields, Model<ProjectMemberFields>>(
  {
    orgId: { type: String, required: true, index: true },
    projectId: { type: String, required: true },
    userId: { type: String, required: true },
    roleId: { type: String, required: true },
    scope: { type: accessScopeSubSchema, required: true },
    effectivePermissions: {
      type: [
        {
          type: String,
          enum: Object.values(Permission),
        },
      ],
      required: true,
      default: [],
    },
    addedBy: { type: String, required: true },
    addedAt: { type: Date, required: true },
    removedAt: { type: Date, default: null },
  },
  {
    ...baseOptions,
    collection: 'projectMembers',
  },
)

projectMemberSchema.plugin(tenantScoped)
projectMemberSchema.index(
  { orgId: 1, projectId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { removedAt: null } },
)
projectMemberSchema.index({ orgId: 1, projectId: 1, removedAt: 1 })
projectMemberSchema.index({ orgId: 1, roleId: 1 })

export type ProjectMemberDoc = HydratedDocument<ProjectMemberFields>
export const ProjectMemberModel = (models.ProjectMember ??
  model<ProjectMemberFields>('ProjectMember', projectMemberSchema)) as Model<ProjectMemberFields>
