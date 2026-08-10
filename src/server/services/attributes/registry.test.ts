import { describe, expect, it } from 'vitest'
import {
  BUILTIN_ATTRIBUTE_DEFINITIONS,
  campaignAnalyticsConnector,
  findConnector,
  isBuiltinAttributeKey,
  listConnectors,
} from '@/server/services/attributes/registry'
import { AttributeSubjectType } from '@/shared/enums/attributeSubjectType'
import { OrgRole } from '@/shared/enums/orgRole'
import type { OrgContext } from '@/server/http/types'

const ctx: OrgContext = { orgId: 'org_1', userId: 'user_1', orgRole: OrgRole.OWNER }

describe('attributes/registry', () => {
  it('catalogues the built-ins from RULES-ENGINE §2 with unique keys', () => {
    const keys = BUILTIN_ATTRIBUTE_DEFINITIONS.map((entry) => entry.key)

    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toContain('project.budget.remaining')
    expect(keys).toContain('project.headcount')
    expect(keys).toContain('member.role')
    expect(keys).toContain('card.status')
  })

  it('recognises templated built-in key families', () => {
    expect(isBuiltinAttributeKey('project.budget.remaining')).toBe(true)
    expect(isBuiltinAttributeKey('project.category.cat_1.remaining')).toBe(true)
    expect(isBuiltinAttributeKey('card.remaining.MONTHLY')).toBe(true)
    expect(isBuiltinAttributeKey('campaign.roas')).toBe(false)
  })

  it('resolves the stub connector by id and returns readings without a network call', async () => {
    expect(findConnector('campaign-analytics')).toBe(campaignAnalyticsConnector)
    expect(findConnector('nope')).toBeNull()
    expect(listConnectors()).toHaveLength(1)

    const readings = await campaignAnalyticsConnector.fetch(ctx, {
      subjectType: AttributeSubjectType.PROJECT,
      subjectId: 'proj_1',
    })

    expect(readings.map((reading) => reading.key)).toEqual([
      'campaign.roas',
      'campaign.status',
      'campaign.subject',
    ])
    expect(readings[0]?.ttlSec).toBe(900)
    expect(readings[2]?.value).toBe('proj_1')
  })
})
