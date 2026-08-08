import { connectDb } from '@/server/db/connect'
import { publishEvent } from '@/server/events/bus'
import { DomainEventType } from '@/server/events/types'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import { findMembership } from '@/server/repositories/memberships'
import {
  addProjectMember,
  findActiveProjectMember,
  softRemoveProjectMember,
  updateProjectMember,
} from '@/server/repositories/projectMembers'
import { findRoleById } from '@/server/repositories/roles'
import { findUserById } from '@/server/repositories/users'
import { computeEffectivePermissions } from '@/server/services/access/computeEffectivePermissions'
import { audit } from '@/server/services/audit/log'
import { assertProjectInOrg, toProjectMemberDetail } from '@/server/services/projectMembers/list'
import { ActorType } from '@/shared/enums/audit'
import { OrgRole } from '@/shared/enums/orgRole'
import type {
  AddProjectMemberInput,
  ProjectMemberDetail,
  UpdateProjectMemberInput,
} from '@/shared/types/projectMember'

function isMongoDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 11000
  )
}

/** Add a member with role+scope; materialise effectivePermissions. */
export async function addProjectMemberForProject(
  ctx: OrgContext,
  projectId: string,
  input: AddProjectMemberInput,
): Promise<ProjectMemberDetail> {
  await connectDb()
  await assertProjectInOrg(ctx, projectId)

  const user = await findUserById(input.userId)
  if (!user) {
    throw AppError.notFound()
  }

  const membership = await findMembership(ctx, input.userId)
  if (!membership) {
    throw AppError.conflict('User is not a member of this organisation')
  }

  const role = await findRoleById(ctx, input.roleId)
  if (!role) {
    throw AppError.notFound()
  }

  const existing = await findActiveProjectMember(ctx, projectId, input.userId)
  if (existing) {
    throw AppError.conflict('User is already a member of this project')
  }

  const now = new Date()
  const effective = computeEffectivePermissions({
    orgRole: membership.orgRole,
    role,
    scope: input.scope,
    now,
  })

  let member
  try {
    member = await addProjectMember(ctx, {
      projectId,
      userId: input.userId,
      roleId: input.roleId,
      scope: input.scope,
      effectivePermissions: effective.permissions,
      addedBy: ctx.userId,
      addedAt: now,
    })
  } catch (error) {
    if (isMongoDuplicateKey(error)) {
      throw AppError.conflict('User is already a member of this project')
    }
    throw error
  }

  const detail = await toProjectMemberDetail(ctx, member)

  await audit(ctx, {
    action: 'member.added',
    subjectType: 'projectMember',
    subjectId: member.id,
    projectId,
    actorType: ActorType.USER,
    actorId: ctx.userId,
    after: detail,
    metadata: { userId: input.userId, roleId: input.roleId },
  })

  await publishEvent({
    type: DomainEventType.MEMBER_ADDED,
    orgId: ctx.orgId,
    projectId,
    subjectType: 'projectMember',
    subjectId: member.id,
    payload: {
      projectMemberId: member.id,
      projectId,
      userId: member.userId,
      roleId: member.roleId,
      addedBy: ctx.userId,
    },
  })

  return detail
}

/** Change role and/or scope; recompute effectivePermissions wholesale. */
export async function updateProjectMemberForProject(
  ctx: OrgContext,
  projectId: string,
  userId: string,
  input: UpdateProjectMemberInput,
): Promise<ProjectMemberDetail> {
  await connectDb()
  await assertProjectInOrg(ctx, projectId)

  const before = await findActiveProjectMember(ctx, projectId, userId)
  if (!before) {
    throw AppError.notFound()
  }

  const nextRoleId = input.roleId ?? before.roleId
  const nextScope = input.scope ?? before.scope

  const role = await findRoleById(ctx, nextRoleId)
  if (!role) {
    throw AppError.notFound()
  }

  const membership = await findMembership(ctx, userId)
  const orgRole = membership?.orgRole ?? OrgRole.MEMBER

  const now = new Date()
  const effective = computeEffectivePermissions({
    orgRole,
    role,
    scope: nextScope,
    now,
  })

  const after = await updateProjectMember(ctx, before.id, {
    roleId: input.roleId,
    scope: input.scope,
    effectivePermissions: effective.permissions,
  })
  if (!after) {
    throw AppError.notFound()
  }

  const detail = await toProjectMemberDetail(ctx, after)
  const roleChanged = input.roleId !== undefined && input.roleId !== before.roleId
  const scopeChanged = input.scope !== undefined

  await audit(ctx, {
    action: 'member.updated',
    subjectType: 'projectMember',
    subjectId: after.id,
    projectId,
    actorType: ActorType.USER,
    actorId: ctx.userId,
    before,
    after: detail,
    metadata: { userId, roleChanged, scopeChanged },
  })

  if (roleChanged) {
    await publishEvent({
      type: DomainEventType.MEMBER_ROLE_CHANGED,
      orgId: ctx.orgId,
      projectId,
      subjectType: 'projectMember',
      subjectId: after.id,
      payload: {
        projectMemberId: after.id,
        projectId,
        userId,
        fromRoleId: before.roleId,
        toRoleId: after.roleId,
      },
    })
  }

  if (scopeChanged) {
    await publishEvent({
      type: DomainEventType.MEMBER_SCOPE_CHANGED,
      orgId: ctx.orgId,
      projectId,
      subjectType: 'projectMember',
      subjectId: after.id,
      payload: {
        projectMemberId: after.id,
        projectId,
        userId,
      },
    })
  }

  return detail
}

/** Soft-remove a project member. */
export async function removeProjectMemberForProject(
  ctx: OrgContext,
  projectId: string,
  userId: string,
): Promise<void> {
  await connectDb()
  await assertProjectInOrg(ctx, projectId)

  const before = await findActiveProjectMember(ctx, projectId, userId)
  if (!before) {
    throw AppError.notFound()
  }

  const after = await softRemoveProjectMember(ctx, projectId, userId)
  if (!after) {
    throw AppError.notFound()
  }

  await audit(ctx, {
    action: 'member.removed',
    subjectType: 'projectMember',
    subjectId: before.id,
    projectId,
    actorType: ActorType.USER,
    actorId: ctx.userId,
    before,
    after,
    metadata: { userId },
  })

  await publishEvent({
    type: DomainEventType.MEMBER_REMOVED,
    orgId: ctx.orgId,
    projectId,
    subjectType: 'projectMember',
    subjectId: before.id,
    payload: {
      projectMemberId: before.id,
      projectId,
      userId,
      removedBy: ctx.userId,
    },
  })
}
