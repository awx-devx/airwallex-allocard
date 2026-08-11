import { describe, expect, it } from 'vitest'
import {
  daysRemaining,
  formatDate,
  formatDateTime,
  formatRange,
  formatRelative,
  isStale,
} from '@/lib/dates'

const NOW = new Date('2026-08-10T12:00:00.000Z')

describe('lib/dates', () => {
  it('formatDate / formatDateTime use en-GB by default', () => {
    expect(formatDate('2026-08-01T00:00:00.000Z')).toMatch(/1 Aug 2026/)
    expect(formatDateTime('2026-08-01T15:30:00.000Z')).toMatch(/1 Aug 2026/)
  })

  it('formatRelative uses Intl.RelativeTimeFormat', () => {
    const fifteenMinAgo = new Date(NOW.getTime() - 15 * 60_000).toISOString()
    expect(formatRelative(fifteenMinAgo, NOW)).toMatch(/15 minutes ago/)
  })

  it('formatRange uses an en dash and omits start year when same year', () => {
    expect(formatRange('2026-08-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z')).toBe(
      '1 Aug – 31 Dec 2026',
    )
  })

  it('daysRemaining is whole UTC day difference', () => {
    expect(daysRemaining('2026-08-15T23:00:00.000Z', NOW)).toBe(5)
    expect(daysRemaining('2026-08-05T00:00:00.000Z', NOW)).toBe(-5)
  })

  it('isStale matches server attribute resolve boundaries', () => {
    expect(isStale('2020-01-01T00:00:00.000Z', null, NOW)).toBe(false)
    expect(isStale('2026-08-10T00:00:00.000Z', 900, NOW)).toBe(true)
    expect(isStale('2026-08-10T23:59:00.000Z', 900, NOW)).toBe(false)
  })
})
