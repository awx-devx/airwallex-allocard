import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('ThemeToggle', () => {
  it('is a three-step light / system / dark control, not a binary Switch', () => {
    const src = readFileSync(join(process.cwd(), 'src/client/shell/ThemeToggle.tsx'), 'utf8')
    expect(src).toContain("value: 'light'")
    expect(src).toContain("value: 'system'")
    expect(src).toContain("value: 'dark'")
    expect(src).toContain('role="radiogroup"')
    expect(src).toContain('aria-label={item.label}')
    expect(src).not.toContain('<span')
    expect(src).not.toContain("from '@/components/ui/switch'")
  })

  it('sits in AppShell header chrome on every width', () => {
    const header = readFileSync(join(process.cwd(), 'src/client/shell/AppHeader.tsx'), 'utf8')
    const shell = readFileSync(join(process.cwd(), 'src/client/shell/AppShell.tsx'), 'utf8')
    expect(header).toContain('<ThemeToggle />')
    expect(shell).toContain('<AppHeader')
    expect(shell).toMatch(/aside className="[^"]*\bhidden\b/)
    expect(shell).toMatch(/aside className="[^"]*\bmd:flex\b/)
  })
})
