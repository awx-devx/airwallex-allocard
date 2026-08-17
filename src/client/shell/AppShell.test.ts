import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('AppShell viewport lock', () => {
  const shell = readFileSync(join(process.cwd(), 'src/client/shell/AppShell.tsx'), 'utf8')

  it('locks chrome to the viewport; page and nav list scroll inside', () => {
    expect(shell).toMatch(/className="[^"]*\bh-dvh\b[^"]*\boverflow-hidden\b/)
    expect(shell).toMatch(/aside className="[^"]*\bhidden\b/)
    expect(shell).toMatch(/aside className="[^"]*\bmd:flex\b/)
    expect(shell).toMatch(/aside className="[^"]*\bw-56\b/)
    expect(shell).not.toContain('min-h-screen')
    expect(shell).not.toContain('sticky')
    expect(shell).not.toContain('ScrollArea')
    expect(shell).toMatch(/<main className="[^"]*\boverflow-y-auto\b/)
    const wrappedNav = [
      ...shell.matchAll(/overflow-y-auto overscroll-contain">\s*<SideNav items=\{items\} \/>/g),
    ]
    expect(wrappedNav).toHaveLength(2)
  })
})
