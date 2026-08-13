import { describe, expect, it } from 'vitest'
import { matchesConfirmPhrase } from '@/components/patterns/matchesConfirmPhrase'

describe('matchesConfirmPhrase', () => {
  it('matches CLOSE exactly', () => {
    expect(matchesConfirmPhrase('CLOSE', 'CLOSE')).toBe(true)
  })

  it('is case-sensitive', () => {
    expect(matchesConfirmPhrase('close', 'CLOSE')).toBe(false)
  })

  it('trims both sides', () => {
    expect(matchesConfirmPhrase(' CLOSE ', 'CLOSE')).toBe(true)
  })
})
