import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ActorType } from '@/shared/enums/audit'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { Permission } from '@/shared/enums/permissions'
import type { AccessScope } from '@/shared/types/accessScope'
import {
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  SCOPE_LEVEL_LABELS,
  SETTINGS_NAV,
  addMemberDenialMessage,
  addMemberHref,
  accessReviewListHref,
  assignRoleDenialMessage,
  buildAccessScope,
  countMembersHoldingRole,
  eligibleOrgMembersToAdd,
  noEligibleMembersToAddMessage,
  permissionGateAllowed,
  formatPermissionReason,
  isLastAccessManager,
  isScopeActive,
  isScopeSelectionComplete,
  lastAccessManagerDenialMessage,
  manageAccessReviewDenialMessage,
  memberAccessState,
  memberHasCards,
  parseAccessReviewSearchParams,
  peopleHref,
  previewWouldDeny,
  scopeSummary,
  scopeWindowReason,
  sortRolesForMatrix,
  toAccessHistoryTimelineItem,
} from '@/client/lib/access'

const NOW = new Date('2026-06-15T12:00:00.000Z')
const PAST = '2026-01-01T00:00:00.000Z'
const FUTURE = '2026-12-01T00:00:00.000Z'
const PROJECT: AccessScope = { level: AccessScopeLevel.PROJECT }

function manager(
  userId: string,
  scope: AccessScope = PROJECT,
  permissions: Permission[] = [Permission.MEMBER_MANAGE],
) {
  return { userId, scope, effectivePermissions: permissions }
}

describe('PERMISSION_LABELS and PERMISSION_GROUPS', () => {
  it('has a label for every Permission', () => {
    expect(Object.keys(PERMISSION_LABELS).sort()).toEqual([...Object.values(Permission)].sort())
  })

  it('flattens groups to the Permission enum with no extras or duplicates', () => {
    const flat = PERMISSION_GROUPS.flatMap((group) => group.permissions)
    expect(flat).toEqual(Object.values(Permission))
    expect(new Set(flat).size).toBe(flat.length)
  })
})

describe('SCOPE_LEVEL_LABELS', () => {
  it('labels every AccessScopeLevel', () => {
    expect(SCOPE_LEVEL_LABELS).toEqual({
      PROJECT: 'Project',
      WORKSTREAM: 'Workstream',
      CATEGORY: 'Category',
      CARD: 'Card',
      OWN: 'Own',
      ASSIGNED_MEMBERS: 'Assigned members',
    })
  })
})

describe('formatPermissionReason', () => {
  it('uses the server message verbatim', () => {
    expect(
      formatPermissionReason({
        permission: Permission.BUDGET_VIEW,
        allowed: true,
        message: 'Granted by Project Manager role',
      }),
    ).toBe('Can view budget — Granted by Project Manager role')
    expect(
      formatPermissionReason({
        permission: Permission.CARD_MANAGE,
        allowed: false,
        message: 'Not granted by Viewer role',
      }),
    ).toBe('Cannot manage cards — Not granted by Viewer role')
  })
})

describe('scopeSummary', () => {
  it('names the level and joins relevant ids with a names fallback', () => {
    expect(scopeSummary({ level: AccessScopeLevel.PROJECT })).toBe('Scope: Project')
    expect(
      scopeSummary(
        { level: AccessScopeLevel.WORKSTREAM, workstreamIds: ['ws_1', 'ws_2'] },
        { workstreams: { ws_1: 'Retail' } },
      ),
    ).toBe('Scope: Workstream Retail, ws_2')
  })

  it('appends from/until when bounds are set', () => {
    expect(
      scopeSummary({
        level: AccessScopeLevel.OWN,
        validFrom: PAST,
        validTo: FUTURE,
      }),
    ).toBe(`Scope: Own from ${PAST} until ${FUTURE}`)
  })
})

describe('scopeWindowReason and memberAccessState', () => {
  it('returns not-yet-valid vs expired copy matching enforcement', () => {
    expect(scopeWindowReason({ validFrom: FUTURE }, NOW)).toBe('Access scope is not yet valid')
    expect(scopeWindowReason({ validTo: PAST }, NOW)).toBe('Access scope has expired')
    expect(scopeWindowReason({}, NOW)).toBeNull()
    expect(scopeWindowReason({ validFrom: 'not-iso', validTo: 'also-bad' }, NOW)).toBeNull()
  })

  it('maps window reason onto memberAccessState', () => {
    expect(
      memberAccessState({ scope: { level: AccessScopeLevel.PROJECT, validFrom: FUTURE } }, NOW),
    ).toEqual({
      kind: 'not_yet_valid',
      reason: 'Access scope is not yet valid',
    })
    expect(
      memberAccessState({ scope: { level: AccessScopeLevel.PROJECT, validTo: PAST } }, NOW),
    ).toEqual({
      kind: 'expired',
      reason: 'Access scope has expired',
    })
    expect(memberAccessState({ scope: PROJECT }, NOW)).toEqual({ kind: 'active', reason: null })
  })

  it('re-exports isScopeActive from shared', () => {
    expect(isScopeActive({ level: AccessScopeLevel.PROJECT, validTo: PAST }, NOW)).toBe(false)
    expect(isScopeActive(PROJECT, NOW)).toBe(true)
  })
})

describe('isLastAccessManager', () => {
  it('is true only for the sole active member.manage holder', () => {
    expect(isLastAccessManager([manager('u1')], 'u1', NOW)).toBe(true)
    expect(
      isLastAccessManager(
        [manager('u1'), manager('u2', PROJECT, [Permission.PROJECT_VIEW])],
        'u1',
        NOW,
      ),
    ).toBe(true)
    expect(isLastAccessManager([manager('u1'), manager('u2')], 'u1', NOW)).toBe(false)
    expect(isLastAccessManager([manager('u1')], 'u2', NOW)).toBe(false)
    expect(
      isLastAccessManager(
        [manager('u1'), manager('u2', { level: AccessScopeLevel.PROJECT, validTo: PAST })],
        'u1',
        NOW,
      ),
    ).toBe(true)
    expect(
      isLastAccessManager([manager('u1', PROJECT, [Permission.PROJECT_VIEW])], 'u1', NOW),
    ).toBe(false)
  })
})

describe('countMembersHoldingRole', () => {
  it('sums matching roleId across project member lists', () => {
    expect(
      countMembersHoldingRole('role_pm', [
        [{ roleId: 'role_pm' }, { roleId: 'role_v' }],
        [{ roleId: 'role_pm' }],
      ]),
    ).toBe(2)
    expect(countMembersHoldingRole('role_x', [[]])).toBe(0)
  })
})

describe('isScopeSelectionComplete', () => {
  it('requires sub-ids for narrowing levels and a coherent window', () => {
    expect(isScopeSelectionComplete({ level: AccessScopeLevel.PROJECT })).toBe(true)
    expect(isScopeSelectionComplete({ level: AccessScopeLevel.OWN })).toBe(true)
    expect(isScopeSelectionComplete({ level: AccessScopeLevel.WORKSTREAM })).toBe(false)
    expect(
      isScopeSelectionComplete({ level: AccessScopeLevel.WORKSTREAM, workstreamIds: ['ws_1'] }),
    ).toBe(true)
    expect(isScopeSelectionComplete({ level: AccessScopeLevel.CATEGORY, categoryIds: [] })).toBe(
      false,
    )
    expect(
      isScopeSelectionComplete({
        level: AccessScopeLevel.PROJECT,
        validFrom: FUTURE,
        validTo: PAST,
      }),
    ).toBe(false)
    expect(
      isScopeSelectionComplete({
        level: AccessScopeLevel.PROJECT,
        validFrom: PAST,
        validTo: FUTURE,
      }),
    ).toBe(true)
  })
})

describe('buildAccessScope', () => {
  it('drops the wrong id arrays and empty arrays', () => {
    expect(
      buildAccessScope({
        level: AccessScopeLevel.PROJECT,
        workstreamIds: ['ws_1'],
        categoryIds: ['cat_1'],
        cardIds: [],
        memberIds: ['u1'],
      }),
    ).toEqual({ level: AccessScopeLevel.PROJECT })
    expect(
      buildAccessScope({
        level: AccessScopeLevel.WORKSTREAM,
        workstreamIds: ['ws_1'],
        cardIds: ['card_1'],
      }),
    ).toEqual({ level: AccessScopeLevel.WORKSTREAM, workstreamIds: ['ws_1'] })
    expect(buildAccessScope({ level: AccessScopeLevel.CARD, cardIds: [] })).toEqual({
      level: AccessScopeLevel.CARD,
    })
    expect(
      buildAccessScope({ level: AccessScopeLevel.OWN, validFrom: null, validTo: PAST }),
    ).toEqual({
      level: AccessScopeLevel.OWN,
      validTo: PAST,
    })
  })
})

describe('permissionGateAllowed', () => {
  it('is true while loading even if the permission is denied', () => {
    expect(permissionGateAllowed(false, true)).toBe(true)
    expect(permissionGateAllowed(true, true)).toBe(true)
  })

  it('defers to allowed once loading is done', () => {
    expect(permissionGateAllowed(true, false)).toBe(true)
    expect(permissionGateAllowed(false, false)).toBe(false)
  })
})

describe('noEligibleMembersToAddMessage', () => {
  it('explains that every org member is already on the project', () => {
    expect(noEligibleMembersToAddMessage()).toBe(
      'Everyone in this organisation is already a member of this project.',
    )
  })
})

describe('eligibleOrgMembersToAdd', () => {
  it('excludes SUSPENDED and existing project members and sorts by name', () => {
    const result = eligibleOrgMembersToAdd(
      [
        { status: 'ACTIVE', user: { id: 'u2', name: 'Zoe', email: 'z@x.com' } },
        { status: 'ACTIVE', user: { id: 'u1', name: 'Ann', email: 'a@x.com' } },
        { status: 'SUSPENDED', user: { id: 'u3', name: 'Bob', email: 'b@x.com' } },
        { status: 'ACTIVE', user: { id: 'u4', name: 'Cara', email: 'c@x.com' } },
      ],
      [{ userId: 'u4' }],
    )
    expect(result.map((row) => row.id)).toEqual(['u1', 'u2'])
  })
})

describe('memberHasCards', () => {
  it('is true via accessList or cardholder userId', () => {
    const holders = [
      { id: 'ch_1', userId: 'u1' },
      { id: 'ch_2', userId: null },
    ]
    expect(memberHasCards('u1', [{ cardholderId: 'ch_1', accessList: [] }], holders)).toBe(true)
    expect(memberHasCards('u2', [{ cardholderId: 'ch_2', accessList: ['u2'] }], holders)).toBe(true)
    expect(memberHasCards('u3', [{ cardholderId: 'ch_2', accessList: ['u2'] }], holders)).toBe(
      false,
    )
  })
})

describe('hrefs', () => {
  it('builds people and add-member paths and throws on empty id', () => {
    expect(addMemberHref('proj_1')).toBe('/projects/proj_1/people/add')
    expect(peopleHref('proj_1')).toBe('/projects/proj_1/people')
    expect(() => addMemberHref('')).toThrow('projectId is required')
  })
})

describe('SETTINGS_NAV', () => {
  it('is the four settings hrefs and has no project settings tab', () => {
    expect(SETTINGS_NAV.map((item) => item.href)).toEqual([
      '/settings/roles',
      '/settings/access-reviews',
      '/settings/rules',
      '/settings/attributes',
    ])
    expect(SETTINGS_NAV.map((item) => `${item.href} ${item.label}`).join(' ')).not.toMatch(
      /\/projects\/[^/]*settings/,
    )
  })
})

describe('parseAccessReviewSearchParams', () => {
  it('keeps OPEN/RESOLVED, uses array [0], and drops unknown status', () => {
    expect(parseAccessReviewSearchParams({ status: 'OPEN', projectId: 'p1' })).toEqual({
      status: 'OPEN',
      projectId: 'p1',
    })
    expect(parseAccessReviewSearchParams({ status: ['RESOLVED', 'OPEN'] })).toEqual({
      status: 'RESOLVED',
    })
    expect(parseAccessReviewSearchParams({ status: 'NOPE', projectId: [''] })).toEqual({})
    expect(parseAccessReviewSearchParams({ projectId: '  ' })).toEqual({ projectId: '  ' })
  })
})

describe('accessReviewListHref', () => {
  it('omits empty filters and encodes values', () => {
    expect(accessReviewListHref({})).toBe('/settings/access-reviews')
    expect(accessReviewListHref({ status: 'OPEN', projectId: 'p 1' })).toBe(
      '/settings/access-reviews?status=OPEN&projectId=p+1',
    )
  })
})

describe('previewWouldDeny', () => {
  it('is true when allowed is false and fail-closed when the permission is missing', () => {
    expect(
      previewWouldDeny(
        { reasons: [{ permission: Permission.CARD_MANAGE, allowed: false }] },
        Permission.CARD_MANAGE,
      ),
    ).toBe(true)
    expect(
      previewWouldDeny(
        { reasons: [{ permission: Permission.CARD_MANAGE, allowed: true }] },
        Permission.CARD_MANAGE,
      ),
    ).toBe(false)
    expect(previewWouldDeny({ reasons: [] }, Permission.CARD_MANAGE)).toBe(true)
  })
})

describe('toAccessHistoryTimelineItem', () => {
  it('uses action as summary and omits before/after', () => {
    const item = toAccessHistoryTimelineItem({
      id: 'h1',
      action: 'member.added',
      actorType: ActorType.USER,
      actorId: 'u1',
      subjectType: 'projectMember',
      subjectId: 'm1',
      at: PAST,
    })
    expect(item).toEqual({
      id: 'h1',
      at: PAST,
      actorType: ActorType.USER,
      actorId: 'u1',
      summary: 'member.added',
      subjectType: 'projectMember',
      subjectId: 'm1',
    })
    expect(item).not.toHaveProperty('before')
    expect(item).not.toHaveProperty('after')
    expect(item).not.toHaveProperty('metadata')
  })
})

describe('locked denial copy', () => {
  it('returns the locked sentences', () => {
    expect(addMemberDenialMessage()).toBe("You don't have permission to manage members.")
    expect(assignRoleDenialMessage()).toBe("You don't have permission to assign roles.")
    expect(manageAccessReviewDenialMessage()).toBe(
      "You don't have permission to manage access reviews.",
    )
    expect(lastAccessManagerDenialMessage()).toBe(
      'Cannot remove the last member who can manage access.',
    )
  })
})

describe('sortRolesForMatrix', () => {
  it('orders templates by ROLE_TEMPLATES key then custom by name', () => {
    const sorted = sortRolesForMatrix([
      { key: 'viewer', name: 'Viewer', isTemplate: true },
      { key: 'zz_custom', name: 'Zebra', isTemplate: false },
      { key: 'finance_administrator', name: 'Finance Administrator', isTemplate: true },
      { key: 'aa_custom', name: 'Alpha', isTemplate: false },
      { key: 'project_manager', name: 'Project Manager', isTemplate: true },
    ])
    expect(sorted.map((role) => role.key)).toEqual([
      'finance_administrator',
      'project_manager',
      'viewer',
      'aa_custom',
      'zz_custom',
    ])
  })
})

describe('A3.9 preview vs 403', () => {
  it('matches allow/deny, not Missing ${permission} copy', () => {
    expect(
      previewWouldDeny(
        {
          reasons: [{ permission: Permission.CARD_MANAGE, allowed: false }],
        },
        Permission.CARD_MANAGE,
      ),
    ).toBe(true)
    expect(
      previewWouldDeny(
        {
          reasons: [{ permission: Permission.CARD_MANAGE, allowed: true }],
        },
        Permission.CARD_MANAGE,
      ),
    ).toBe(false)
    expect(previewWouldDeny({ reasons: [] }, Permission.CARD_MANAGE)).toBe(true)
    expect(
      formatPermissionReason({
        permission: Permission.BUDGET_VIEW,
        allowed: true,
        message: 'Granted by Project Manager role',
      }),
    ).toBe('Can view budget — Granted by Project Manager role')
  })
})

describe('A3.9 settings routes and no Settings workspace tab', () => {
  it('SETTINGS_NAV is exactly the four org settings hrefs', () => {
    expect(SETTINGS_NAV.map((item) => item.href)).toEqual([
      '/settings/roles',
      '/settings/access-reviews',
      '/settings/rules',
      '/settings/attributes',
    ])
  })
})

describe('A6.11 SETTINGS_NAV unchanged', () => {
  it('SETTINGS_NAV is exactly the four org settings hrefs', () => {
    expect(SETTINGS_NAV.map((item) => item.href)).toEqual([
      '/settings/roles',
      '/settings/access-reviews',
      '/settings/rules',
      '/settings/attributes',
    ])
  })
})

describe('A7.9 SETTINGS_NAV unchanged', () => {
  it('SETTINGS_NAV is exactly the four org settings hrefs and has no Requests', () => {
    expect(SETTINGS_NAV.map((item) => item.href)).toEqual([
      '/settings/roles',
      '/settings/access-reviews',
      '/settings/rules',
      '/settings/attributes',
    ])
    expect(SETTINGS_NAV.map((item) => item.href)).not.toContain('/requests')
    expect(SETTINGS_NAV.map((item) => item.label).join(' ')).not.toMatch(/Requests/)
  })
})

describe('A8.8 SETTINGS_NAV unchanged', () => {
  it('SETTINGS_NAV is exactly the four org settings hrefs and has no Transactions or Receipts', () => {
    expect(SETTINGS_NAV.map((item) => item.href)).toEqual([
      '/settings/roles',
      '/settings/access-reviews',
      '/settings/rules',
      '/settings/attributes',
    ])
    expect(SETTINGS_NAV.map((item) => item.href)).not.toContain('/transactions')
    expect(SETTINGS_NAV.map((item) => item.href)).not.toContain('/receipts')
    expect(SETTINGS_NAV.map((item) => item.label).join(' ')).not.toMatch(/Transactions|Receipts/)
  })
})

describe('A9.9 SETTINGS_NAV unchanged', () => {
  it('SETTINGS_NAV is exactly the four org settings hrefs and has no Audit, Reports, or Closure', () => {
    expect(SETTINGS_NAV.map((item) => item.href)).toEqual([
      '/settings/roles',
      '/settings/access-reviews',
      '/settings/rules',
      '/settings/attributes',
    ])
    expect(SETTINGS_NAV.map((item) => item.href)).not.toContain('/audit')
    expect(SETTINGS_NAV.map((item) => item.href)).not.toContain('/reports')
    expect(SETTINGS_NAV.map((item) => item.href)).not.toContain('/projects')
    expect(SETTINGS_NAV.map((item) => item.label).join(' ')).not.toMatch(/Audit|Reports|Closure/)
  })
})

describe('A3 screens never mention PAN', () => {
  it('has no PAN, cvv, or card_number under projects or settings', () => {
    function walk(dir: string): string[] {
      return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name)
        return entry.isDirectory() ? walk(path) : [path]
      })
    }

    const roots = [
      join(process.cwd(), 'src/app/(app)/projects'),
      join(process.cwd(), 'src/app/(app)/settings'),
    ]
    const files = roots.flatMap(walk)
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      const src = readFileSync(file, 'utf8').replace(
        /Card structure flags only — never a PAN\./g,
        '',
      )
      expect(src, file).not.toMatch(/\bPAN\b/)
      expect(src.toLowerCase(), file).not.toContain('cvv')
      expect(src.toLowerCase(), file).not.toContain('card_number')
    }
  })
})

describe('A3.9 shell still requireApp + collapse', () => {
  it('keeps requireApp, AppShellFrame, and aside hidden md:flex', () => {
    const layout = readFileSync(join(process.cwd(), 'src/app/(app)/layout.tsx'), 'utf8')
    expect(layout).toContain('requireApp()')
    expect(layout).toContain('AppShellFrame')
    const shell = readFileSync(join(process.cwd(), 'src/client/shell/AppShell.tsx'), 'utf8')
    expect(shell).toMatch(/aside className="[^"]*\bhidden\b/)
    expect(shell).toMatch(/aside className="[^"]*\bmd:flex\b/)
  })
})

describe('A3.9 layout classes', () => {
  it('uses the four don’t-break patterns on A3 screens', () => {
    const overview = readFileSync(
      join(process.cwd(), 'src/app/(app)/projects/[id]/ProjectOverview.tsx'),
      'utf8',
    )
    expect(overview).toContain('grid-cols-1')
    expect(overview).toContain('md:grid-cols-2')
    expect(overview).toContain('min-w-0')

    const people = readFileSync(
      join(process.cwd(), 'src/app/(app)/projects/[id]/people/PeopleList.tsx'),
      'utf8',
    )
    expect(people).toContain('flex-wrap')
    expect(people).toContain('TimelinePanel')

    const add = readFileSync(
      join(process.cwd(), 'src/app/(app)/projects/[id]/people/add/AddMemberForm.tsx'),
      'utf8',
    )
    expect(add).toContain('flex-col')
    expect(add).toContain('md:flex-row')

    const matrix = readFileSync(
      join(process.cwd(), 'src/app/(app)/settings/roles/RoleMatrix.tsx'),
      'utf8',
    )
    expect(matrix).toContain('overflow-x-auto')

    const reviews = readFileSync(
      join(process.cwd(), 'src/app/(app)/settings/access-reviews/AccessReviewList.tsx'),
      'utf8',
    )
    expect(reviews).toContain('flex-wrap')
    expect(reviews).not.toContain('DISMISS')
  })
})
