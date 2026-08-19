import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('SubNav', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/patterns/SubNav.tsx'), 'utf8')

  it('is a segmented strip, not ghost buttons', () => {
    expect(src).toContain('bg-muted')
    expect(src).toContain('item.active')
    expect(src).toContain('bg-card text-foreground')
    expect(src).not.toContain('buttonVariants')
    expect(src).not.toContain('ghost')
    expect(src).not.toMatch(/\bsm:/)
    expect(src).not.toMatch(/\blg:/)
  })
})
