import { describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { call } from '@/client/api/client'
import { rolesQueryOptions } from '@/client/hooks/useMembers'
import { roleContracts } from '@/shared/contracts/role'

vi.mock('@/client/api/client', () => ({ call: vi.fn() }))

import { mockCaller } from '@/client/hooks/testHelpers'

describe('useMembers', () => {
  it('rolesQueryOptions invokes roleContracts.list', async () => {
    vi.mocked(call).mockResolvedValue([])
    const qc = new QueryClient()
    await qc.fetchQuery(rolesQueryOptions(mockCaller))
    expect(call).toHaveBeenCalledWith(roleContracts.list, undefined)
  })

  it('useCreateRole mutation calls roleContracts.create', async () => {
    vi.mocked(call).mockResolvedValue({ id: 'r1' })
    await call(roleContracts.create, {
      input: { name: 'Viewer', permissions: ['project.view'] },
    })
    expect(call).toHaveBeenCalledWith(roleContracts.create, {
      input: { name: 'Viewer', permissions: ['project.view'] },
    })
  })
})
