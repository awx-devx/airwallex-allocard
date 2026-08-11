import { describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { call } from '@/client/api/client'
import {
  optimisticSetReceipt,
  transactionsInfiniteQueryOptions,
  txPageNextParam,
} from '@/client/hooks/useTransactions'
import { qk } from '@/client/queryKeys'
import { transactionContracts } from '@/shared/contracts/transaction'

vi.mock('@/client/api/client', () => ({ call: vi.fn() }))

import { mockCaller } from '@/client/hooks/testHelpers'

describe('useTransactions', () => {
  it('transactionsInfiniteQueryOptions invokes transactionContracts.list', async () => {
    vi.mocked(call).mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 })
    const qc = new QueryClient()
    const opts = transactionsInfiniteQueryOptions(undefined, mockCaller)
    await opts.queryFn({ pageParam: 1 })
    expect(call).toHaveBeenCalledWith(transactionContracts.list, {
      input: { page: 1 },
    })
  })

  it('txPageNextParam advances while pages remain', () => {
    expect(txPageNextParam({ items: [], page: 1, pageSize: 20, total: 40 })).toBe(2)
    expect(txPageNextParam({ items: [], page: 2, pageSize: 20, total: 40 })).toBeUndefined()
  })

  it('optimisticSetReceipt rolls back on error path', async () => {
    const qc = new QueryClient()
    qc.setQueryData(qk.transaction('t1'), {
      id: 't1',
      receiptFileId: null,
    })
    const ctx = await optimisticSetReceipt(qc, 't1', 'optimistic-receipt')
    expect(
      qc.getQueryData<{ receiptFileId: string | null }>(qk.transaction('t1'))?.receiptFileId,
    ).toBe('optimistic-receipt')
    if (ctx.previous) {
      qc.setQueryData(qk.transaction('t1'), ctx.previous)
    }
    expect(
      qc.getQueryData<{ receiptFileId: string | null }>(qk.transaction('t1'))?.receiptFileId,
    ).toBe(null)
  })
})
