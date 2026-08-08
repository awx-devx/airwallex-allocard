import { describe, expect, it } from 'vitest'
import {
  computeEffectivePermissions,
  scopeCoversSubject,
} from '@/server/services/access/computeEffectivePermissions'
import { ALL_PERMISSIONS, ROLE_TEMPLATES } from '@/shared/constants/roleTemplates'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { OrgRole } from '@/shared/enums/orgRole'
import { Permission } from '@/shared/enums/permissions'
import type { AccessScope } from '@/shared/types/accessScope'
import type { Role } from '@/shared/types/role'

const NOW = new Date('2026-06-15T12:00:00.000Z')

const SCOPE_LEVELS = Object.values(AccessScopeLevel)

function scopeForLevel(level: AccessScopeLevel): AccessScope {
  switch (level) {
    case AccessScopeLevel.PROJECT:
      return { level }
    case AccessScopeLevel.WORKSTREAM:
      return { level, workstreamIds: ['ws_1'] }
    case AccessScopeLevel.CATEGORY:
      return { level, categoryIds: ['cat_1'] }
    case AccessScopeLevel.CARD:
      return { level, cardIds: ['card_x'] }
    case AccessScopeLevel.OWN:
      return { level }
    case AccessScopeLevel.ASSIGNED_MEMBERS:
      return { level, memberIds: ['user_a'] }
    default: {
      const _exhaustive: never = level
      return _exhaustive
    }
  }
}

function roleFromTemplate(template: (typeof ROLE_TEMPLATES)[number]): Role {
  return {
    id: `role_${template.key}`,
    orgId: 'org_1',
    key: template.key,
    name: template.name,
    isTemplate: true,
    permissions: [...template.permissions],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('access/computeEffectivePermissions', () => {
  describe('seven templates × six scope levels', () => {
    for (const template of ROLE_TEMPLATES) {
      for (const level of SCOPE_LEVELS) {
        it(`${template.key} @ ${level} grants exactly the template permissions`, () => {
          const role = roleFromTemplate(template)
          const scope = scopeForLevel(level)
          const result = computeEffectivePermissions({
            orgRole: OrgRole.MEMBER,
            role,
            scope,
            now: NOW,
          })

          expect(result.permissions).toEqual([...template.permissions])
          expect(result.scope).toEqual(scope)
          expect(result.reasons).toHaveLength(ALL_PERMISSIONS.length)

          for (const reason of result.reasons) {
            const shouldAllow = template.permissions.includes(reason.permission)
            expect(reason.allowed).toBe(shouldAllow)
            if (shouldAllow) {
              expect(reason.message).toContain(template.name)
            } else {
              expect(reason.message).toMatch(/Not granted/)
            }
          }
        })
      }
    }
  })

  it('yields an empty set when now is before validFrom', () => {
    const role = roleFromTemplate(ROLE_TEMPLATES[0]!)
    const scope: AccessScope = {
      level: AccessScopeLevel.PROJECT,
      validFrom: '2026-07-01T00:00:00.000Z',
    }

    const result = computeEffectivePermissions({
      orgRole: OrgRole.MEMBER,
      role,
      scope,
      now: NOW,
    })

    expect(result.permissions).toEqual([])
    expect(result.reasons.every((r) => !r.allowed)).toBe(true)
    expect(result.reasons[0]?.message).toMatch(/not yet valid/i)
  })

  it('yields an empty set when now is after validTo', () => {
    const role = roleFromTemplate(ROLE_TEMPLATES.find((t) => t.key === 'contractor')!)
    const scope: AccessScope = {
      level: AccessScopeLevel.CARD,
      cardIds: ['card_1'],
      validTo: '2026-01-01T00:00:00.000Z',
    }

    const result = computeEffectivePermissions({
      orgRole: OrgRole.MEMBER,
      role,
      scope,
      now: NOW,
    })

    expect(result.permissions).toEqual([])
    expect(result.reasons.every((r) => !r.allowed)).toBe(true)
    expect(result.reasons[0]?.message).toMatch(/expired/i)
  })

  it('allows MEMBER access on the inclusive validFrom/validTo bounds', () => {
    const role = roleFromTemplate(ROLE_TEMPLATES.find((t) => t.key === 'viewer')!)
    const scope: AccessScope = {
      level: AccessScopeLevel.PROJECT,
      validFrom: NOW.toISOString(),
      validTo: NOW.toISOString(),
    }

    const result = computeEffectivePermissions({
      orgRole: OrgRole.MEMBER,
      role,
      scope,
      now: NOW,
    })

    expect(result.permissions).toEqual([...role.permissions])
  })

  it('OWNER retains full access regardless of a narrow Viewer project role', () => {
    const role = roleFromTemplate(ROLE_TEMPLATES.find((t) => t.key === 'viewer')!)
    const scope = scopeForLevel(AccessScopeLevel.OWN)

    const result = computeEffectivePermissions({
      orgRole: OrgRole.OWNER,
      role,
      scope,
      now: NOW,
    })

    expect(result.permissions).toEqual([...ALL_PERMISSIONS])
    expect(result.reasons.every((r) => r.allowed && r.message.includes('OWNER'))).toBe(true)
  })

  it('ADMIN widens even when the project scope time window has expired', () => {
    const role = roleFromTemplate(ROLE_TEMPLATES.find((t) => t.key === 'contractor')!)
    const scope: AccessScope = {
      level: AccessScopeLevel.PROJECT,
      validTo: '2020-01-01T00:00:00.000Z',
    }

    const result = computeEffectivePermissions({
      orgRole: OrgRole.ADMIN,
      role,
      scope,
      now: NOW,
    })

    expect(result.permissions).toEqual([...ALL_PERMISSIONS])
    expect(result.reasons.every((r) => r.allowed && r.message.includes('ADMIN'))).toBe(true)
  })

  describe('OWN / CARD subject narrowing (scopeCoversSubject)', () => {
    it('OWN permits the caller’s own subject and denies others', () => {
      const scope: AccessScope = { level: AccessScopeLevel.OWN }

      expect(scopeCoversSubject(scope, { userId: 'user_1', callerUserId: 'user_1' })).toBe(true)
      expect(scopeCoversSubject(scope, { userId: 'user_2', callerUserId: 'user_1' })).toBe(false)
    })

    it('CARD permits card X and denies card Y with the same permission set', () => {
      const role = roleFromTemplate(ROLE_TEMPLATES.find((t) => t.key === 'contractor')!)
      const scope: AccessScope = {
        level: AccessScopeLevel.CARD,
        cardIds: ['card_x'],
      }

      const result = computeEffectivePermissions({
        orgRole: OrgRole.MEMBER,
        role,
        scope,
        now: NOW,
      })

      // Permission list is unchanged — subject narrowing is separate.
      expect(result.permissions).toContain(Permission.PAYMENT_MAKE)
      expect(scopeCoversSubject(scope, { cardId: 'card_x' })).toBe(true)
      expect(scopeCoversSubject(scope, { cardId: 'card_y' })).toBe(false)
    })

    it('WORKSTREAM / CATEGORY / ASSIGNED_MEMBERS require an allowlisted id', () => {
      expect(
        scopeCoversSubject(
          { level: AccessScopeLevel.WORKSTREAM, workstreamIds: ['ws_1'] },
          { workstreamId: 'ws_1' },
        ),
      ).toBe(true)
      expect(
        scopeCoversSubject(
          { level: AccessScopeLevel.WORKSTREAM, workstreamIds: ['ws_1'] },
          { workstreamId: 'ws_2' },
        ),
      ).toBe(false)

      expect(
        scopeCoversSubject(
          { level: AccessScopeLevel.CATEGORY, categoryIds: ['cat_1'] },
          { categoryId: 'cat_1' },
        ),
      ).toBe(true)
      expect(
        scopeCoversSubject(
          { level: AccessScopeLevel.ASSIGNED_MEMBERS, memberIds: ['user_a'] },
          { userId: 'user_a' },
        ),
      ).toBe(true)
      expect(
        scopeCoversSubject(
          { level: AccessScopeLevel.ASSIGNED_MEMBERS, memberIds: ['user_a'] },
          { userId: 'user_b' },
        ),
      ).toBe(false)
    })

    it('PROJECT scope covers any subject', () => {
      expect(scopeCoversSubject({ level: AccessScopeLevel.PROJECT }, { cardId: 'anything' })).toBe(
        true,
      )
    })
  })
})
