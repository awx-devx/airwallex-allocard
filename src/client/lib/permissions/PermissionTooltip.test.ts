import { describe, expect, it } from 'vitest'
import { resolvePermissionTooltipTitle } from '@/client/lib/permissions/PermissionTooltip'
import { Permission } from '@/shared/enums/permissions'

describe('client/lib/permissions/PermissionTooltip', () => {
  it('prefers explicit message over reasons and default', () => {
    expect(
      resolvePermissionTooltipTitle(Permission.CARD_CREATE, 'Explicit denial', [
        {
          permission: Permission.CARD_CREATE,
          allowed: false,
          message: 'Not granted by Viewer role',
        },
      ]),
    ).toBe('Explicit denial')
  })

  it('uses matching denied reason when message omitted', () => {
    expect(
      resolvePermissionTooltipTitle(Permission.CARD_CREATE, undefined, [
        {
          permission: Permission.CARD_VIEW,
          allowed: false,
          message: 'Other permission',
        },
        {
          permission: Permission.CARD_CREATE,
          allowed: false,
          message: 'Not granted by Viewer role',
        },
      ]),
    ).toBe('Not granted by Viewer role')
  })

  it('falls back to Missing {permission}', () => {
    expect(resolvePermissionTooltipTitle(Permission.CARD_MANAGE)).toBe('Missing card.manage')
  })
})
