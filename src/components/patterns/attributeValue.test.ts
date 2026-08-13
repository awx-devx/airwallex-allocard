import { describe, expect, it } from 'vitest'
import { attributeIsStale, formatAttributeLiteral } from '@/components/patterns/attributeValueMap'

const now = new Date('2026-08-14T10:55:00.000Z')

describe('attributeValue', () => {
  it('null ttl is never stale', () => {
    expect(attributeIsStale('2026-08-14T09:00:00.000Z', null, now)).toBe(false)
  })

  it('inside window is fresh', () => {
    expect(attributeIsStale('2026-08-14T10:50:00.000Z', 900, now)).toBe(false)
  })

  it('expired is stale', () => {
    expect(attributeIsStale('2026-08-14T09:00:00.000Z', 900, now)).toBe(true)
  })

  it('renders literals', () => {
    expect(formatAttributeLiteral(3.2, 'x')).toBe('3.2 x')
    expect(formatAttributeLiteral(true)).toBe('Yes')
    expect(formatAttributeLiteral(false)).toBe('No')
    expect(formatAttributeLiteral(null)).toBe('—')
  })
})
