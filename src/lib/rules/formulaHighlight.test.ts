import { describe, expect, it } from 'vitest'
import { highlightFormula } from '@/lib/rules/formulaHighlight'

describe('lib/rules/formulaHighlight', () => {
  it('tokenises numbers, identifiers, operators, punctuation, and whitespace', () => {
    const tokens = highlightFormula('project.budget.remaining * 0.10 + 2500')
    expect(tokens).toEqual([
      { type: 'ident', value: 'project.budget.remaining' },
      { type: 'ws', value: ' ' },
      { type: 'op', value: '*' },
      { type: 'ws', value: ' ' },
      { type: 'number', value: '0.10' },
      { type: 'ws', value: ' ' },
      { type: 'op', value: '+' },
      { type: 'ws', value: ' ' },
      { type: 'number', value: '2500' },
    ])
  })

  it('tokenises parentheses and commas', () => {
    const tokens = highlightFormula('min(a.b, 1)')
    expect(tokens.map((t) => t.type)).toEqual([
      'ident',
      'punct',
      'ident',
      'punct',
      'ws',
      'number',
      'punct',
    ])
  })

  it('returns empty array for empty input', () => {
    expect(highlightFormula('')).toEqual([])
  })
})
