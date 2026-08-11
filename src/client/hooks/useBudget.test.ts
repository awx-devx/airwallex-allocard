import { describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { call } from '@/client/api/client'
import { budgetQueryOptions } from '@/client/hooks/useBudget'
import { budgetContracts } from '@/shared/contracts/budget'

vi.mock('@/client/api/client', () => ({ call: vi.fn() }))

import { mockCaller } from '@/client/hooks/testHelpers'

describe('useBudget', () => {
  it('budgetQueryOptions invokes budgetContracts.get', async () => {
    vi.mocked(call).mockResolvedValue({ id: 'b1' })
    const qc = new QueryClient()
    await qc.fetchQuery(budgetQueryOptions('p1', mockCaller))
    expect(call).toHaveBeenCalledWith(budgetContracts.get, { params: { id: 'p1' } })
  })

  it('useSetBudget mutation calls budgetContracts.put', async () => {
    vi.mocked(call).mockResolvedValue({ id: 'b1' })
    await call(budgetContracts.put, {
      params: { id: 'p1' },
      input: { currency: 'USD', approvedAmount: 100_00 },
    })
    expect(call).toHaveBeenCalledWith(budgetContracts.put, {
      params: { id: 'p1' },
      input: { currency: 'USD', approvedAmount: 100_00 },
    })
  })
})
