import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import { findProjectById } from '@/server/repositories/projects'
import { findRoleById } from '@/server/repositories/roles'
import { findUserById, findUsersByIds } from '@/server/repositories/users'
import { listActiveProjectMembers } from '@/server/repositories/projectMembers'
import type { ProjectMember, ProjectMemberDetail } from '@/shared/types/projectMember'
import type { Role } from '@/shared/types/role'
import type { User } from '@/shared/types/user'

export async function assertProjectInOrg(ctx: OrgContext, projectId: string): Promise<void> {
  const project = await findProjectById(ctx, projectId)
  if (!project) {
    throw AppError.notFound()
  }
}

function toRoleSummary(role: Role): ProjectMemberDetail['role'] {
  return {
    id: role.id,
    key: role.key,
    name: role.name,
    isTemplate: role.isTemplate,
  }
}

function toUserSummary(user: User): ProjectMemberDetail['user'] {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    ...(user.image !== undefined ? { image: user.image } : {}),
  }
}

export async function toProjectMemberDetail(
  ctx: OrgContext,
  member: ProjectMember,
): Promise<ProjectMemberDetail> {
  const [role, user] = await Promise.all([
    findRoleById(ctx, member.roleId),
    findUserById(member.userId),
  ])
  if (!role || !user) {
    throw AppError.notFound()
  }
  return {
    ...member,
    role: toRoleSummary(role),
    user: toUserSummary(user),
  }
}

/** List active project members with role + user summaries. */
export async function listProjectMembersForProject(
  ctx: OrgContext,
  projectId: string,
): Promise<ProjectMemberDetail[]> {
  await connectDb()
  await assertProjectInOrg(ctx, projectId)

  const members = await listActiveProjectMembers(ctx, projectId)
  if (members.length === 0) {
    return []
  }

  const roleIds = [...new Set(members.map((m) => m.roleId))]
  const userIds = [...new Set(members.map((m) => m.userId))]

  const [roles, users] = await Promise.all([
    Promise.all(roleIds.map((id) => findRoleById(ctx, id))),
    findUsersByIds(userIds),
  ])

  const roleById = new Map(roles.filter((r): r is Role => r !== null).map((r) => [r.id, r]))
  const userById = new Map(users.map((u) => [u.id, u]))

  return members.flatMap((member) => {
    const role = roleById.get(member.roleId)
    const user = userById.get(member.userId)
    if (!role || !user) {
      return []
    }
    return [
      {
        ...member,
        role: toRoleSummary(role),
        user: toUserSummary(user),
      },
    ]
  })
}
