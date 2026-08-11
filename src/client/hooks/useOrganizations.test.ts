import { describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { call } from '@/client/api/client'
import { organizationQueryOptions } from '@/client/hooks/useOrganizations'
import { organizationContracts } from '@/shared/contracts/organization'

vi.mock('@/client/api/client', () => ({ call: vi.fn() }))

import { mockCaller } from '@/client/hooks/testHelpers'

describe('useOrganizations', () => {
  it('organizationQueryOptions invokes organizationContracts.get', async () => {
    vi.mocked(call).mockResolvedValue({
      id: 'o1',
      name: 'Acme',
      slug: 'acme',
      country: 'US',
      baseCurrency: 'USD',
      costCentres: [],
      settings: { defaultApprovalPolicy: null, notifications: {} },
      airwallexAccountId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    const qc = new QueryClient()
    await qc.fetchQuery(organizationQueryOptions('o1', mockCaller))
    expect(call).toHaveBeenCalledWith(organizationContracts.get, { params: { id: 'o1' } })
  })

  it('useCreateOrganization mutation calls organizationContracts.create', async () => {
    vi.mocked(call).mockResolvedValue({ id: 'o1' })
    await call(organizationContracts.create, {
      input: { name: 'Acme', country: 'US', baseCurrency: 'USD', costCentres: [] },
    })
    expect(call).toHaveBeenCalledWith(organizationContracts.create, {
      input: { name: 'Acme', country: 'US', baseCurrency: 'USD', costCentres: [] },
    })
  })
})
