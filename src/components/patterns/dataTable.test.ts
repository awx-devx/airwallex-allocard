import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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

describe('DataTable panel', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/patterns/DataTable.tsx'), 'utf8')

  it('sits in a bordered card panel and scrolls inside', () => {
    expect(src).toContain('data-slot="data-table"')
    expect(src).toContain('rounded-lg border border-border bg-card')
    expect(src).toContain('overflow-x-auto')
    expect(src).not.toMatch(/\bsm:/)
    expect(src).not.toMatch(/\blg:/)
  })
})
