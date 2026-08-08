import { randomBytes } from 'node:crypto'
import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import { findMembership } from '@/server/repositories/memberships'
import {
  listActiveProjectMembersByRole,
  rewriteEffectivePermissionsForMembers,
} from '@/server/repositories/projectMembers'
import {
  createRole,
  findRoleById,
  findRoleByKey,
  updateRole as updateRoleRecord,
  type UpdateRoleFields,
} from '@/server/repositories/roles'
import { computeEffectivePermissions } from '@/server/services/access/computeEffectivePermissions'
import { audit } from '@/server/services/audit/log'
import { ActorType } from '@/shared/enums/audit'
import { OrgRole } from '@/shared/enums/orgRole'
import type { CreateRoleInput, Role, UpdateRoleInput } from '@/shared/types/role'

function isMongoDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 11000
  )
}

/** Derive a stable role key from a display name. */
export function deriveRoleKey(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64)
  return base.length > 0 ? base : `role_${randomBytes(3).toString('hex')}`
}

async function allocateRoleKey(ctx: OrgContext, preferred: string): Promise<string> {
  const existing = await findRoleByKey(ctx, preferred)
  if (!existing) {
    return preferred
  }
  for (let i = 0; i < 5; i += 1) {
    const suffix = randomBytes(2).toString('hex')
    const candidate = `${preferred.slice(0, Math.max(1, 64 - suffix.length - 1))}_${suffix}`
    if (!(await findRoleByKey(ctx, candidate))) {
      return candidate
    }
  }
  throw AppError.conflict('Unable to allocate role key')
}

/**
 * Recompute `effectivePermissions` for every active member holding this role.
 * Uses each member's org role + the updated role definition + their scope.
 */
export async function recomputeMembersForRole(ctx: OrgContext, role: Role): Promise<number> {
  const members = await listActiveProjectMembersByRole(ctx, role.id)
  if (members.length === 0) {
    return 0
  }

  const now = new Date()
  const updates = await Promise.all(
    members.map(async (member) => {
      const membership = await findMembership(ctx, member.userId)
      const orgRole = membership?.orgRole ?? OrgRole.MEMBER
      const effective = computeEffectivePermissions({
        orgRole,
        role,
        scope: member.scope,
        now,
      })
      return { memberId: member.id, effectivePermissions: effective.permissions }
    }),
  )

  return rewriteEffectivePermissionsForMembers(ctx, updates)
}

/** Create a custom (non-template) role. */
export async function createRoleForOrg(ctx: OrgContext, input: CreateRoleInput): Promise<Role> {
  await connectDb()

  const key = await allocateRoleKey(ctx, input.key ?? deriveRoleKey(input.name))

  let role: Role
  try {
    role = await createRole(ctx, {
      key,
      name: input.name,
      permissions: input.permissions,
      isTemplate: false,
      defaultScope: input.defaultScope,
    })
  } catch (error) {
    if (isMongoDuplicateKey(error)) {
      throw AppError.conflict('Role key is already taken in this organisation')
    }
    throw error
  }

  await audit(ctx, {
    action: 'role.created',
    subjectType: 'role',
    subjectId: role.id,
    actorType: ActorType.USER,
    actorId: ctx.userId,
    after: role,
  })

  return role
}

function toRepoPatch(input: UpdateRoleInput): UpdateRoleFields {
  const patch: UpdateRoleFields = {}
  if (input.name !== undefined) patch.name = input.name
  if (input.key !== undefined) patch.key = input.key
  if (input.permissions !== undefined) patch.permissions = input.permissions
  if (input.defaultScope !== undefined) patch.defaultScope = input.defaultScope
  return patch
}

/**
 * Update a role. Template-in-use edits require `force: true`.
 * Permission changes recompute every active assignee wholesale.
 */
export async function updateRoleForOrg(
  ctx: OrgContext,
  roleId: string,
  input: UpdateRoleInput,
): Promise<Role> {
  await connectDb()

  const before = await findRoleById(ctx, roleId)
  if (!before) {
    throw AppError.notFound()
  }

  const assignedCount = (await listActiveProjectMembersByRole(ctx, roleId)).length

  if (before.isTemplate && assignedCount > 0 && input.force !== true) {
    throw AppError.conflict('Template is assigned to project members; pass force=true to edit')
  }

  let after: Role | null
  try {
    after = await updateRoleRecord(ctx, roleId, toRepoPatch(input))
  } catch (error) {
    if (isMongoDuplicateKey(error)) {
      throw AppError.conflict('Role key is already taken in this organisation')
    }
    throw error
  }

  if (!after) {
    throw AppError.notFound()
  }

  if (input.permissions !== undefined) {
    await recomputeMembersForRole(ctx, after)
  }

  await audit(ctx, {
    action: 'role.updated',
    subjectType: 'role',
    subjectId: roleId,
    actorType: ActorType.USER,
    actorId: ctx.userId,
    before,
    after,
    metadata: {
      force: input.force === true,
      assignedCount,
    },
  })

  return after
}
