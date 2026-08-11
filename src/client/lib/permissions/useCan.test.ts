import { describe, expect, it } from 'vitest'
import { buildCanFromMe } from '@/client/lib/permissions/useCan'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { Permission } from '@/shared/enums/permissions'
import type { MePermissions } from '@/shared/types/mePermissions'

const me: MePermissions = {
  projects: [
    {
      projectId: 'p1',
      permissions: [Permission.CARD_MANAGE],
      scope: { level: AccessScopeLevel.CARD, cardIds: ['card_x'] },
    },
  ],
}

describe('client/lib/permissions/useCan', () => {
  it('buildCanFromMe returns false when me is undefined', () => {
    const helpers = buildCanFromMe(undefined, 'p1')
    expect(helpers.can(Permission.CARD_MANAGE)).toBe(false)
    expect(helpers.explain(Permission.CARD_MANAGE)).toBe('No access to this project')
  })

  it('buildCanFromMe scopes CARD subjects', () => {
    const helpers = buildCanFromMe(me, 'p1')
    expect(helpers.can(Permission.CARD_MANAGE, { cardId: 'card_x' })).toBe(true)
    expect(helpers.can(Permission.CARD_MANAGE, { cardId: 'card_y' })).toBe(false)
    expect(helpers.explain(Permission.CARD_MANAGE, { cardId: 'card_y' })).toBe(
      'Outside your access scope',
    )
  })
})
