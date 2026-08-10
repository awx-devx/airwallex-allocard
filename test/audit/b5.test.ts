/**
 * B5.13 — one audit assertion per mutating card/cardholder endpoint including pan-token.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST as CREATE_CARDHOLDER } from '@/app/api/cardholders/route'
import { POST as CLOSE } from '@/app/api/cards/[id]/close/route'
import { POST as FREEZE } from '@/app/api/cards/[id]/freeze/route'
import { POST as PAN } from '@/app/api/cards/[id]/pan-token/route'
import { POST as UNFREEZE } from '@/app/api/cards/[id]/unfreeze/route'
import { PATCH } from '@/app/api/cards/[id]/route'
import { POST as CREATE_CARD } from '@/app/api/projects/[id]/cards/route'
import { resetEventPublisher } from '@/server/events/bus'
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
import { resetRedis } from '@/server/redis'
import { CardPurpose } from '@/shared/enums/cardPurpose'
import { CardholderStatus } from '@/shared/enums/cardholderStatus'
import { CardholderType } from '@/shared/enums/cardholderType'
import { OrgRole } from '@/shared/enums/orgRole'
import { makeCardControls } from '../helpers/factories'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver } from '../helpers/request'

async function findAudits(filter: { orgId: string; action: string; subjectId?: string }) {
  return AuditLogModel.find({ ...filter }).exec()
}

describe('audit/b5', () => {
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

  async function seedOwner() {
    const user = await users.createUser({
      email: `ab5-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'Audit B5 Org',
      slug: `ab5-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    const ctx = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
    await memberships.createMembership(ctx, { userId: user.id, orgRole: OrgRole.OWNER })
    const project = await projectsRepo.createProject(ctx, {
      name: 'Audit',
      code: `AB-${Date.now().toString(16)}`,
    })
    const ch = await createCardholderForOrg(ctx, { type: CardholderType.DELEGATE })
    if (ch.status !== CardholderStatus.READY) {
      await cardholdersRepo.updateCardholderStatus(ctx, ch.id, CardholderStatus.READY)
    }
    const cardholder = (await cardholdersRepo.findCardholderById(ctx, ch.id))!
    return {
      ctx,
      org,
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

  it('audits cardholder.created exactly once on POST', async () => {
    const setup = await seedOwner()
    const res = await CREATE_CARDHOLDER(
      buildRequest({
        method: 'POST',
        path: '/api/cardholders',
        session: setup.session,
        body: { type: CardholderType.DELEGATE },
      }),
    )
    expect(res.status).toBe(201)
    const body = (await res.json()) as { id: string }
    const audits = await findAudits({
      orgId: setup.org.id,
      action: 'cardholder.created',
      subjectId: body.id,
    })
    expect(audits).toHaveLength(1)
  })

  it('audits card.created, card.updated, card.status_changed, card.pan_token_created once each', async () => {
    const setup = await seedOwner()

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
    expect(createRes.status).toBe(201)
    const card = (await createRes.json()) as { id: string }
    expect(
      await findAudits({ orgId: setup.org.id, action: 'card.created', subjectId: card.id }),
    ).toHaveLength(1)

    const patchRes = await PATCH(
      buildRequest({
        method: 'PATCH',
        path: `/api/cards/${card.id}`,
        session: setup.session,
        params: { id: card.id },
        body: { nickName: 'Audited' },
      }),
    )
    expect(patchRes.status).toBe(200)
    expect(
      await findAudits({ orgId: setup.org.id, action: 'card.updated', subjectId: card.id }),
    ).toHaveLength(1)

    const freezeRes = await FREEZE(
      buildRequest({
        method: 'POST',
        path: `/api/cards/${card.id}/freeze`,
        session: setup.session,
        params: { id: card.id },
      }),
    )
    expect(freezeRes.status).toBe(200)
    expect(
      await findAudits({
        orgId: setup.org.id,
        action: 'card.status_changed',
        subjectId: card.id,
      }),
    ).toHaveLength(1)

    await UNFREEZE(
      buildRequest({
        method: 'POST',
        path: `/api/cards/${card.id}/unfreeze`,
        session: setup.session,
        params: { id: card.id },
      }),
    )
    expect(
      await findAudits({
        orgId: setup.org.id,
        action: 'card.status_changed',
        subjectId: card.id,
      }),
    ).toHaveLength(2)

    const panRes = await PAN(
      buildRequest({
        method: 'POST',
        path: `/api/cards/${card.id}/pan-token`,
        session: setup.session,
        params: { id: card.id },
      }),
    )
    expect(panRes.status).toBe(200)
    expect(
      await findAudits({
        orgId: setup.org.id,
        action: 'card.pan_token_created',
        subjectId: card.id,
      }),
    ).toHaveLength(1)

    const closeRes = await CLOSE(
      buildRequest({
        method: 'POST',
        path: `/api/cards/${card.id}/close`,
        session: setup.session,
        params: { id: card.id },
        body: { confirm: true },
      }),
    )
    expect(closeRes.status).toBe(200)
    expect(
      await findAudits({
        orgId: setup.org.id,
        action: 'card.status_changed',
        subjectId: card.id,
      }),
    ).toHaveLength(3)
  })
})
