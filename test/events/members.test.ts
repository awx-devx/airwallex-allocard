/**
 * B3.12 — project member domain events once each:
 * member.added | member.role_changed | member.scope_changed | member.removed
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DELETE as REMOVE_MEMBER,
  PATCH as UPDATE_MEMBER,
} from '@/app/api/projects/[id]/members/[userId]/route'
import { POST as ADD_MEMBER } from '@/app/api/projects/[id]/members/route'
import { getPublishedEvents, resetEventPublisher } from '@/server/events/bus'
import { DomainEventType } from '@/server/events/types'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { ProjectMemberModel } from '@/server/models/ProjectMember'
import { ProjectModel } from '@/server/models/Project'
import { RoleModel } from '@/server/models/Role'
import { UserModel } from '@/server/models/User'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as projectsRepo from '@/server/repositories/projects'
import * as rolesRepo from '@/server/repositories/roles'
import * as users from '@/server/repositories/users'
import { seedRoleTemplates } from '@/server/services/organizations/seedRoleTemplates'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { OrgRole } from '@/shared/enums/orgRole'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

describe('events/members', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      MembershipModel.syncIndexes(),
      ProjectModel.syncIndexes(),
      RoleModel.syncIndexes(),
      ProjectMemberModel.syncIndexes(),
    ])
  })

  beforeEach(() => {
    resetEventPublisher()
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    installTestSessionResolver()
    resetEventPublisher()
    vi.restoreAllMocks()
  })

  async function seedOwnerWithProject() {
    const user = await users.createUser({
      email: `owner-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'Events Org',
      slug: `ev-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    const ctx = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
    await memberships.createMembership(ctx, { userId: user.id, orgRole: OrgRole.OWNER })
    await seedRoleTemplates(org.id)
    const project = await projectsRepo.createProject(ctx, {
      name: 'Events Project',
      code: `EV-${Date.now().toString(16)}`,
    })
    const viewer = await rolesRepo.findRoleByKey(ctx, 'viewer')
    const spender = await rolesRepo.findRoleByKey(ctx, 'project_spender')
    expect(viewer).not.toBeNull()
    expect(spender).not.toBeNull()
    return {
      org,
      project,
      viewer: viewer!,
      spender: spender!,
      session: {
        userId: user.id,
        orgId: org.id,
        orgRole: OrgRole.OWNER,
        onboarded: true as const,
      },
    }
  }

  async function seedOrgMember(orgId: string) {
    const user = await users.createUser({
      email: `m-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Member',
    })
    await memberships.createMembership(
      { orgId, userId: user.id, orgRole: OrgRole.MEMBER },
      { userId: user.id, orgRole: OrgRole.MEMBER },
    )
    return user
  }

  it('emits member.added exactly once on project member add', async () => {
    const setup = await seedOwnerWithProject()
    const member = await seedOrgMember(setup.org.id)
    resetEventPublisher()

    const res = await ADD_MEMBER(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${setup.project.id}/members`,
        session: setup.session,
        params: { id: setup.project.id },
        body: {
          userId: member.id,
          roleId: setup.viewer.id,
          scope: { level: AccessScopeLevel.PROJECT },
        },
      }),
    )
    expect(res.status).toBe(201)
    const body = await readBody<{ id: string }>(res)

    const events = getPublishedEvents().filter((e) => e.type === DomainEventType.MEMBER_ADDED)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: DomainEventType.MEMBER_ADDED,
      orgId: setup.org.id,
      projectId: setup.project.id,
      subjectType: 'projectMember',
      subjectId: body.id,
      payload: {
        projectMemberId: body.id,
        projectId: setup.project.id,
        userId: member.id,
        roleId: setup.viewer.id,
        addedBy: setup.session.userId,
      },
    })
    expect(events[0]?.emittedAt).toBeInstanceOf(Date)
  })

  it('emits member.role_changed exactly once on role update', async () => {
    const setup = await seedOwnerWithProject()
    const member = await seedOrgMember(setup.org.id)
    await ADD_MEMBER(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${setup.project.id}/members`,
        session: setup.session,
        params: { id: setup.project.id },
        body: {
          userId: member.id,
          roleId: setup.viewer.id,
          scope: { level: AccessScopeLevel.PROJECT },
        },
      }),
    )
    resetEventPublisher()

    const res = await UPDATE_MEMBER(
      buildRequest({
        method: 'PATCH',
        path: `/api/projects/${setup.project.id}/members/${member.id}`,
        session: setup.session,
        params: { id: setup.project.id, userId: member.id },
        body: { roleId: setup.spender.id },
      }),
    )
    expect(res.status).toBe(200)
    const body = await readBody<{ id: string }>(res)

    const events = getPublishedEvents().filter(
      (e) => e.type === DomainEventType.MEMBER_ROLE_CHANGED,
    )
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: DomainEventType.MEMBER_ROLE_CHANGED,
      orgId: setup.org.id,
      projectId: setup.project.id,
      subjectType: 'projectMember',
      subjectId: body.id,
      payload: {
        projectMemberId: body.id,
        projectId: setup.project.id,
        userId: member.id,
        fromRoleId: setup.viewer.id,
        toRoleId: setup.spender.id,
      },
    })
    expect(
      getPublishedEvents().filter((e) => e.type === DomainEventType.MEMBER_SCOPE_CHANGED),
    ).toHaveLength(0)
  })

  it('emits member.scope_changed exactly once on scope update', async () => {
    const setup = await seedOwnerWithProject()
    const member = await seedOrgMember(setup.org.id)
    await ADD_MEMBER(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${setup.project.id}/members`,
        session: setup.session,
        params: { id: setup.project.id },
        body: {
          userId: member.id,
          roleId: setup.viewer.id,
          scope: { level: AccessScopeLevel.PROJECT },
        },
      }),
    )
    resetEventPublisher()

    const res = await UPDATE_MEMBER(
      buildRequest({
        method: 'PATCH',
        path: `/api/projects/${setup.project.id}/members/${member.id}`,
        session: setup.session,
        params: { id: setup.project.id, userId: member.id },
        body: { scope: { level: AccessScopeLevel.OWN } },
      }),
    )
    expect(res.status).toBe(200)
    const body = await readBody<{ id: string }>(res)

    const events = getPublishedEvents().filter(
      (e) => e.type === DomainEventType.MEMBER_SCOPE_CHANGED,
    )
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: DomainEventType.MEMBER_SCOPE_CHANGED,
      orgId: setup.org.id,
      projectId: setup.project.id,
      subjectType: 'projectMember',
      subjectId: body.id,
      payload: {
        projectMemberId: body.id,
        projectId: setup.project.id,
        userId: member.id,
      },
    })
    expect(
      getPublishedEvents().filter((e) => e.type === DomainEventType.MEMBER_ROLE_CHANGED),
    ).toHaveLength(0)
  })

  it('emits member.removed exactly once on project member remove', async () => {
    const setup = await seedOwnerWithProject()
    const member = await seedOrgMember(setup.org.id)
    const added = await ADD_MEMBER(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${setup.project.id}/members`,
        session: setup.session,
        params: { id: setup.project.id },
        body: {
          userId: member.id,
          roleId: setup.viewer.id,
          scope: { level: AccessScopeLevel.PROJECT },
        },
      }),
    )
    const body = await readBody<{ id: string }>(added)
    resetEventPublisher()

    const res = await REMOVE_MEMBER(
      buildRequest({
        method: 'DELETE',
        path: `/api/projects/${setup.project.id}/members/${member.id}`,
        session: setup.session,
        params: { id: setup.project.id, userId: member.id },
      }),
    )
    expect(res.status).toBe(204)

    const events = getPublishedEvents().filter(
      (e) => e.type === DomainEventType.MEMBER_REMOVED && e.subjectType === 'projectMember',
    )
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: DomainEventType.MEMBER_REMOVED,
      orgId: setup.org.id,
      projectId: setup.project.id,
      subjectType: 'projectMember',
      subjectId: body.id,
      payload: {
        projectMemberId: body.id,
        projectId: setup.project.id,
        userId: member.id,
        removedBy: setup.session.userId,
      },
    })
  })
})
