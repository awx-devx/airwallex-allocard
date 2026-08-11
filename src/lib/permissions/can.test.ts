import { describe, expect, it } from 'vitest'
import { can, explainDenial } from '@/lib/permissions/can'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { Permission } from '@/shared/enums/permissions'
import type { MePermissions } from '@/shared/types/mePermissions'

function meFor(
  projectId: string,
  permissions: Permission[],
  scope: MePermissions['projects'][number]['scope'],
): MePermissions {
  return { projects: [{ projectId, permissions, scope }] }
}

describe('lib/permissions/can', () => {
  it('returns false when project is missing', () => {
    const me = meFor('p1', [Permission.CARD_VIEW], { level: AccessScopeLevel.PROJECT })
    expect(can(me, 'other', Permission.CARD_VIEW)).toBe(false)
    expect(explainDenial(me, 'other', Permission.CARD_VIEW)).toBe('No access to this project')
  })

  it('returns false when permission is missing', () => {
    const me = meFor('p1', [Permission.CARD_VIEW], { level: AccessScopeLevel.PROJECT })
    expect(can(me, 'p1', Permission.CARD_MANAGE)).toBe(false)
    expect(explainDenial(me, 'p1', Permission.CARD_MANAGE)).toBe('Missing card.manage')
  })

  it('CARD scope permits card_x and denies card_y with the same permission list', () => {
    const me = meFor('p1', [Permission.PAYMENT_MAKE, Permission.CARD_MANAGE], {
      level: AccessScopeLevel.CARD,
      cardIds: ['card_x'],
    })
    expect(can(me, 'p1', Permission.PAYMENT_MAKE, { cardId: 'card_x' })).toBe(true)
    expect(can(me, 'p1', Permission.PAYMENT_MAKE, { cardId: 'card_y' })).toBe(false)
    expect(explainDenial(me, 'p1', Permission.PAYMENT_MAKE, { cardId: 'card_y' })).toBe(
      'Outside your access scope',
    )
  })

  it('OWN permits the caller’s own subject and denies others', () => {
    const me = meFor('p1', [Permission.CARD_VIEW], { level: AccessScopeLevel.OWN })
    expect(can(me, 'p1', Permission.CARD_VIEW, { userId: 'user_1', callerUserId: 'user_1' })).toBe(
      true,
    )
    expect(can(me, 'p1', Permission.CARD_VIEW, { userId: 'user_2', callerUserId: 'user_1' })).toBe(
      false,
    )
  })

  it('WORKSTREAM / CATEGORY / ASSIGNED_MEMBERS require an allowlisted id', () => {
    expect(
      can(
        meFor('p1', [Permission.BUDGET_VIEW], {
          level: AccessScopeLevel.WORKSTREAM,
          workstreamIds: ['ws_1'],
        }),
        'p1',
        Permission.BUDGET_VIEW,
        { workstreamId: 'ws_1' },
      ),
    ).toBe(true)
    expect(
      can(
        meFor('p1', [Permission.BUDGET_VIEW], {
          level: AccessScopeLevel.WORKSTREAM,
          workstreamIds: ['ws_1'],
        }),
        'p1',
        Permission.BUDGET_VIEW,
        { workstreamId: 'ws_2' },
      ),
    ).toBe(false)

    expect(
      can(
        meFor('p1', [Permission.BUDGET_VIEW], {
          level: AccessScopeLevel.CATEGORY,
          categoryIds: ['cat_1'],
        }),
        'p1',
        Permission.BUDGET_VIEW,
        { categoryId: 'cat_1' },
      ),
    ).toBe(true)

    expect(
      can(
        meFor('p1', [Permission.MEMBER_VIEW], {
          level: AccessScopeLevel.ASSIGNED_MEMBERS,
          memberIds: ['user_a'],
        }),
        'p1',
        Permission.MEMBER_VIEW,
        { userId: 'user_a' },
      ),
    ).toBe(true)
    expect(
      can(
        meFor('p1', [Permission.MEMBER_VIEW], {
          level: AccessScopeLevel.ASSIGNED_MEMBERS,
          memberIds: ['user_a'],
        }),
        'p1',
        Permission.MEMBER_VIEW,
        { userId: 'user_b' },
      ),
    ).toBe(false)
  })

  it('PROJECT scope covers any subject', () => {
    const me = meFor('p1', [Permission.CARD_MANAGE], { level: AccessScopeLevel.PROJECT })
    expect(can(me, 'p1', Permission.CARD_MANAGE, { cardId: 'anything' })).toBe(true)
  })

  it('explainDenial prefers preview reasons when provided', () => {
    const me = meFor('p1', [], { level: AccessScopeLevel.PROJECT })
    expect(
      explainDenial(me, 'p1', Permission.CARD_CREATE, undefined, [
        {
          permission: Permission.CARD_CREATE,
          allowed: false,
          message: 'Not granted by Viewer role',
        },
      ]),
    ).toBe('Not granted by Viewer role')
  })
})
