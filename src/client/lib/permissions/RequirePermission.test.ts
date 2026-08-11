import { describe, expect, it } from 'vitest'
import { decideRequirePermission } from '@/client/lib/permissions/RequirePermission'
import { Permission } from '@/shared/enums/permissions'

describe('client/lib/permissions/RequirePermission', () => {
  it('returns children when allowed', () => {
    const children = 'ok'
    expect(
      decideRequirePermission({
        allowed: true,
        children,
        denialMessage: 'unused',
        permission: Permission.CARD_CREATE,
      }),
    ).toEqual({ kind: 'children', children })
  })

  it('returns null when denied and fallback is default null', () => {
    expect(
      decideRequirePermission({
        allowed: false,
        children: 'secret',
        fallback: null,
        denialMessage: 'Missing card.create',
        permission: Permission.CARD_CREATE,
      }),
    ).toEqual({ kind: 'null' })
  })

  it('returns fallback decision when denied with a fallback node', () => {
    const fallback = 'disabled'
    expect(
      decideRequirePermission({
        allowed: false,
        children: 'secret',
        fallback,
        denialMessage: 'Outside your access scope',
        permission: Permission.CARD_MANAGE,
      }),
    ).toEqual({
      kind: 'fallback',
      fallback,
      denialMessage: 'Outside your access scope',
      permission: Permission.CARD_MANAGE,
    })
  })
})
