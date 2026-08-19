import { afterEach, describe, expect, it, vi } from 'vitest'
import { orgIdForSession, withActiveOrgId } from '@/client/hooks/useCall'

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

describe('orgIdForSession', () => {
  it('keeps the stored org while session is loading', () => {
    expect(orgIdForSession('org_seed', { status: 'loading' })).toBe('org_seed')
  })

  it('keeps the stored org when onboarded', () => {
    expect(orgIdForSession('org_seed', { status: 'authenticated', onboarded: true })).toBe(
      'org_seed',
    )
  })

  it('drops the stored org when signed out', () => {
    expect(orgIdForSession('org_seed', { status: 'unauthenticated' })).toBeNull()
  })

  it('drops the stored org when authenticated but not onboarded', () => {
    expect(orgIdForSession('org_seed', { status: 'authenticated', onboarded: false })).toBeNull()
  })
})
