import { beforeAll, describe, expect, it } from 'vitest'
import { useTestDb } from '../../../test/helpers/db'
import { AllowedTransactionCount } from '@/shared/enums/allowedTransactionCount'
import { CardPurpose } from '@/shared/enums/cardPurpose'
import { CardStatus } from '@/shared/enums/cardStatus'
import { OrgRole } from '@/shared/enums/orgRole'
import { TransactionLimitInterval } from '@/shared/enums/transactionLimitInterval'
import { CardModel } from '@/server/models/Card'
import type { OrgContext } from '@/server/http/types'
import type { CardControls } from '@/shared/types/cardControls'
import * as cards from '@/server/repositories/cards'

function ctx(orgId: string, userId = 'user_1'): OrgContext {
  return { orgId, userId, orgRole: OrgRole.OWNER }
}

function controls(overrides: Partial<CardControls> = {}): CardControls {
  return {
    allowedTransactionCount: AllowedTransactionCount.MULTIPLE,
    transactionLimits: {
      currency: 'USD',
      limits: [{ interval: TransactionLimitInterval.MONTHLY, amount: 400_000 }],
    },
    activeFrom: null,
    activeTo: null,
    allowedCurrencies: null,
    allowedMerchantCategories: null,
    allowedMerchantCountries: null,
    allowedMerchantBrands: null,
    blockedTransactionUsages: [],
    ...overrides,
  }
}

function createInput(overrides: Partial<cards.CreateCardFields> = {}): cards.CreateCardFields {
  const c = controls()
  return {
    projectId: 'proj_1',
    cardholderId: 'ch_1',
    airwallexCardId: 'aw_card_1',
    maskedNumber: '************1234',
    nickName: 'APAC Launch',
    purpose: CardPurpose.MEMBER,
    status: CardStatus.ACTIVE,
    desiredControls: c,
    appliedControls: c,
    ...overrides,
  }
}

describe('repositories/cards', () => {
  useTestDb()

  beforeAll(async () => {
    await CardModel.syncIndexes()
  })

  it('creates and finds by id / airwallex id; cross-org returns null', async () => {
    const orgCtx = ctx('org_1')
    const created = await cards.createCard(orgCtx, createInput())

    expect(created.maskedNumber).toBe('************1234')
    expect(created.desiredControls.transactionLimits.limits[0]?.amount).toBe(400_000)
    expect(created).not.toHaveProperty('pan')
    expect(created).not.toHaveProperty('cvv')

    expect(await cards.findCardById(orgCtx, created.id)).toEqual(created)
    expect(await cards.findCardByAirwallexId(orgCtx, 'aw_card_1')).toEqual(created)
    expect(await cards.findCardById(ctx('org_other'), created.id)).toBeNull()
  })

  it('lists with filters and updates nickname, accessList, controls, status', async () => {
    const orgCtx = ctx('org_list')
    const a = await cards.createCard(
      orgCtx,
      createInput({ airwallexCardId: 'aw_a', projectId: 'proj_a', purpose: CardPurpose.SHARED }),
    )
    await cards.createCard(
      orgCtx,
      createInput({
        airwallexCardId: 'aw_b',
        projectId: 'proj_b',
        status: CardStatus.CLOSED,
        purpose: CardPurpose.VENDOR,
        desiredControls: controls({
          allowedTransactionCount: AllowedTransactionCount.SINGLE,
        }),
        appliedControls: controls({
          allowedTransactionCount: AllowedTransactionCount.SINGLE,
        }),
      }),
    )

    const listed = await cards.listCards(orgCtx, { projectId: 'proj_a', page: 1, pageSize: 10 })
    expect(listed.total).toBe(1)
    expect(listed.items[0]?.id).toBe(a.id)

    const nick = await cards.updateCardNickname(orgCtx, a.id, 'Renamed')
    expect(nick?.nickName).toBe('Renamed')

    const access = await cards.updateCardAccessList(orgCtx, a.id, ['user_x'])
    expect(access?.accessList).toEqual(['user_x'])

    const byHolder = await cards.listCards(orgCtx, { accessListUserId: 'user_x' })
    expect(byHolder.total).toBe(1)
    expect(byHolder.items[0]?.id).toBe(a.id)

    const nextControls = controls({
      transactionLimits: {
        currency: 'USD',
        limits: [{ interval: TransactionLimitInterval.DAILY, amount: 50_000 }],
      },
    })
    const desired = await cards.updateDesiredControls(orgCtx, a.id, nextControls)
    expect(desired?.desiredControls.transactionLimits.limits[0]?.amount).toBe(50_000)

    const applied = await cards.updateAppliedControls(orgCtx, a.id, nextControls)
    expect(applied?.appliedControls.transactionLimits.limits[0]?.amount).toBe(50_000)
    expect(applied?.lastReconciledAt).toEqual(expect.any(String))

    const frozen = await cards.updateCardStatus(orgCtx, a.id, CardStatus.INACTIVE)
    expect(frozen?.status).toBe(CardStatus.INACTIVE)
  })

  it('countNonClosedByProject ignores CLOSED and other orgs', async () => {
    const orgCtx = ctx('org_count')
    await cards.createCard(
      orgCtx,
      createInput({ airwallexCardId: 'aw_1', projectId: 'proj_1', status: CardStatus.ACTIVE }),
    )
    await cards.createCard(
      orgCtx,
      createInput({ airwallexCardId: 'aw_2', projectId: 'proj_1', status: CardStatus.PENDING }),
    )
    await cards.createCard(
      orgCtx,
      createInput({ airwallexCardId: 'aw_3', projectId: 'proj_1', status: CardStatus.CLOSED }),
    )
    await cards.createCard(
      orgCtx,
      createInput({ airwallexCardId: 'aw_4', projectId: 'proj_2', status: CardStatus.ACTIVE }),
    )
    await cards.createCard(
      ctx('org_other'),
      createInput({ airwallexCardId: 'aw_5', projectId: 'proj_1', status: CardStatus.ACTIVE }),
    )

    expect(await cards.countNonClosedByProject(orgCtx, 'proj_1')).toBe(2)
    expect(await cards.countNonClosedByProject(orgCtx, 'proj_2')).toBe(1)
    expect(await cards.countNonClosedByProject(ctx('org_other'), 'proj_1')).toBe(1)
  })
})
