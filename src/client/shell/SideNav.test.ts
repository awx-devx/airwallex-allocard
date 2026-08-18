import { describe, expect, it } from 'vitest'
import { activeNavHref, isNavHrefActive } from '@/client/shell/navActive'

const NAV = [
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
] as const

describe('activeNavHref', () => {
  it('selects a section for nested paths', () => {
    expect(isNavHrefActive('/projects/adad/adad/adaa', '/projects')).toBe(true)
    expect(activeNavHref('/projects/adad/adad/adaa', NAV)).toBe('/projects')
    expect(activeNavHref('/cards/card_1/reveal', NAV)).toBe('/cards')
    expect(activeNavHref('/settings/rules/rule_1/simulate', NAV)).toBe('/settings/rules')
    expect(activeNavHref('/reports/organization', NAV)).toBe('/reports')
  })

  it('does not treat a sibling settings href as active', () => {
    expect(activeNavHref('/settings/roles', NAV)).toBe('/settings/roles')
    expect(isNavHrefActive('/settings/rules', '/settings/roles')).toBe(false)
    expect(isNavHrefActive('/projects', '/project')).toBe(false)
  })

  it('matches the exact href', () => {
    expect(activeNavHref('/dashboard', NAV)).toBe('/dashboard')
    expect(activeNavHref('/approvals', NAV)).toBe('/approvals')
  })
})
