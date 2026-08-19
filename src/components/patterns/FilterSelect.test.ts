import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('FilterSelect', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/patterns/FilterSelect.tsx'), 'utf8')

  it('always shows a field label and a descriptive all option', () => {
    expect(src).toContain('<Label')
    expect(src).toContain('allLabel')
    expect(src).toContain('FILTER_ALL')
    expect(src).toContain('min-w-40')
    expect(src).toContain('function FilterBar')
    expect(src).toContain('items-end')
    expect(src).not.toContain('size="sm"')
    expect(src).not.toMatch(/\bsm:/)
    expect(src).not.toMatch(/\blg:/)
  })
})
