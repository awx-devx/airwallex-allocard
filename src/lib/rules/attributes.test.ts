import { describe, expect, it } from 'vitest'
import { attributeLabel } from '@/lib/rules/attributes'

describe('lib/rules/attributes', () => {
  it('labels RULES-ENGINE built-in attributes', () => {
    expect(attributeLabel('project.budget.remaining')).toBe('remaining budget')
    expect(attributeLabel('project.budget.utilisationPct')).toBe('budget utilisation')
    expect(attributeLabel('campaign.roas')).toBe('campaign ROAS')
    expect(attributeLabel('member.spend.mtd')).toBe('member spend MTD')
  })

  it('labels dynamic category and card interval keys', () => {
    expect(attributeLabel('project.category.cat_1.remaining')).toBe('category remaining budget')
    expect(attributeLabel('card.remaining.MONTHLY')).toBe('card remaining (MONTHLY)')
  })

  it('prettifies unknown keys from the last segment', () => {
    expect(attributeLabel('custom.myMetric')).toBe('my metric')
  })
})
