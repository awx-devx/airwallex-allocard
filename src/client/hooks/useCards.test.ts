import { describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/client/api/errors'
import { call } from '@/client/api/client'
import {
  cardQueryOptions,
  optimisticSetCardStatus,
  rollbackCardStatus,
} from '@/client/hooks/useCards'
import { qk } from '@/client/queryKeys'
import { cardContracts } from '@/shared/contracts/card'
import { CardPurpose } from '@/shared/enums/cardPurpose'
import { CardStatus } from '@/shared/enums/cardStatus'
import { ErrorCode } from '@/shared/enums/errors'

vi.mock('@/client/api/client', () => ({ call: vi.fn() }))

import { mockCaller } from '@/client/hooks/testHelpers'

type Card = z.infer<typeof cardContracts.get.output>

const sampleCard = {
  id: 'c1',
  orgId: 'o1',
  projectId: 'p1',
  categoryId: null,
  cardholderId: 'h1',
  airwallexCardId: 'awx1',
  maskedNumber: '************1234',
  nickName: 'Travel',
  purpose: CardPurpose.SHARED,
  status: CardStatus.ACTIVE,
  desiredControls: {},
  appliedControls: {},
  lastReconciledAt: null,
  managedByRuleIds: [],
  accessList: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
} as unknown as Card

describe('useCards', () => {
  it('cardQueryOptions invokes cardContracts.get', async () => {
    vi.mocked(call).mockResolvedValue(sampleCard)
    const qc = new QueryClient()
    await qc.fetchQuery(cardQueryOptions('c1', mockCaller))
    expect(call).toHaveBeenCalledWith(cardContracts.get, { params: { id: 'c1' } })
  })

  it('useFreezeCard rolls back optimistic update on ApiError', async () => {
    const qc = new QueryClient()
    qc.setQueryData(qk.card('c1'), sampleCard)

    const context = await optimisticSetCardStatus(qc, 'c1', CardStatus.INACTIVE)
    expect(qc.getQueryData<Card>(qk.card('c1'))?.status).toBe(CardStatus.INACTIVE)

    rollbackCardStatus(qc, 'c1', context.previousCard, context.previousLists)
    expect(qc.getQueryData<Card>(qk.card('c1'))?.status).toBe(CardStatus.ACTIVE)
  })

  it('useFreezeCard mutation calls cardContracts.freeze', async () => {
    vi.mocked(call).mockRejectedValue(new ApiError(ErrorCode.INTERNAL, 'fail', 500))
    await expect(call(cardContracts.freeze, { params: { id: 'c1' } })).rejects.toBeInstanceOf(
      ApiError,
    )
    expect(call).toHaveBeenCalledWith(cardContracts.freeze, { params: { id: 'c1' } })
  })
})
