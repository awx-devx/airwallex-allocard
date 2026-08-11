import { describe, expect, it } from 'vitest'
import { normaliseMerchantName } from '@/lib/format/merchant'

describe('lib/format/merchant', () => {
  it('trims and collapses whitespace', () => {
    expect(normaliseMerchantName('  ACME   STORE  ')).toBe('Acme Store')
  })

  it('title-cases ALL-CAPS tokens longer than 3 chars', () => {
    expect(normaliseMerchantName('STARBUCKS COFFEE')).toBe('Starbucks Coffee')
  })

  it('leaves short ALL-CAPS tokens unchanged', () => {
    expect(normaliseMerchantName('ABC SHOP')).toBe('ABC Shop')
  })
})
