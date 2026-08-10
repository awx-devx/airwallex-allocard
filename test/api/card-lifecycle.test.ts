import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST as CLOSE } from '@/app/api/cards/[id]/close/route'
import { POST as FREEZE } from '@/app/api/cards/[id]/freeze/route'
import { POST as UNFREEZE } from '@/app/api/cards/[id]/unfreeze/route'
import { PATCH } from '@/app/api/cards/[id]/route'
import { AuditLogModel } from '@/server/models/AuditLog'
import { CardModel } from '@/server/models/Card'
import { CardholderModel } from '@/server/models/Cardholder'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { ProjectModel } from '@/server/models/Project'
import { UserModel } from '@/server/models/User'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as projectsRepo from '@/server/repositories/projects'
import * as users from '@/server/repositories/users'
import * as cardholdersRepo from '@/server/repositories/cardholders'
import { createCardholderForOrg } from '@/server/services/cardholders/create'
import { createCardForProject } from '@/server/services/cards/create'
import { cardContracts } from '@/shared/contracts/card'
import { CardPurpose } from '@/shared/enums/cardPurpose'
import { CardStatus } from '@/shared/enums/cardStatus'
import { CardholderStatus } from '@/shared/enums/cardholderStatus'
import { CardholderType } from '@/shared/enums/cardholderType'
import { ErrorCode } from '@/shared/enums/errors'
import { OrgRole } from '@/shared/enums/orgRole'
import { makeCardControls } from '../helpers/factories'
import { expectMatchesContract } from '../helpers/contract'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

describe('/api/cards/:id lifecycle', () => {
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
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    installTestSessionResolver()
    vi.restoreAllMocks()
  })

  async function seedCard() {
    const user = await users.createUser({
      email: `life-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'Life Org',
      slug: `org-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    const ctx = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
    await memberships.createMembership(ctx, { userId: user.id, orgRole: OrgRole.OWNER })
    const project = await projectsRepo.createProject(ctx, {
      name: 'Life',
      code: `L-${Date.now().toString(16)}`,
    })
    const ch = await createCardholderForOrg(ctx, { type: CardholderType.DELEGATE })
    if (ch.status !== CardholderStatus.READY) {
      await cardholdersRepo.updateCardholderStatus(ctx, ch.id, CardholderStatus.READY)
    }
    const cardholder = (await cardholdersRepo.findCardholderById(ctx, ch.id))!
    const card = await createCardForProject(ctx, project.id, {
      purpose: CardPurpose.SHARED,
      cardholderId: cardholder.id,
      desiredControls: makeCardControls(),
    })
    return {
      ctx,
      card,
      session: {
        userId: user.id,
        orgId: org.id,
        orgRole: OrgRole.OWNER,
        onboarded: true as const,
      },
    }
  }

  it('freezes and unfreezes a card', async () => {
    const setup = await seedCard()
    const frozen = await FREEZE(
      buildRequest({
        method: 'POST',
        path: `/api/cards/${setup.card.id}/freeze`,
        session: setup.session,
        params: { id: setup.card.id },
      }),
    )
    expect(frozen.status).toBe(200)
    const frozenBody = await expectMatchesContract(frozen, cardContracts.freeze.output)
    expect(frozenBody.status).toBe(CardStatus.INACTIVE)

    const active = await UNFREEZE(
      buildRequest({
        method: 'POST',
        path: `/api/cards/${setup.card.id}/unfreeze`,
        session: setup.session,
        params: { id: setup.card.id },
      }),
    )
    expect(active.status).toBe(200)
    expect((await expectMatchesContract(active, cardContracts.unfreeze.output)).status).toBe(
      CardStatus.ACTIVE,
    )
  })

  it('closes irreversibly and rejects further mutations', async () => {
    const setup = await seedCard()

    const bad = await CLOSE(
      buildRequest({
        method: 'POST',
        path: `/api/cards/${setup.card.id}/close`,
        session: setup.session,
        params: { id: setup.card.id },
        body: { confirm: false },
      }),
    )
    expect(bad.status).toBe(422)

    const closed = await CLOSE(
      buildRequest({
        method: 'POST',
        path: `/api/cards/${setup.card.id}/close`,
        session: setup.session,
        params: { id: setup.card.id },
        body: { confirm: true },
      }),
    )
    expect(closed.status).toBe(200)
    expect((await expectMatchesContract(closed, cardContracts.close.output)).status).toBe(
      CardStatus.CLOSED,
    )

    const freezeAgain = await FREEZE(
      buildRequest({
        method: 'POST',
        path: `/api/cards/${setup.card.id}/freeze`,
        session: setup.session,
        params: { id: setup.card.id },
      }),
    )
    expect(freezeAgain.status).toBe(409)
    expect((await readBody<{ error: { code: string } }>(freezeAgain)).error.code).toBe(
      ErrorCode.CONFLICT,
    )

    const patch = await PATCH(
      buildRequest({
        method: 'PATCH',
        path: `/api/cards/${setup.card.id}`,
        session: setup.session,
        params: { id: setup.card.id },
        body: { nickName: 'Nope' },
      }),
    )
    expect(patch.status).toBe(409)
  })
})
