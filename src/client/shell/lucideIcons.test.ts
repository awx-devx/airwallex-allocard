import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Lucide chrome and pattern icons', () => {
  const root = process.cwd()

  it('SideNav looks up navIcon and marks decorative SVGs aria-hidden', () => {
    const src = readFileSync(join(root, 'src/client/shell/SideNav.tsx'), 'utf8')
    expect(src).toContain('navIcon(item.href)')
    expect(src).toContain('aria-hidden')
    expect(src).toContain('truncate')
    expect(src).not.toMatch(/icon:/)
  })

  it('AppShell Menu keeps the word Menu next to MenuIcon', () => {
    const src = readFileSync(join(root, 'src/client/shell/AppShell.tsx'), 'utf8')
    expect(src).toContain('MenuIcon')
    expect(src).toMatch(/<MenuIcon[^/]*\/>\s*Menu/)
    expect(src).toContain("{ href: '/projects', label: 'Projects' }")
    expect(src).toContain("{ href: '/cards', label: 'Cards' }")
  })

  it('Alert injects a variant icon and skips when a child SVG already exists', () => {
    const src = readFileSync(join(root, 'src/components/ui/alert.tsx'), 'utf8')
    expect(src).toContain('ALERT_ICONS')
    expect(src).toContain('alertHasSvgChild')
    expect(src).toContain('<Icon aria-hidden />')
    expect(src).toContain('InfoIcon')
    expect(src).toContain('CircleAlertIcon')
  })

  it('EmptyState defaults to InboxIcon; ErrorState Retry uses RefreshCwIcon', () => {
    const empty = readFileSync(join(root, 'src/components/patterns/EmptyState.tsx'), 'utf8')
    expect(empty).toContain('InboxIcon')
    expect(empty).toContain('size-8')
    expect(empty).toContain('aria-hidden')
    const error = readFileSync(join(root, 'src/components/patterns/ErrorState.tsx'), 'utf8')
    expect(error).toContain('CircleAlertIcon')
    expect(error).toContain('RefreshCwIcon')
    expect(error).toContain('aria-hidden')
  })
})
