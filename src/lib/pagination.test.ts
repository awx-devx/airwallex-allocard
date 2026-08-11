import { describe, expect, it } from 'vitest'
import { cursorNextParam, pageNextParam } from '@/lib/pagination'

describe('lib/pagination', () => {
  it('cursorNextParam returns nextCursor when present', () => {
    expect(cursorNextParam({ nextCursor: 'abc' })).toBe('abc')
    expect(cursorNextParam({ nextCursor: null })).toBeUndefined()
  })

  it('pageNextParam advances while pages remain', () => {
    expect(pageNextParam({ page: 1, pageSize: 20, total: 50 })).toBe(2)
    expect(pageNextParam({ page: 3, pageSize: 20, total: 50 })).toBeUndefined()
  })
})
