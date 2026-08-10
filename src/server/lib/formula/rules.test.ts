import { describe, expect, it } from 'vitest'
import { FormulaError, evaluateFormula } from '@/server/lib/formula'
import {
  buildRuleFormulaContext,
  evaluateMoneyFormula,
  evaluateRuleFormula,
  parseRuleFormula,
  ruleFormulaIdentifiers,
} from '@/server/lib/formula/rules'

const NOW = new Date('2026-08-11T00:00:00.000Z')

function expectFormulaError(fn: () => unknown, code: string): void {
  try {
    fn()
    throw new Error('Expected a FormulaError')
  } catch (error) {
    expect(error).toBeInstanceOf(FormulaError)
    expect((error as FormulaError).code).toBe(code)
  }
}

describe('lib/formula rules dialect', () => {
  describe('attribute identifiers', () => {
    it('resolves dotted attribute keys from the context', () => {
      const context = { 'project.budget.remaining': 600_000, 'project.headcount': 4 }

      expect(evaluateRuleFormula('project.budget.remaining', context)).toBe(600_000)
      expect(evaluateRuleFormula('project.budget.remaining / project.headcount', context)).toBe(
        150_000,
      )
    })

    it('fails with the key named when an attribute is missing — never zero', () => {
      expectFormulaError(
        () => evaluateRuleFormula('project.budget.remaining * 0.1', {}),
        'UNKNOWN_IDENTIFIER',
      )

      try {
        evaluateRuleFormula('campaign.roas * 2000', {})
      } catch (error) {
        expect((error as FormulaError).message).toContain('campaign.roas')
      }
    })

    it('lists the attribute keys a formula depends on', () => {
      expect(
        ruleFormulaIdentifiers('min(project.budget.remaining * 0.1, member.cap)').sort(),
      ).toEqual(['member.cap', 'project.budget.remaining'])
    })

    it('still refuses property access and bracket indexing', () => {
      expectFormulaError(() => parseRuleFormula('project .budget'), 'PROPERTY_ACCESS')
      expectFormulaError(() => parseRuleFormula('project.budget.'), 'PROPERTY_ACCESS')
      expectFormulaError(() => parseRuleFormula('project[0]'), 'PROPERTY_ACCESS')
    })

    it('still refuses eval, Function, and constructor in any segment', () => {
      expectFormulaError(() => parseRuleFormula('eval'), 'FORBIDDEN')
      expectFormulaError(() => parseRuleFormula('a.constructor.b'), 'FORBIDDEN')
      expectFormulaError(() => parseRuleFormula('Function(1)'), 'FORBIDDEN')
    })

    it('keeps the same DoS caps as the budget dialect', () => {
      expectFormulaError(() => parseRuleFormula('1 +'.repeat(200) + '1'), 'OVERSIZED')
      expectFormulaError(() => parseRuleFormula('a = 1'), 'FORBIDDEN')
    })
  })

  describe('decimals and money truncation', () => {
    it('multiplies money by a rate and truncates once at the money boundary', () => {
      const context = { 'project.budget.remaining': 402_355 }

      expect(evaluateRuleFormula('project.budget.remaining * 0.10', context)).toBeCloseTo(
        40_235.5,
        5,
      )
      expect(evaluateMoneyFormula('project.budget.remaining * 0.10', context)).toBe(40_235)
    })

    it('keeps float intermediates exact through a chain, truncating only at the end', () => {
      const context = { 'project.budget.approved': 1_000_000, 'project.headcount': 3 }

      // Truncating each step would give 333333 * 0.25 = 83333; exact is 83333.25.
      expect(
        evaluateMoneyFormula('project.budget.approved / max(project.headcount, 1) * 0.25', context),
      ).toBe(83_333)
    })

    it('reads float attributes such as campaign.roas', () => {
      const context = { 'campaign.roas': 2.4 }

      expect(evaluateMoneyFormula('clamp(campaign.roas * 2000, 1000, 25000)', context)).toBe(4800)
      expect(evaluateMoneyFormula('clamp(campaign.roas * 20000, 1000, 25000)', context)).toBe(
        25_000,
      )
    })

    it('truncates toward zero for negative results', () => {
      expect(evaluateMoneyFormula('0 - 5 / 2', {})).toBe(-2)
    })
  })

  describe('added functions', () => {
    it('computes abs', () => {
      expect(evaluateRuleFormula('abs(0 - 250)', {})).toBe(250)
    })

    it('computes daysBetween from epoch-millisecond context values', () => {
      const context = buildRuleFormulaContext(
        [{ key: 'project.endDate', value: '2026-08-31T00:00:00.000Z' }],
        NOW,
      )

      expect(evaluateRuleFormula('daysBetween(now, project.endDate)', context)).toBe(20)
      expect(evaluateRuleFormula('daysBetween(project.endDate, now)', context)).toBe(-20)
    })

    it('coalesce falls back for a declared-but-null attribute', () => {
      const context = buildRuleFormulaContext([
        { key: 'campaign.roas', value: null },
        { key: 'project.budget.remaining', value: 600_000 },
      ])

      expect(evaluateRuleFormula('coalesce(campaign.roas, 1)', context)).toBe(1)
      expect(evaluateRuleFormula('coalesce(project.budget.remaining, 1)', context)).toBe(600_000)
    })

    it('coalesce does not rescue a missing attribute — a typo still fails loudly', () => {
      expectFormulaError(
        () => evaluateRuleFormula('coalesce(campaign.raos, 1)', {}),
        'UNKNOWN_IDENTIFIER',
      )
    })
  })

  describe('context projection', () => {
    it('passes numbers through, converts ISO dates, and nulls non-numeric values', () => {
      const context = buildRuleFormulaContext(
        [
          { key: 'project.budget.remaining', value: 600_000 },
          { key: 'campaign.roas', value: 2.4 },
          { key: 'project.endDate', value: '2026-08-31T00:00:00.000Z' },
          { key: 'project.status', value: 'ACTIVE' },
          { key: 'campaign.active', value: true },
        ],
        NOW,
      )

      expect(context['project.budget.remaining']).toBe(600_000)
      expect(context['campaign.roas']).toBe(2.4)
      expect(context['project.endDate']).toBe(Date.parse('2026-08-31T00:00:00.000Z'))
      expect(context['project.status']).toBeNull()
      expect(context['campaign.active']).toBeNull()
      expect(context.now).toBe(NOW.getTime())
    })

    it('rejects arithmetic on a non-numeric attribute rather than coercing it', () => {
      const context = buildRuleFormulaContext([{ key: 'project.status', value: 'ACTIVE' }], NOW)

      expectFormulaError(() => evaluateRuleFormula('project.status * 2', context), 'NULL_VALUE')
    })
  })

  describe('budget dialect is unchanged', () => {
    it('still rejects decimals, dots, and the rule-only functions', () => {
      expectFormulaError(() => evaluateFormula('1 * 0.25'), 'FORBIDDEN')
      expectFormulaError(() => evaluateFormula('project.budget'), 'PROPERTY_ACCESS')
      expectFormulaError(() => evaluateFormula('abs(1)'), 'UNKNOWN_FUNCTION')
      expectFormulaError(() => evaluateFormula('coalesce(1, 2)'), 'UNKNOWN_FUNCTION')
    })

    it('still truncates after every operation', () => {
      expect(evaluateFormula('5 / 2')).toBe(2)
      expect(evaluateFormula('approved / 3 * 3', { approved: 1000 })).toBe(999)
    })
  })
})
