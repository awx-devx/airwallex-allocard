import { afterEach, describe, expect, it, vi } from 'vitest'
import { withActiveOrgId } from '@/client/hooks/useCall'

describe('withActiveOrgId', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('prefers explicit args.orgId', () => {
    expect(withActiveOrgId({ orgId: 'explicit', params: { id: '1' } }, 'active')).toEqual({
      orgId: 'explicit',
      params: { id: '1' },
    })
  })

  it('falls back to active org when args omit orgId', () => {
    expect(withActiveOrgId({ params: { id: '1' } }, 'active')).toEqual({
      params: { id: '1' },
      orgId: 'active',
    })
  })

  it('omits orgId when neither source has one', () => {
    expect(withActiveOrgId(undefined, null)).toEqual({ orgId: undefined })
  })
})
