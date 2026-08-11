import { describe, expect, it } from 'vitest'
import { isScopeActive, scopeCoversSubject } from '@/shared/access/scope'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import type { AccessScope } from '@/shared/types/accessScope'

const NOW = new Date('2026-06-15T12:00:00.000Z')

describe('shared/access/scope', () => {
  describe('isScopeActive', () => {
    it('is inactive when now is before validFrom', () => {
      const scope: AccessScope = {
        level: AccessScopeLevel.PROJECT,
        validFrom: '2026-07-01T00:00:00.000Z',
      }
      expect(isScopeActive(scope, NOW)).toBe(false)
    })

    it('is inactive when now is after validTo', () => {
      const scope: AccessScope = {
        level: AccessScopeLevel.CARD,
        cardIds: ['card_1'],
        validTo: '2026-01-01T00:00:00.000Z',
      }
      expect(isScopeActive(scope, NOW)).toBe(false)
    })

    it('is active on inclusive validFrom/validTo bounds', () => {
      const scope: AccessScope = {
        level: AccessScopeLevel.PROJECT,
        validFrom: NOW.toISOString(),
        validTo: NOW.toISOString(),
      }
      expect(isScopeActive(scope, NOW)).toBe(true)
    })

    it('treats missing bounds as open', () => {
      expect(isScopeActive({ level: AccessScopeLevel.PROJECT }, NOW)).toBe(true)
    })

    it('treats invalid ISO bounds as open', () => {
      const scope = {
        level: AccessScopeLevel.PROJECT,
        validFrom: 'not-a-date',
        validTo: 'also-bad',
      } as AccessScope
      expect(isScopeActive(scope, NOW)).toBe(true)
    })
  })

  describe('scopeCoversSubject', () => {
    it('OWN permits the caller’s own subject and denies others', () => {
      const scope: AccessScope = { level: AccessScopeLevel.OWN }

      expect(scopeCoversSubject(scope, { userId: 'user_1', callerUserId: 'user_1' })).toBe(true)
      expect(scopeCoversSubject(scope, { userId: 'user_2', callerUserId: 'user_1' })).toBe(false)
    })

    it('CARD permits card X and denies card Y', () => {
      const scope: AccessScope = {
        level: AccessScopeLevel.CARD,
        cardIds: ['card_x'],
      }
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
