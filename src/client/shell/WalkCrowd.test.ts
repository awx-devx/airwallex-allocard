import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('WalkCrowd', () => {
  const src = readFileSync(join(process.cwd(), 'src/client/shell/WalkCrowd.tsx'), 'utf8')
  const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')

  it('does not render when the user prefers reduced motion', () => {
    expect(src).toContain("matchMedia('(prefers-reduced-motion: reduce)')")
    expect(src).toContain('if (reduce) return null')
  })

  it('crosses with translate3d, not left', () => {
    expect(css).toContain('translate3d')
    expect(css).toContain('@keyframes walk-cross-ltr')
    expect(css).not.toMatch(/@keyframes walk-cross[\s\S]*?\bleft\s*:/)
    expect(src).not.toMatch(/animate.*left/)
  })
})
