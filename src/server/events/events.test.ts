import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { getPublishedEvents, resetEventPublisher } from '@/server/events/bus'
import { DomainEventType } from '@/server/events/types'
import { InviteModel } from '@/server/models/Invite'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { UserModel } from '@/server/models/User'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as users from '@/server/repositories/users'
import { acceptInvite } from '@/server/services/invites/accept'
import { createOrgInvite } from '@/server/services/invites/create'
import { createOrganizationForUser } from '@/server/services/organizations/create'
import { removeOrgMember } from '@/server/services/organizations/members'
import { OrgRole } from '@/shared/enums/orgRole'
import { useTestDb } from '../../../test/helpers/db'

describe('events', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      MembershipModel.syncIndexes(),
      InviteModel.syncIndexes(),
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

  it('emits organization.created exactly once on org create', async () => {
    const user = await users.createUser({
      email: `u-${Date.now()}@example.com`,
      name: 'Creator',
    })

    const org = await createOrganizationForUser(user.id, {
      name: 'Event Org',
      country: 'US',
      baseCurrency: 'USD',
      costCentres: [],
    })

    const events = getPublishedEvents().filter(
      (e) => e.type === DomainEventType.ORGANIZATION_CREATED,
    )
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: DomainEventType.ORGANIZATION_CREATED,
      orgId: org.id,
      subjectType: 'organization',
      subjectId: org.id,
      payload: {
        organizationId: org.id,
        createdBy: user.id,
        slug: org.slug,
      },
    })
    expect(events[0]?.emittedAt).toBeInstanceOf(Date)
  })

  it('emits member.invited exactly once on invite create', async () => {
    const owner = await users.createUser({
      email: `owner-${Date.now()}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'Invite Events',
      slug: `invite-ev-${Date.now()}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: owner.id,
    })
    const ctx = { orgId: org.id, userId: owner.id, orgRole: OrgRole.OWNER }
    await memberships.createMembership(ctx, { userId: owner.id, orgRole: OrgRole.OWNER })

    const invite = await createOrgInvite(ctx, {
      email: 'new@example.com',
      orgRole: OrgRole.MEMBER,
    })

    const events = getPublishedEvents().filter((e) => e.type === DomainEventType.MEMBER_INVITED)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: DomainEventType.MEMBER_INVITED,
      orgId: org.id,
      subjectType: 'invite',
      subjectId: invite.id,
      payload: {
        inviteId: invite.id,
        email: 'new@example.com',
        orgRole: OrgRole.MEMBER,
        invitedBy: owner.id,
      },
    })
  })

  it('emits member.joined exactly once on invite accept', async () => {
    const owner = await users.createUser({
      email: `owner2-${Date.now()}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'Join Events',
      slug: `join-ev-${Date.now()}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: owner.id,
    })
    const ctx = { orgId: org.id, userId: owner.id, orgRole: OrgRole.OWNER }
    await memberships.createMembership(ctx, { userId: owner.id, orgRole: OrgRole.OWNER })

    const invitee = await users.createUser({
      email: 'joiner@example.com',
      name: 'Joiner',
    })
    const invite = await createOrgInvite(ctx, {
      email: invitee.email,
      orgRole: OrgRole.ADMIN,
    })
    resetEventPublisher()
    vi.spyOn(console, 'info').mockImplementation(() => {})

    const membership = await acceptInvite(
      { userId: invitee.id, orgId: null, orgRole: null, onboarded: false },
      invite.token,
    )

    const events = getPublishedEvents().filter((e) => e.type === DomainEventType.MEMBER_JOINED)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: DomainEventType.MEMBER_JOINED,
      orgId: org.id,
      subjectType: 'membership',
      subjectId: membership.id,
      payload: {
        membershipId: membership.id,
        userId: invitee.id,
        orgRole: OrgRole.ADMIN,
        inviteId: invite.id,
      },
    })
  })

  it('emits member.removed exactly once on member remove', async () => {
    const owner = await users.createUser({
      email: `owner3-${Date.now()}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'Remove Events',
      slug: `rm-ev-${Date.now()}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: owner.id,
    })
    const ctx = { orgId: org.id, userId: owner.id, orgRole: OrgRole.OWNER }
    await memberships.createMembership(ctx, { userId: owner.id, orgRole: OrgRole.OWNER })

    const member = await users.createUser({
      email: `mem-${Date.now()}@example.com`,
      name: 'Member',
    })
    const membership = await memberships.createMembership(ctx, {
      userId: member.id,
      orgRole: OrgRole.MEMBER,
    })
    resetEventPublisher()

    await removeOrgMember(ctx, org.id, member.id)

    const events = getPublishedEvents().filter((e) => e.type === DomainEventType.MEMBER_REMOVED)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: DomainEventType.MEMBER_REMOVED,
      orgId: org.id,
      subjectType: 'membership',
      subjectId: membership.id,
      payload: {
        membershipId: membership.id,
        userId: member.id,
        orgRole: OrgRole.MEMBER,
      },
    })
  })
})
