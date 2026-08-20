import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('DoodleBackdrop', () => {
  const root = process.cwd()
  const src = readFileSync(join(root, 'src/client/shell/DoodleBackdrop.tsx'), 'utf8')
  const css = readFileSync(join(root, 'src/app/globals.css'), 'utf8')

  it('is a decorative mask over the doodle SVG, tinted from tokens', () => {
    expect(src).toContain('className="doodle-backdrop"')
    expect(src).toContain('aria-hidden')
    expect(src).toContain("variant: 'auth' | 'app'")
    expect(css).toContain("url('/images/allocard-doodles.svg')")
    expect(css).toContain('hsl(var(--laser)')
    expect(css).toContain('var(--muted-foreground)')
    expect(css).not.toMatch(/\.doodle-backdrop[\s\S]{0,800}#[0-9A-Fa-f]{3,8}/)
  })

  it('does not keep the walking stick figures', () => {
    expect(css).not.toContain('walk-crowd')
    expect(css).not.toContain('@keyframes walk-cross-ltr')
  })
})
