/**
 * Roles are tenant-owned. Every method takes `OrgContext` first and filters
 * on `ctx.orgId`. Duplicate `key` within an org surfaces as Mongo duplicate-key
 * (11000) for the service layer to map to CONFLICT.
 */
import { isValidObjectId } from 'mongoose'
import { RoleModel } from '@/server/models/Role'
import { toDomain } from '@/server/models/base'
import type { OrgContext } from '@/server/http/types'
import { toAccessScope, toAccessScopeFields } from '@/server/repositories/accessScope'
import type { Permission } from '@/shared/enums/permissions'
import type { AccessScope } from '@/shared/types/accessScope'
import type { Role } from '@/shared/types/role'

export type CreateRoleInput = {
  key: string
  name: string
  permissions: Permission[]
  isTemplate?: boolean
  defaultScope?: AccessScope
}

export type UpdateRoleFields = {
  key?: string
  name?: string
  permissions?: Permission[]
  /** Pass `null` to clear an existing defaultScope. */
  defaultScope?: AccessScope | null
}

function toRole(doc: Parameters<typeof toDomain>[0]): Role {
  const raw = toDomain<Record<string, unknown>>(doc)
  const role: Role = {
    id: String(raw.id),
    orgId: String(raw.orgId),
    key: String(raw.key),
    name: String(raw.name),
    isTemplate: Boolean(raw.isTemplate),
    permissions: (raw.permissions as Permission[]) ?? [],
    createdAt: String(raw.createdAt),
    updatedAt: String(raw.updatedAt),
  }
  if (raw.defaultScope != null) {
    role.defaultScope = toAccessScope(raw.defaultScope)
  }
  return role
}

export async function createRole(ctx: OrgContext, input: CreateRoleInput): Promise<Role> {
  const doc = await RoleModel.create({
    orgId: ctx.orgId,
    key: input.key,
    name: input.name,
    isTemplate: input.isTemplate ?? false,
    permissions: input.permissions,
    ...(input.defaultScope !== undefined
      ? { defaultScope: toAccessScopeFields(input.defaultScope) }
      : {}),
  })
  return toRole(doc)
}

export async function findRoleById(ctx: OrgContext, roleId: string): Promise<Role | null> {
  if (!isValidObjectId(roleId)) {
    return null
  }
  const doc = await RoleModel.findOne({ _id: roleId, orgId: ctx.orgId }).lean().exec()
  return doc ? toRole(doc) : null
}

export async function findRoleByKey(ctx: OrgContext, key: string): Promise<Role | null> {
  const doc = await RoleModel.findOne({ orgId: ctx.orgId, key }).lean().exec()
  return doc ? toRole(doc) : null
}

/** Templates and custom roles for the org, templates first then name. */
export async function listRoles(ctx: OrgContext): Promise<Role[]> {
  const docs = await RoleModel.find({ orgId: ctx.orgId })
    .sort({ isTemplate: -1, name: 1, _id: 1 })
    .lean()
    .exec()
  return docs.map((doc) => toRole(doc))
}

export async function updateRole(
  ctx: OrgContext,
  roleId: string,
  patch: UpdateRoleFields,
): Promise<Role | null> {
  if (!isValidObjectId(roleId)) {
    return null
  }

  const $set: Record<string, unknown> = {}
  const $unset: Record<string, 1> = {}

  if (patch.key !== undefined) $set.key = patch.key
  if (patch.name !== undefined) $set.name = patch.name
  if (patch.permissions !== undefined) $set.permissions = patch.permissions
  if (patch.defaultScope !== undefined) {
    if (patch.defaultScope === null) {
      $unset.defaultScope = 1
    } else {
      $set.defaultScope = toAccessScopeFields(patch.defaultScope)
    }
  }

  if (Object.keys($set).length === 0 && Object.keys($unset).length === 0) {
    return findRoleById(ctx, roleId)
  }

  const update: Record<string, unknown> = {}
  if (Object.keys($set).length > 0) update.$set = $set
  if (Object.keys($unset).length > 0) update.$unset = $unset

  const doc = await RoleModel.findOneAndUpdate({ _id: roleId, orgId: ctx.orgId }, update, {
    returnDocument: 'after',
  })
    .lean()
    .exec()
  return doc ? toRole(doc) : null
}

export async function deleteRole(ctx: OrgContext, roleId: string): Promise<boolean> {
  if (!isValidObjectId(roleId)) {
    return false
  }
  const result = await RoleModel.deleteOne({ _id: roleId, orgId: ctx.orgId }).exec()
  return result.deletedCount === 1
}
