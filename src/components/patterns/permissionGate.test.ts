import { describe, expect, it } from 'vitest'
import { decidePermissionGateView } from '@/components/patterns/decidePermissionGate'

describe('decidePermissionGateView', () => {
  it('renders children when allowed', () => {
    expect(decidePermissionGateView({ allowed: true, hasFallback: false })).toBe('children')
  })

  it('wraps fallback when denied and fallback is provided', () => {
    expect(decidePermissionGateView({ allowed: false, hasFallback: true })).toBe('tooltip-fallback')
  })

  it('wraps children when denied without fallback', () => {
    expect(decidePermissionGateView({ allowed: false, hasFallback: false })).toBe(
      'tooltip-children',
    )
  })
})
