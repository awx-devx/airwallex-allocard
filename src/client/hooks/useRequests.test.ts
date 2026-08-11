import { describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { call } from '@/client/api/client'
import { approvalCountQueryOptionsFactory } from '@/client/hooks/useRequests'
import { purchaseRequestContracts } from '@/shared/contracts/purchaseRequest'

vi.mock('@/client/api/client', () => ({ call: vi.fn() }))

import { mockCaller } from '@/client/hooks/testHelpers'

describe('useRequests', () => {
  it('approvalCountQueryOptionsFactory invokes purchaseRequestContracts.approvalsCount', async () => {
    vi.mocked(call).mockResolvedValue({ count: 3 })
    const qc = new QueryClient()
    await qc.fetchQuery(approvalCountQueryOptionsFactory(mockCaller))
    expect(call).toHaveBeenCalledWith(purchaseRequestContracts.approvalsCount, undefined)
  })

  it('useDecideRequest mutation calls purchaseRequestContracts.decide', async () => {
    vi.mocked(call).mockResolvedValue({ id: 'r1', projectId: 'p1' })
    await call(purchaseRequestContracts.decide, {
      params: { id: 'r1' },
      input: { decision: 'APPROVE' },
    })
    expect(call).toHaveBeenCalledWith(purchaseRequestContracts.decide, {
      params: { id: 'r1' },
      input: { decision: 'APPROVE' },
    })
  })
})
