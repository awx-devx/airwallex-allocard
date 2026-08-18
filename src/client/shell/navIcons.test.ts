import { describe, expect, it } from 'vitest'
import { SETTINGS_NAV } from '@/client/lib/access'
import { BUDGET_NAV } from '@/client/lib/budget'
import { WORKSPACE_TAB_HREFS } from '@/client/lib/projects'
import { CHROME_TAB_ICONS, NAV_ICONS, chromeTabIcon, navIcon } from '@/client/shell/navIcons'

const SIDE_NAV_HREFS = [
  '/dashboard',
  '/projects',
  '/cards',
  '/requests',
  '/approvals',
  '/activity',
  '/transactions',
  '/receipts',
  '/automation',
  '/reports',
  '/audit',
  '/settings/roles',
  '/settings/access-reviews',
  '/settings/rules',
  '/settings/attributes',
]

describe('navIcons', () => {
  it('maps every SideNav href', () => {
    expect(Object.keys(NAV_ICONS).sort()).toEqual([...SIDE_NAV_HREFS].sort())
    for (const href of SIDE_NAV_HREFS) {
      expect(navIcon(href)).toBeDefined()
    }
  })

  it('maps SETTINGS_NAV hrefs with the same icons as SideNav', () => {
    for (const item of SETTINGS_NAV) {
      expect(navIcon(item.href)).toBe(NAV_ICONS[item.href])
    }
  })

  it('maps workspace tabs and budget chrome labels', () => {
    for (const item of WORKSPACE_TAB_HREFS) {
      expect(chromeTabIcon(item.tab)).toBeDefined()
    }
    for (const item of BUDGET_NAV) {
      expect(chromeTabIcon(item.label)).toBeDefined()
    }
    expect(Object.keys(CHROME_TAB_ICONS).sort()).toEqual(
      [
        'Activity',
        'Budget',
        'Cards',
        'Categories',
        'Controls',
        'History',
        'Overview',
        'People',
        'Requests',
      ].sort(),
    )
  })
})
