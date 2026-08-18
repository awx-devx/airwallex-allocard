import { describe, expect, it } from 'vitest'
import { crumbsForPathname, projectIdFromPathname } from '@/client/shell/navCrumbs'

describe('crumbsForPathname', () => {
  it('maps a top-level section', () => {
    expect(crumbsForPathname('/dashboard')).toEqual([{ href: '/dashboard', label: 'Dashboard' }])
  })

  it('walks a project nested trail and prefers the project name', () => {
    expect(crumbsForPathname('/projects/p1/budget/categories')).toEqual([
      { href: '/projects', label: 'Projects' },
      { href: '/projects/p1', label: 'Project' },
      { href: '/projects/p1/budget', label: 'Budget' },
      { href: '/projects/p1/budget/categories', label: 'Categories' },
    ])
    expect(
      crumbsForPathname('/projects/p1/budget/categories', { projectName: 'APAC Launch' }),
    ).toEqual([
      { href: '/projects', label: 'Projects' },
      { href: '/projects/p1', label: 'APAC Launch' },
      { href: '/projects/p1/budget', label: 'Budget' },
      { href: '/projects/p1/budget/categories', label: 'Categories' },
    ])
  })

  it('does not treat /projects/new as a project id', () => {
    expect(crumbsForPathname('/projects/new')).toEqual([
      { href: '/projects', label: 'Projects' },
      { href: '/projects/new', label: 'New' },
    ])
  })

  it('maps card explain without showing the raw id', () => {
    expect(crumbsForPathname('/cards/c1/explain')).toEqual([
      { href: '/cards', label: 'Cards' },
      { href: '/cards/c1', label: 'Card' },
      { href: '/cards/c1/explain', label: 'Why this limit?' },
    ])
  })

  it('skips settings so crumbs do not link to a 404', () => {
    expect(crumbsForPathname('/settings/rules/r1/simulate')).toEqual([
      { href: '/settings/rules', label: 'Rules' },
      { href: '/settings/rules/r1', label: 'Rule' },
      { href: '/settings/rules/r1/simulate', label: 'Simulate' },
    ])
  })

  it('skips report so /projects/:id/report/final does not 404', () => {
    expect(crumbsForPathname('/projects/p1/report/final', { projectName: 'APAC Launch' })).toEqual([
      { href: '/projects', label: 'Projects' },
      { href: '/projects/p1', label: 'APAC Launch' },
      { href: '/projects/p1/report/final', label: 'Final report' },
    ])
  })

  it('skips reports/project and uses the project name', () => {
    expect(crumbsForPathname('/reports/project/p1')).toEqual([
      { href: '/reports', label: 'Reports' },
      { href: '/reports/project/p1', label: 'Project' },
    ])
    expect(crumbsForPathname('/reports/project/p1', { projectName: 'APAC Launch' })).toEqual([
      { href: '/reports', label: 'Reports' },
      { href: '/reports/project/p1', label: 'APAC Launch' },
    ])
  })

  it('keeps declined as a static child of transactions', () => {
    expect(crumbsForPathname('/transactions/declined')).toEqual([
      { href: '/transactions', label: 'Transactions' },
      { href: '/transactions/declined', label: 'Declined' },
    ])
  })

  it('strips query strings', () => {
    expect(crumbsForPathname('/projects?status=ACTIVE')).toEqual([
      { href: '/projects', label: 'Projects' },
    ])
  })
})

describe('projectIdFromPathname', () => {
  it('reads a workspace project id and ignores /projects/new', () => {
    expect(projectIdFromPathname('/projects/p1')).toBe('p1')
    expect(projectIdFromPathname('/projects/p1/budget/categories')).toBe('p1')
    expect(projectIdFromPathname('/projects/new')).toBeNull()
    expect(projectIdFromPathname('/projects')).toBeNull()
  })

  it('reads /reports/project/:id and ignores other resources', () => {
    expect(projectIdFromPathname('/reports/project/p1')).toBe('p1')
    expect(projectIdFromPathname('/cards/c1')).toBeNull()
    expect(projectIdFromPathname('/dashboard')).toBeNull()
  })
})
