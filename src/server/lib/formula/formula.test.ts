import { describe, expect, it } from 'vitest'
import {
  FormulaError,
  MAX_EXPRESSION_LENGTH,
  MAX_NODES,
  countNodes,
  evaluate,
  evaluateFormula,
  parse,
} from '@/server/lib/formula'

describe('lib/formula', () => {
  describe('precedence', () => {
    it('multiplies before adding', () => {
      expect(evaluateFormula('2 + 3 * 4')).toBe(14)
      expect(evaluateFormula('(2 + 3) * 4')).toBe(20)
    })

    it('divides before subtracting', () => {
      expect(evaluateFormula('10 - 8 / 2')).toBe(6)
    })

    it('associates left-to-right within the same precedence', () => {
      expect(evaluateFormula('20 / 5 / 2')).toBe(2)
      expect(evaluateFormula('10 - 3 - 2')).toBe(5)
    })

    it('applies unary minus', () => {
      expect(evaluateFormula('-5 + 2')).toBe(-3)
      expect(evaluateFormula('-(2 + 3)')).toBe(-5)
    })
  })

  describe('allowlisted functions', () => {
    it('min / max', () => {
      expect(evaluateFormula('min(3, 1, 2)')).toBe(1)
      expect(evaluateFormula('max(3, 1, 2)')).toBe(3)
    })

    it('round / floor / ceil', () => {
      // Intermediates are already ints; functions still work.
      expect(evaluateFormula('round(5)')).toBe(5)
      expect(evaluateFormula('floor(5)')).toBe(5)
      expect(evaluateFormula('ceil(5)')).toBe(5)
      // Truncation after division: 5/2 → 2; round of that is 2.
      expect(evaluateFormula('round(5 / 2)')).toBe(2)
      expect(evaluateFormula('floor(5 / 2)')).toBe(2)
      expect(evaluateFormula('ceil(5 / 2)')).toBe(2)
    })

    it('clamp', () => {
      expect(evaluateFormula('clamp(5, 0, 10)')).toBe(5)
      expect(evaluateFormula('clamp(-1, 0, 10)')).toBe(0)
      expect(evaluateFormula('clamp(99, 0, 10)')).toBe(10)
    })

    it('pct', () => {
      expect(evaluateFormula('pct(10000, 80)')).toBe(8000)
      expect(evaluateFormula('pct(1000, 33)')).toBe(330)
      // trunc toward zero: 100 * 1 / 100 wait pct(10, 33) = trunc(330/100)=3
      expect(evaluateFormula('pct(10, 33)')).toBe(3)
    })
  })

  describe('identifiers', () => {
    it('resolves from context', () => {
      expect(evaluateFormula('approvedAmount / 2', { approvedAmount: 1000 })).toBe(500)
      expect(evaluateFormula('pct(approvedAmount, 10)', { approvedAmount: 50_000 })).toBe(5_000)
    })

    it('unknown identifier → typed error', () => {
      expect(() => evaluateFormula('missing + 1')).toThrow(FormulaError)
      try {
        evaluateFormula('missing + 1')
      } catch (error) {
        expect(error).toMatchObject({ code: 'UNKNOWN_IDENTIFIER' })
      }
    })
  })

  describe('errors', () => {
    it('division by zero → typed error', () => {
      expect(() => evaluateFormula('10 / 0')).toThrow(FormulaError)
      try {
        evaluateFormula('10 / 0')
      } catch (error) {
        expect(error).toMatchObject({ code: 'DIVISION_BY_ZERO' })
      }
    })

    it('oversized expression length → typed error', () => {
      const expr = '1'.padEnd(MAX_EXPRESSION_LENGTH + 1, '+1')
      expect(() => parse(expr)).toThrow(FormulaError)
      try {
        parse(expr)
      } catch (error) {
        expect(error).toMatchObject({ code: 'OVERSIZED' })
      }
    })

    it('oversized node count → typed error', () => {
      // 1+1+1+... enough binary nodes to exceed MAX_NODES
      const parts = Array.from({ length: MAX_NODES }, () => '1')
      const expr = parts.join('+')
      expect(() => parse(expr)).toThrow(FormulaError)
      try {
        parse(expr)
      } catch (error) {
        expect(error).toMatchObject({ code: 'OVERSIZED' })
      }
    })

    it('property-access attempt → typed error', () => {
      expect(() => parse('foo.bar')).toThrow(FormulaError)
      try {
        parse('foo.bar')
      } catch (error) {
        expect(error).toMatchObject({ code: 'PROPERTY_ACCESS' })
      }

      expect(() => parse('foo[0]')).toThrow(FormulaError)
      try {
        parse('foo[0]')
      } catch (error) {
        expect(error).toMatchObject({ code: 'PROPERTY_ACCESS' })
      }
    })

    it('eval / Function attempt → typed error', () => {
      expect(() => parse('eval(1)')).toThrow(FormulaError)
      try {
        parse('eval(1)')
      } catch (error) {
        expect(error).toMatchObject({ code: 'FORBIDDEN' })
      }

      expect(() => parse('Function(1)')).toThrow(FormulaError)
      try {
        parse('Function(1)')
      } catch (error) {
        expect(error).toMatchObject({ code: 'FORBIDDEN' })
      }
    })
  })

  describe('integer-only results', () => {
    it('truncates toward zero after division', () => {
      expect(evaluateFormula('5 / 2')).toBe(2)
      expect(evaluateFormula('-5 / 2')).toBe(-2)
      expect(evaluateFormula('1 / 3')).toBe(0)
    })

    it('never returns a non-integer from mixed ops', () => {
      const value = evaluateFormula('(approvedAmount * 3) / 2 + pct(approvedAmount, 10)', {
        approvedAmount: 1001,
      })
      expect(Number.isInteger(value)).toBe(true)
      // 1001*3=3003; /2 trunc→1501; pct(1001,10)=100; total 1601
      expect(value).toBe(1601)
    })

    it('evaluate(parse(...)) matches evaluateFormula', () => {
      const expr = 'clamp(approvedAmount / 4, 100, 500)'
      const ctx = { approvedAmount: 900 }
      expect(evaluate(parse(expr), ctx)).toBe(evaluateFormula(expr, ctx))
    })
  })

  describe('node counting', () => {
    it('counts AST nodes', () => {
      expect(countNodes(parse('1'))).toBe(1)
      expect(countNodes(parse('1 + 2'))).toBe(3)
      expect(countNodes(parse('min(1, 2)'))).toBe(3)
    })
  })
})
