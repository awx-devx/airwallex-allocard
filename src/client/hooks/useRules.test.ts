import { describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { call } from '@/client/api/client'
import { pageNextParam, rulesQueryOptions } from '@/client/hooks/useRules'
import { ruleContracts } from '@/shared/contracts/rule'

vi.mock('@/client/api/client', () => ({ call: vi.fn() }))

import { mockCaller } from '@/client/hooks/testHelpers'

describe('useRules', () => {
  it('rulesQueryOptions invokes ruleContracts.list', async () => {
    vi.mocked(call).mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 })
    const qc = new QueryClient()
    await qc.fetchQuery(rulesQueryOptions(undefined, mockCaller))
    expect(call).toHaveBeenCalledWith(ruleContracts.list, { input: undefined })
  })

  it('useSimulateRules mutation calls ruleContracts.simulate without caching', async () => {
    const qc = new QueryClient()
    const setQueryData = vi.spyOn(qc, 'setQueryData')
    vi.mocked(call).mockResolvedValue({ runs: [], cardDiffs: [], conflicts: [] })
    await call(ruleContracts.simulate, { input: { projectId: 'p1' } })
    expect(call).toHaveBeenCalledWith(ruleContracts.simulate, { input: { projectId: 'p1' } })
    expect(setQueryData).not.toHaveBeenCalled()
  })

  it('pageNextParam advances while pages remain', () => {
    expect(pageNextParam({ items: [], page: 1, pageSize: 20, total: 50 })).toBe(2)
    expect(pageNextParam({ items: [], page: 3, pageSize: 20, total: 50 })).toBeUndefined()
  })
})
