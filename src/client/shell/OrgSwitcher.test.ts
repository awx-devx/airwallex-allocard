import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('OrgSwitcher', () => {
  const src = readFileSync(join(process.cwd(), 'src/client/shell/OrgSwitcher.tsx'), 'utf8')

  it('has no Organisation label; collapsed rail uses an initials Avatar', () => {
    expect(src).not.toContain("from '@/components/ui/label'")
    expect(src).not.toMatch(/>\s*Organisation\s*</)
    expect(src).toContain("from '@/components/ui/avatar'")
    expect(src).toContain('<Avatar')
    expect(src).toContain('aria-label={activeName}')
    expect(src).toContain('hover:bg-accent')
    expect(src).toContain('group-data-[expanded=false]/sidenav:[&_[data-slot=select-value]]:hidden')
  })
})
