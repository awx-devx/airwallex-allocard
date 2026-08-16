import { describe, expect, it, vi } from 'vitest'
import { call } from '@/client/api/client'
import { downloadExport } from '@/client/api/download'
import {
  activityInfiniteQueryOptions,
  cursorNextParam,
  projectActivityInfiniteQueryOptions,
} from '@/client/hooks/useReports'
import { qk } from '@/client/queryKeys'
import { activityContracts } from '@/shared/contracts/activity'

vi.mock('@/client/api/client', () => ({ call: vi.fn() }))
vi.mock('@/client/api/download', () => ({ downloadExport: vi.fn() }))

import { mockCaller } from '@/client/hooks/testHelpers'

describe('useReports', () => {
  it('activityInfiniteQueryOptions invokes activityContracts.list with cursor', async () => {
    vi.mocked(call).mockResolvedValue({ items: [], nextCursor: 'abc' })
    const opts = activityInfiniteQueryOptions(undefined, mockCaller)
    await opts.queryFn({ pageParam: undefined })
    expect(call).toHaveBeenCalledWith(activityContracts.list, { input: { cursor: undefined } })
  })

  it('activity queryKeys include filter ?? {}', () => {
    expect(activityInfiniteQueryOptions(undefined, mockCaller).queryKey).toEqual([
      ...qk.activity(),
      {},
    ])
    expect(activityInfiniteQueryOptions({ limit: 20 }, mockCaller).queryKey).toEqual([
      ...qk.activity(),
      { limit: 20 },
    ])
    expect(projectActivityInfiniteQueryOptions('p1', undefined, mockCaller).queryKey).toEqual([
      ...qk.activity('p1'),
      {},
    ])
    expect(projectActivityInfiniteQueryOptions('p1', { limit: 20 }, mockCaller).queryKey).toEqual([
      ...qk.activity('p1'),
      { limit: 20 },
    ])
  })

  it('cursorNextParam returns nextCursor when present', () => {
    expect(cursorNextParam({ nextCursor: 'abc' })).toBe('abc')
    expect(cursorNextParam({ nextCursor: null })).toBeUndefined()
  })

  it('export helpers call downloadExport not call', async () => {
    vi.mocked(call).mockClear()
    vi.mocked(downloadExport).mockResolvedValue(undefined)
    await downloadExport('budget', { projectId: 'p1' })
    expect(downloadExport).toHaveBeenCalledWith('budget', { projectId: 'p1' })
    expect(call).not.toHaveBeenCalled()
  })
})
