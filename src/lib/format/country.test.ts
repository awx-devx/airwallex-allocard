import { describe, expect, it } from 'vitest'
import { countryName } from '@/lib/format/country'

describe('lib/format/country', () => {
  it('resolves known ISO2 codes', () => {
    expect(countryName('US', 'en')).toBe('United States')
    expect(countryName('GB', 'en')).toBe('United Kingdom')
  })

  it('returns raw code for invalid input', () => {
    expect(countryName('USA')).toBe('USA')
    expect(countryName('')).toBe('')
  })
})
