import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('OrgSwitcher', () => {
  const src = readFileSync(join(process.cwd(), 'src/client/shell/OrgSwitcher.tsx'), 'utf8')

  it('has no Organisation label; collapsed rail hides name and role, keeps the mark', () => {
    expect(src).not.toContain("from '@/components/ui/label'")
    expect(src).not.toMatch(/>\s*Organisation\s*</)
    expect(src).not.toContain("from '@/components/ui/avatar'")
    expect(src).toContain('aria-label={activeName}')
    expect(src).toContain('bg-sidebar-primary/18')
    expect(src).toContain('text-sidebar-primary')
    expect(src).toContain('orgRoleLabel')
    expect(src).toContain('hover:bg-sidebar-accent')
    expect(src).toContain('group-data-[expanded=false]/sidenav:hidden')
    expect(src).toContain('group-data-[expanded=false]/sidenav:[&_svg]:hidden')
    expect(src).toContain('position="popper"')
    expect(src).toContain('side="right"')
  })
})
