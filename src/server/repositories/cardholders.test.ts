import { beforeAll, describe, expect, it } from 'vitest'
import { useTestDb } from '../../../test/helpers/db'
import { CardholderStatus } from '@/shared/enums/cardholderStatus'
import { CardholderType } from '@/shared/enums/cardholderType'
import { OrgRole } from '@/shared/enums/orgRole'
import { CardholderModel } from '@/server/models/Cardholder'
import type { OrgContext } from '@/server/http/types'
import * as cardholders from '@/server/repositories/cardholders'

function ctx(orgId: string, userId = 'user_1'): OrgContext {
  return { orgId, userId, orgRole: OrgRole.OWNER }
}

describe('repositories/cardholders', () => {
  useTestDb()

  beforeAll(async () => {
    await CardholderModel.syncIndexes()
  })

  it('creates and finds by id within org; cross-org returns null', async () => {
    const orgCtx = ctx('org_1')
    const created = await cardholders.createCardholder(orgCtx, {
      userId: 'user_a',
      airwallexCardholderId: 'aw_ch_1',
      type: CardholderType.INDIVIDUAL,
      status: CardholderStatus.READY,
    })

    expect(created.userId).toBe('user_a')
    expect(created.status).toBe(CardholderStatus.READY)

    expect(await cardholders.findCardholderById(orgCtx, created.id)).toEqual(created)
    expect(await cardholders.findCardholderById(ctx('org_other'), created.id)).toBeNull()
  })

  it('finds by airwallex id and user id', async () => {
    const orgCtx = ctx('org_find')
    const created = await cardholders.createCardholder(orgCtx, {
      userId: 'user_b',
      airwallexCardholderId: 'aw_ch_find',
      type: CardholderType.INDIVIDUAL,
    })

    expect(await cardholders.findCardholderByAirwallexId(orgCtx, 'aw_ch_find')).toEqual(created)
    expect(await cardholders.findCardholderByUserId(orgCtx, 'user_b')).toEqual(created)
    expect(await cardholders.findCardholderByUserId(ctx('org_other'), 'user_b')).toBeNull()
  })

  it('lists with pagination and filters; updates status', async () => {
    const orgCtx = ctx('org_list')
    await cardholders.createCardholder(orgCtx, {
      userId: 'u1',
      airwallexCardholderId: 'aw_1',
      type: CardholderType.INDIVIDUAL,
      status: CardholderStatus.READY,
    })
    await cardholders.createCardholder(orgCtx, {
      userId: null,
      airwallexCardholderId: 'aw_2',
      type: CardholderType.DELEGATE,
      status: CardholderStatus.PENDING,
    })
    await cardholders.createCardholder(ctx('org_other'), {
      userId: 'u1',
      airwallexCardholderId: 'aw_other',
      type: CardholderType.INDIVIDUAL,
    })

    const page1 = await cardholders.listCardholders(orgCtx, { page: 1, pageSize: 1 })
    expect(page1.total).toBe(2)
    expect(page1.items).toHaveLength(1)

    const delegates = await cardholders.listCardholders(orgCtx, {
      type: CardholderType.DELEGATE,
    })
    expect(delegates.total).toBe(1)
    expect(delegates.items[0]?.type).toBe(CardholderType.DELEGATE)

    const updated = await cardholders.updateCardholderStatus(
      orgCtx,
      delegates.items[0]!.id,
      CardholderStatus.READY,
    )
    expect(updated?.status).toBe(CardholderStatus.READY)
  })

  it('finds the oldest org DELEGATE with null userId', async () => {
    const orgCtx = ctx('org_delegate_find')
    const first = await cardholders.createCardholder(orgCtx, {
      userId: null,
      airwallexCardholderId: 'aw_del_1',
      type: CardholderType.DELEGATE,
      status: CardholderStatus.READY,
    })
    await cardholders.createCardholder(orgCtx, {
      userId: null,
      airwallexCardholderId: 'aw_del_2',
      type: CardholderType.DELEGATE,
      status: CardholderStatus.PENDING,
    })
    const found = await cardholders.findOrgDelegateCardholder(orgCtx)
    expect(found?.id).toBe(first.id)
    expect(await cardholders.findOrgDelegateCardholder(ctx('org_other'))).toBeNull()
  })
})
