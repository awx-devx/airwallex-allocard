/**
 * B5.13 — card domain events once each with the right payload:
 * card.created | card.status_changed | card.limit_updated
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST as FREEZE } from '@/app/api/cards/[id]/freeze/route'
import { POST as CREATE_CARD } from '@/app/api/projects/[id]/cards/route'
import { PATCH } from '@/app/api/cards/[id]/route'
import { getPublishedEvents, resetEventPublisher } from '@/server/events/bus'
import { DomainEventType } from '@/server/events/types'
import { AuditLogModel } from '@/server/models/AuditLog'
import { CardModel } from '@/server/models/Card'
import { CardholderModel } from '@/server/models/Cardholder'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { ProjectModel } from '@/server/models/Project'
import { UserModel } from '@/server/models/User'
import * as cardholdersRepo from '@/server/repositories/cardholders'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as projectsRepo from '@/server/repositories/projects'
import * as users from '@/server/repositories/users'
import { createCardholderForOrg } from '@/server/services/cardholders/create'
import { CardPurpose } from '@/shared/enums/cardPurpose'
import { CardholderStatus } from '@/shared/enums/cardholderStatus'
import { CardholderType } from '@/shared/enums/cardholderType'
import { OrgRole } from '@/shared/enums/orgRole'
import { TransactionLimitInterval } from '@/shared/enums/transactionLimitInterval'
import { makeCardControls } from '../helpers/factories'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver } from '../helpers/request'
import { resetRedis } from '@/server/redis'

describe('events/cards', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      MembershipModel.syncIndexes(),
      ProjectModel.syncIndexes(),
      CardholderModel.syncIndexes(),
      CardModel.syncIndexes(),
      AuditLogModel.syncIndexes(),
    ])
  })

  beforeEach(() => {
    resetEventPublisher()
    resetRedis()
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    installTestSessionResolver()
    resetEventPublisher()
    resetRedis()
    vi.restoreAllMocks()
  })

  async function seed() {
    const user = await users.createUser({
      email: `ev-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'Events Cards Org',
      slug: `org-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    const ctx = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
    await memberships.createMembership(ctx, { userId: user.id, orgRole: OrgRole.OWNER })
    const project = await projectsRepo.createProject(ctx, {
      name: 'Events',
      code: `EV-${Date.now().toString(16)}`,
    })
    const ch = await createCardholderForOrg(ctx, { type: CardholderType.DELEGATE })
    if (ch.status !== CardholderStatus.READY) {
      await cardholdersRepo.updateCardholderStatus(ctx, ch.id, CardholderStatus.READY)
    }
    const cardholder = (await cardholdersRepo.findCardholderById(ctx, ch.id))!
    return {
      ctx,
      project,
      cardholder,
      session: {
        userId: user.id,
        orgId: org.id,
        orgRole: OrgRole.OWNER,
        onboarded: true as const,
      },
    }
  }

  it('emits card.created with payload', async () => {
    const setup = await seed()
    resetEventPublisher()
    const res = await CREATE_CARD(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${setup.project.id}/cards`,
        session: setup.session,
        params: { id: setup.project.id },
        body: {
          purpose: CardPurpose.SHARED,
          cardholderId: setup.cardholder.id,
          desiredControls: makeCardControls(),
        },
      }),
    )
    expect(res.status).toBe(201)
    const events = getPublishedEvents().filter((e) => e.type === DomainEventType.CARD_CREATED)
    expect(events).toHaveLength(1)
    expect(events[0]?.payload).toMatchObject({
      projectId: setup.project.id,
      purpose: CardPurpose.SHARED,
      cardholderId: setup.cardholder.id,
    })
    expect(events[0]?.subjectType).toBe('card')
  })

  it('emits card.status_changed on freeze', async () => {
    const setup = await seed()
    const createRes = await CREATE_CARD(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${setup.project.id}/cards`,
        session: setup.session,
        params: { id: setup.project.id },
        body: {
          purpose: CardPurpose.SHARED,
          cardholderId: setup.cardholder.id,
          desiredControls: makeCardControls(),
        },
      }),
    )
    const card = (await createRes.json()) as { id: string }
    resetEventPublisher()

    const res = await FREEZE(
      buildRequest({
        method: 'POST',
        path: `/api/cards/${card.id}/freeze`,
        session: setup.session,
        params: { id: card.id },
      }),
    )
    expect(res.status).toBe(200)
    const events = getPublishedEvents().filter(
      (e) => e.type === DomainEventType.CARD_STATUS_CHANGED,
    )
    expect(events).toHaveLength(1)
    expect(events[0]?.payload).toMatchObject({
      cardId: card.id,
      from: 'ACTIVE',
      to: 'INACTIVE',
    })
  })

  it('emits card.limit_updated when limits change via patch+reconcile', async () => {
    const setup = await seed()
    const createRes = await CREATE_CARD(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${setup.project.id}/cards`,
        session: setup.session,
        params: { id: setup.project.id },
        body: {
          purpose: CardPurpose.SHARED,
          cardholderId: setup.cardholder.id,
          desiredControls: makeCardControls({ monthlyAmount: 400_000 }),
        },
      }),
    )
    const card = (await createRes.json()) as { id: string }
    resetEventPublisher()

    const res = await PATCH(
      buildRequest({
        method: 'PATCH',
        path: `/api/cards/${card.id}`,
        session: setup.session,
        params: { id: card.id },
        body: {
          desiredControls: {
            transactionLimits: {
              currency: 'USD',
              limits: [{ interval: TransactionLimitInterval.MONTHLY, amount: 100_000 }],
            },
          },
        },
      }),
    )
    expect(res.status).toBe(200)
    const events = getPublishedEvents().filter((e) => e.type === DomainEventType.CARD_LIMIT_UPDATED)
    expect(events).toHaveLength(1)
    expect(events[0]?.payload).toMatchObject({ cardId: card.id, projectId: setup.project.id })
  })
})
