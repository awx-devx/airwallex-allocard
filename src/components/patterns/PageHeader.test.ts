import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('PageHeader', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/patterns/PageHeader.tsx'), 'utf8')

  it('puts kicker, title, status, and wrapping actions on one header row', () => {
    expect(src).toContain('flex-wrap')
    expect(src).toContain('kicker')
    expect(src).toContain('actions')
    expect(src).toContain('<h1')
    expect(src).not.toMatch(/\bsm:/)
    expect(src).not.toMatch(/\blg:/)
  })
})
