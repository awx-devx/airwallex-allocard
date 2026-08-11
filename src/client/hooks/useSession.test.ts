import { describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { call } from '@/client/api/client'
import {
  meQueryOptions,
  onboardingStatusQueryOptions,
  permissionsQueryOptions,
} from '@/client/hooks/useSession'
import { authContracts } from '@/shared/contracts/auth'
import { mePermissionsContracts } from '@/shared/contracts/mePermissions'

vi.mock('@/client/api/client', () => ({ call: vi.fn() }))

import { mockCaller } from '@/client/hooks/testHelpers'

describe('useSession query options', () => {
  it('meQueryOptions invokes authContracts.me', async () => {
    vi.mocked(call).mockResolvedValue({
      user: { id: 'u1', email: 'a@b.co', name: 'A', createdAt: '2026-01-01T00:00:00.000Z' },
      memberships: [],
      onboarded: true,
    })
    const qc = new QueryClient()
    await qc.fetchQuery(meQueryOptions(mockCaller))
    expect(call).toHaveBeenCalledWith(authContracts.me, undefined)
  })

  it('permissionsQueryOptions invokes mePermissionsContracts.get', async () => {
    vi.mocked(call).mockResolvedValue({ projects: [] })
    const qc = new QueryClient()
    await qc.fetchQuery(permissionsQueryOptions(mockCaller))
    expect(call).toHaveBeenCalledWith(mePermissionsContracts.get, undefined)
  })

  it('onboardingStatusQueryOptions invokes authContracts.onboardingStatus', async () => {
    vi.mocked(call).mockResolvedValue({ onboarded: false, pendingInvites: [] })
    const qc = new QueryClient()
    await qc.fetchQuery(onboardingStatusQueryOptions(mockCaller))
    expect(call).toHaveBeenCalledWith(authContracts.onboardingStatus, undefined)
  })
})

describe('useUpdateMe mutation', () => {
  it('calls authContracts.updateMe with input', async () => {
    vi.mocked(call).mockResolvedValue({
      user: { id: 'u1', email: 'a@b.co', name: 'New', createdAt: '2026-01-01T00:00:00.000Z' },
      memberships: [],
      onboarded: true,
    })
    await call(authContracts.updateMe, { input: { name: 'New' } })
    expect(call).toHaveBeenCalledWith(authContracts.updateMe, { input: { name: 'New' } })
  })
})
