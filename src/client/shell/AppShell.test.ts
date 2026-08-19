import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('AppShell viewport lock', () => {
  const root = process.cwd()
  const shell = readFileSync(join(root, 'src/client/shell/AppShell.tsx'), 'utf8')
  const header = readFileSync(join(root, 'src/client/shell/AppHeader.tsx'), 'utf8')

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
    expect(shell).toMatch(/<main className="[^"]*\bflex-col\b/)
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

  it('header is a frosted strip, not a card island', () => {
    expect(header).toContain('shrink-0')
    expect(header).toContain('border-b')
    expect(header).toContain('bg-background/95')
    expect(header).toContain('backdrop-blur-xl')
    expect(header).toContain('md:hidden')
    expect(header).toContain('AppBreadcrumbs')
    expect(header).not.toContain('sticky')
    expect(header).not.toContain('ScrollArea')
    expect(header).not.toContain('laser-cap')
    expect(header).not.toContain('rounded-lg')
    expect(header).not.toContain('shadow-[var(--shadow-elevated)]')
    expect(shell).toContain('<AppHeader')
    expect(shell).toContain('bg-sidebar')
    expect(shell).not.toContain('ProjectContext')
  })

  it('breadcrumbs compose F3 Breadcrumb and Next Link', () => {
    const crumbs = readFileSync(join(root, 'src/client/shell/AppBreadcrumbs.tsx'), 'utf8')
    expect(crumbs).toContain('crumbsForPathname')
    expect(crumbs).toContain('BreadcrumbLink')
    expect(crumbs).toContain('asChild')
    expect(crumbs).toContain('BreadcrumbPage')
    expect(crumbs).toContain('title={crumb.label}')
    expect(crumbs).not.toMatch(/\bsm:/)
    expect(header).not.toMatch(/\bsm:/)
    expect(header).not.toMatch(/\blg:/)
  })

  it('AppShellFrame fills the project name from useProject when the path has an id', () => {
    const frame = readFileSync(join(root, 'src/client/shell/AppShellFrame.tsx'), 'utf8')
    expect(frame).toContain('projectIdFromPathname')
    expect(frame).toContain('useProject')
    expect(frame).toContain('orgRole: m.orgRole')
    expect(frame).not.toContain('project={null}')
  })

  it('walkers sit behind the scrolling main column', () => {
    expect(shell).toContain('<WalkCrowd />')
    expect(shell).toContain('relative flex min-h-0 min-w-0 flex-1 flex-col')
    expect(shell).toMatch(/<main className="[^"]*\bz-1\b/)
  })
})
