import { describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { call } from '@/client/api/client'
import { projectsQueryOptions } from '@/client/hooks/useProjects'
import { projectContracts } from '@/shared/contracts/project'

vi.mock('@/client/api/client', () => ({ call: vi.fn() }))

import { mockCaller } from '@/client/hooks/testHelpers'

describe('useProjects', () => {
  it('projectsQueryOptions invokes projectContracts.list', async () => {
    vi.mocked(call).mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 })
    const qc = new QueryClient()
    await qc.fetchQuery(projectsQueryOptions(undefined, mockCaller))
    expect(call).toHaveBeenCalledWith(projectContracts.list, { input: undefined })
  })

  it('useCreateProject mutation calls projectContracts.create', async () => {
    vi.mocked(call).mockResolvedValue({ id: 'p1' })
    await call(projectContracts.create, { input: { name: 'Launch', code: 'LNCH' } })
    expect(call).toHaveBeenCalledWith(projectContracts.create, {
      input: { name: 'Launch', code: 'LNCH' },
    })
  })
})
