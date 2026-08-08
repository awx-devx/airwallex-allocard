/**
 * Project members are tenant-owned. Every method takes `OrgContext` first and
 * filters on `ctx.orgId`. Active uniqueness is `(orgId, projectId, userId)`
 * where `removedAt` is null — soft-remove then re-add is allowed.
 */
import { isValidObjectId } from 'mongoose'
import { ProjectMemberModel } from '@/server/models/ProjectMember'
import { toDomain } from '@/server/models/base'
import type { OrgContext } from '@/server/http/types'
import { toAccessScope, toAccessScopeFields } from '@/server/repositories/accessScope'
import type { Permission } from '@/shared/enums/permissions'
import type { AccessScope } from '@/shared/types/accessScope'
import type { ProjectMember } from '@/shared/types/projectMember'

export type AddProjectMemberInput = {
  projectId: string
  userId: string
  roleId: string
  scope: AccessScope
  effectivePermissions: Permission[]
  addedBy: string
  addedAt?: Date
}

export type UpdateProjectMemberFields = {
  roleId?: string
  scope?: AccessScope
  /** When role/scope change, pass the fully recomputed set — never patch incrementally. */
  effectivePermissions?: Permission[]
}

function toProjectMember(doc: Parameters<typeof toDomain>[0]): ProjectMember {
  const raw = toDomain<Record<string, unknown>>(doc)
  const member: ProjectMember = {
    id: String(raw.id),
    orgId: String(raw.orgId),
    projectId: String(raw.projectId),
    userId: String(raw.userId),
    roleId: String(raw.roleId),
    scope: toAccessScope(raw.scope),
    effectivePermissions: (raw.effectivePermissions as Permission[]) ?? [],
    addedBy: String(raw.addedBy),
    addedAt: String(raw.addedAt),
  }
  if (raw.removedAt != null) {
    member.removedAt = String(raw.removedAt)
  } else {
    member.removedAt = null
  }
  return member
}

export async function addProjectMember(
  ctx: OrgContext,
  input: AddProjectMemberInput,
): Promise<ProjectMember> {
  const doc = await ProjectMemberModel.create({
    orgId: ctx.orgId,
    projectId: input.projectId,
    userId: input.userId,
    roleId: input.roleId,
    scope: toAccessScopeFields(input.scope),
    effectivePermissions: input.effectivePermissions,
    addedBy: input.addedBy,
    addedAt: input.addedAt ?? new Date(),
    removedAt: null,
  })
  return toProjectMember(doc)
}

export async function findProjectMemberById(
  ctx: OrgContext,
  memberId: string,
): Promise<ProjectMember | null> {
  if (!isValidObjectId(memberId)) {
    return null
  }
  const doc = await ProjectMemberModel.findOne({ _id: memberId, orgId: ctx.orgId }).lean().exec()
  return doc ? toProjectMember(doc) : null
}

/** Active membership for a user on a project (`removedAt` null). */
export async function findActiveProjectMember(
  ctx: OrgContext,
  projectId: string,
  userId: string,
): Promise<ProjectMember | null> {
  const doc = await ProjectMemberModel.findOne({
    orgId: ctx.orgId,
    projectId,
    userId,
    removedAt: null,
  })
    .lean()
    .exec()
  return doc ? toProjectMember(doc) : null
}

/** Active members on a project. */
export async function listActiveProjectMembers(
  ctx: OrgContext,
  projectId: string,
): Promise<ProjectMember[]> {
  const docs = await ProjectMemberModel.find({
    orgId: ctx.orgId,
    projectId,
    removedAt: null,
  })
    .sort({ addedAt: 1, _id: 1 })
    .lean()
    .exec()
  return docs.map((doc) => toProjectMember(doc))
}

/** Active memberships for a user across projects in the org. */
export async function listActiveProjectMembersForUser(
  ctx: OrgContext,
  userId: string,
): Promise<ProjectMember[]> {
  const docs = await ProjectMemberModel.find({
    orgId: ctx.orgId,
    userId,
    removedAt: null,
  })
    .sort({ addedAt: 1, _id: 1 })
    .lean()
    .exec()
  return docs.map((doc) => toProjectMember(doc))
}

/** Active members holding a role — used when a role definition changes. */
export async function listActiveProjectMembersByRole(
  ctx: OrgContext,
  roleId: string,
): Promise<ProjectMember[]> {
  const docs = await ProjectMemberModel.find({
    orgId: ctx.orgId,
    roleId,
    removedAt: null,
  })
    .lean()
    .exec()
  return docs.map((doc) => toProjectMember(doc))
}

export async function countActiveProjectMembersByRole(
  ctx: OrgContext,
  roleId: string,
): Promise<number> {
  return ProjectMemberModel.countDocuments({
    orgId: ctx.orgId,
    roleId,
    removedAt: null,
  }).exec()
}

export async function updateProjectMember(
  ctx: OrgContext,
  memberId: string,
  patch: UpdateProjectMemberFields,
): Promise<ProjectMember | null> {
  if (!isValidObjectId(memberId)) {
    return null
  }

  const $set: Record<string, unknown> = {}
  if (patch.roleId !== undefined) $set.roleId = patch.roleId
  if (patch.scope !== undefined) $set.scope = toAccessScopeFields(patch.scope)
  if (patch.effectivePermissions !== undefined) {
    $set.effectivePermissions = patch.effectivePermissions
  }

  if (Object.keys($set).length === 0) {
    return findProjectMemberById(ctx, memberId)
  }

  const doc = await ProjectMemberModel.findOneAndUpdate(
    { _id: memberId, orgId: ctx.orgId, removedAt: null },
    { $set },
    { returnDocument: 'after' },
  )
    .lean()
    .exec()
  return doc ? toProjectMember(doc) : null
}

/**
 * Rewrite `effectivePermissions` wholesale for one active member.
 * Never patch the array incrementally.
 */
export async function rewriteEffectivePermissions(
  ctx: OrgContext,
  memberId: string,
  effectivePermissions: Permission[],
): Promise<ProjectMember | null> {
  return updateProjectMember(ctx, memberId, { effectivePermissions })
}

/**
 * Rewrite `effectivePermissions` wholesale for every listed active member.
 * Used after a role-definition change; each entry must be a full recomputed set.
 */
export async function rewriteEffectivePermissionsForMembers(
  ctx: OrgContext,
  updates: ReadonlyArray<{ memberId: string; effectivePermissions: Permission[] }>,
): Promise<number> {
  let written = 0
  for (const update of updates) {
    if (!isValidObjectId(update.memberId)) {
      continue
    }
    const doc = await ProjectMemberModel.findOneAndUpdate(
      { _id: update.memberId, orgId: ctx.orgId, removedAt: null },
      { $set: { effectivePermissions: update.effectivePermissions } },
      { returnDocument: 'after' },
    )
      .lean()
      .exec()
    if (doc) {
      written += 1
    }
  }
  return written
}

/** Soft-remove: sets `removedAt`. Returns null if missing or already removed. */
export async function softRemoveProjectMember(
  ctx: OrgContext,
  projectId: string,
  userId: string,
  removedAt: Date = new Date(),
): Promise<ProjectMember | null> {
  const doc = await ProjectMemberModel.findOneAndUpdate(
    { orgId: ctx.orgId, projectId, userId, removedAt: null },
    { $set: { removedAt } },
    { returnDocument: 'after' },
  )
    .lean()
    .exec()
  return doc ? toProjectMember(doc) : null
}
