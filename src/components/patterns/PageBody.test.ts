import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('PageFill / PageFlow', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/patterns/PageBody.tsx'), 'utf8')

  it('fills leftover main height without clipping; the page may still scroll', () => {
    expect(src).toContain('function PageFill')
    expect(src).toContain('function PageFlow')
    expect(src).toContain('min-h-full')
    expect(src).not.toContain('flex-1')
    expect(src).not.toContain('overflow-hidden')
    expect(src).not.toContain('overflow-y-auto')
    expect(src).not.toContain('min-h-screen')
    expect(src).not.toContain('sticky')
    expect(src).not.toMatch(/\bsm:/)
    expect(src).not.toMatch(/\blg:/)
  })
})
