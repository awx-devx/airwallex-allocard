import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('AppShell viewport lock', () => {
  const shell = readFileSync(join(process.cwd(), 'src/client/shell/AppShell.tsx'), 'utf8')

  it('locks chrome to the viewport; page and nav list scroll inside', () => {
    expect(shell).toMatch(/className="[^"]*\bh-dvh\b[^"]*\boverflow-hidden\b/)
    expect(shell).toMatch(/aside className="[^"]*\bhidden\b/)
    expect(shell).toMatch(/aside className="[^"]*\bmd:flex\b/)
    expect(shell).toMatch(/aside className="[^"]*\bw-16\b/)
    expect(shell).toContain('data-[expanded=true]:w-56')
    expect(shell).not.toContain('min-h-screen')
    expect(shell).not.toContain('sticky')
    expect(shell).not.toContain('ScrollArea')
    expect(shell).toMatch(/<main className="[^"]*\boverflow-y-auto\b/)
    const wrappedNav = [
      ...shell.matchAll(/overflow-y-auto overscroll-contain">\s*<SideNav items=\{items\} \/>/g),
    ]
    expect(wrappedNav).toHaveLength(2)
  })

  it('desktop rail stays an icon column until hover, keyboard focus, or org menu', () => {
    expect(shell).toContain('group/sidenav')
    expect(shell).toContain("data-expanded={expanded ? 'true' : 'false'}")
    expect(shell).toContain('onPointerEnter')
    expect(shell).toContain('onPointerLeave={leaveRail}')
    expect(shell).toContain(':focus-visible')
    expect(shell).toContain('active.blur()')
    expect(shell).toContain('onFocusCapture')
    expect(shell).toContain('onBlurCapture')
    expect(shell).toContain('onOpenChange')
    expect(shell).toContain('absolute inset-y-0 left-0')
    expect(shell).toMatch(/aside className="[^"]*\bhidden\b[^"]*\bw-16\b/)
  })
})
