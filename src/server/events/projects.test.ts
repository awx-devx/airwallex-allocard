/**
 * B2.9 — confirm project lifecycle events emit once per successful create/transition.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { getPublishedEvents, resetEventPublisher } from '@/server/events/bus'
import { DomainEventType } from '@/server/events/types'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { ProjectModel } from '@/server/models/Project'
import { UserModel } from '@/server/models/User'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as users from '@/server/repositories/users'
import { createProjectForOrg } from '@/server/services/projects/create'
import { transitionProject } from '@/server/services/projects/transition'
import { OrgRole } from '@/shared/enums/orgRole'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import { useTestDb } from '../../../test/helpers/db'

describe('events/projects', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      MembershipModel.syncIndexes(),
      ProjectModel.syncIndexes(),
    ])
  })

  beforeEach(() => {
    resetEventPublisher()
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    resetEventPublisher()
    vi.restoreAllMocks()
  })

  async function seedCtx() {
    const user = await users.createUser({
      email: `u-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
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
    return { user, org, ctx }
  }

  it('emits project.created exactly once on create', async () => {
    const { ctx, user } = await seedCtx()

    const project = await createProjectForOrg(ctx, {
      name: 'Created',
      code: `CR-${Date.now()}`,
    })

    const events = getPublishedEvents().filter((e) => e.type === DomainEventType.PROJECT_CREATED)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: DomainEventType.PROJECT_CREATED,
      orgId: ctx.orgId,
      projectId: project.id,
      subjectType: 'project',
      subjectId: project.id,
      payload: {
        projectId: project.id,
        code: project.code,
        createdBy: user.id,
      },
    })
    expect(events[0]?.emittedAt).toBeInstanceOf(Date)
  })

  it('emits approved and launched exactly once on → ACTIVE', async () => {
    const { ctx } = await seedCtx()
    const project = await createProjectForOrg(ctx, {
      name: 'Launch',
      code: `LN-${Date.now()}`,
      ownerId: ctx.userId,
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-12-31T00:00:00.000Z',
    })
    await transitionProject(ctx, project.id, { to: ProjectStatus.PENDING_APPROVAL })
    resetEventPublisher()

    await transitionProject(ctx, project.id, { to: ProjectStatus.ACTIVE })

    const approved = getPublishedEvents().filter((e) => e.type === DomainEventType.PROJECT_APPROVED)
    const launched = getPublishedEvents().filter((e) => e.type === DomainEventType.PROJECT_LAUNCHED)
    expect(approved).toHaveLength(1)
    expect(launched).toHaveLength(1)
    expect(approved[0]).toMatchObject({
      orgId: ctx.orgId,
      projectId: project.id,
      subjectType: 'project',
      subjectId: project.id,
    })
    expect(launched[0]).toMatchObject({
      orgId: ctx.orgId,
      projectId: project.id,
      subjectType: 'project',
      subjectId: project.id,
    })
  })

  it('emits project.closing exactly once on → CLOSING', async () => {
    const { ctx } = await seedCtx()
    const project = await createProjectForOrg(ctx, {
      name: 'Closing',
      code: `CL-${Date.now()}`,
      ownerId: ctx.userId,
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-12-31T00:00:00.000Z',
    })
    await transitionProject(ctx, project.id, { to: ProjectStatus.PENDING_APPROVAL })
    await transitionProject(ctx, project.id, { to: ProjectStatus.ACTIVE })
    resetEventPublisher()

    await transitionProject(ctx, project.id, { to: ProjectStatus.CLOSING })

    const events = getPublishedEvents().filter((e) => e.type === DomainEventType.PROJECT_CLOSING)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      orgId: ctx.orgId,
      projectId: project.id,
      subjectId: project.id,
    })
  })

  it('emits project.closed exactly once on → CLOSED', async () => {
    const { ctx } = await seedCtx()
    const project = await createProjectForOrg(ctx, {
      name: 'Closed',
      code: `CD-${Date.now()}`,
      ownerId: ctx.userId,
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-12-31T00:00:00.000Z',
    })
    await transitionProject(ctx, project.id, { to: ProjectStatus.PENDING_APPROVAL })
    await transitionProject(ctx, project.id, { to: ProjectStatus.ACTIVE })
    await transitionProject(ctx, project.id, { to: ProjectStatus.CLOSING })
    resetEventPublisher()

    await transitionProject(ctx, project.id, { to: ProjectStatus.CLOSED })

    const events = getPublishedEvents().filter((e) => e.type === DomainEventType.PROJECT_CLOSED)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      orgId: ctx.orgId,
      projectId: project.id,
      subjectId: project.id,
    })
  })

  it('does not emit lifecycle events on failed transition', async () => {
    const { ctx } = await seedCtx()
    const project = await createProjectForOrg(ctx, {
      name: 'Fail',
      code: `FL-${Date.now()}`,
    })
    resetEventPublisher()

    await expect(
      transitionProject(ctx, project.id, { to: ProjectStatus.ACTIVE }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })

    expect(getPublishedEvents()).toHaveLength(0)
  })
})
