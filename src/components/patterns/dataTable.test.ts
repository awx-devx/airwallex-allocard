import { describe, expect, it } from 'vitest'
import { nextSorting } from '@/components/patterns/dataTableSort'

describe('nextSorting', () => {
  it('cycles null → asc → desc → null', () => {
    expect(nextSorting(null, 'name')).toEqual({ id: 'name', direction: 'asc' })
    expect(nextSorting({ id: 'name', direction: 'asc' }, 'name')).toEqual({
      id: 'name',
      direction: 'desc',
    })
    expect(nextSorting({ id: 'name', direction: 'desc' }, 'name')).toBeNull()
  })

  it('starts asc when switching columns', () => {
    expect(nextSorting({ id: 'code', direction: 'desc' }, 'name')).toEqual({
      id: 'name',
      direction: 'asc',
    })
  })
})
