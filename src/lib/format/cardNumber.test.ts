import { describe, expect, it } from 'vitest'
import { formatMaskedCard } from '@/lib/format/cardNumber'

describe('lib/format/cardNumber', () => {
  it('trims masked numbers without altering digits', () => {
    expect(formatMaskedCard('  ************1234  ')).toBe('************1234')
  })

  it('passes through already-trimmed values', () => {
    expect(formatMaskedCard('****5678')).toBe('****5678')
  })
})
