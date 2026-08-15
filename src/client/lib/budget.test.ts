import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ActorType } from '@/shared/enums/audit'
import {
  BUDGET_NAV,
  BUDGET_TERM_TOOLTIPS,
  FORMULA_DEBOUNCE_MS,
  FORMULA_FUNCTION_IDENTS,
  MAX_FORMULA_LENGTH,
  allocationsExceedApproved,
  allocationsSum,
  attributeFormulaLandsInA6Message,
  attributeValueForIdent,
  budgetCategoriesHref,
  budgetHistoryHref,
  budgetHistoryReason,
  budgetHref,
  budgetNavHref,
  budgetRequestsHref,
  cardLimitDiffToDiffView,
  cardsTabHref,
  categoriesExceedMessage,
  diffCardTransactionLimits,
  editBudgetDenialMessage,
  formulaContextFromBudget,
  formulaExpressionTooLong,
  formulaIdentTokens,
  formulaTooLongMessage,
  hasBudgetRecord,
  isBudgetNavActive,
  isFormulaExpressionEmpty,
  minorToInputString,
  noCardLimitsMovedMessage,
  overCommittedMessage,
  pendingChangeRequests,
  projectionToBudgetBarProps,
  requestBudgetDenialMessage,
  snapshotCardTransactionLimits,
  toBudgetHistoryTimelineItem,
} from '@/client/lib/budget'

const CARD = {
  id: 'card_1',
  nickName: 'Ops',
  maskedNumber: '************1234',
  desiredControls: {
    transactionLimits: {
      currency: 'USD',
      limits: [{ interval: 'MONTHLY', amount: 100 }],
    },
  },
}

describe('BUDGET_NAV', () => {
  it('has four suffixes in locked order', () => {
    expect(BUDGET_NAV.map((item) => item.suffix)).toEqual([
      '',
      '/categories',
      '/history',
      '/requests',
    ])
    expect(BUDGET_NAV.map((item) => item.label)).toEqual([
      'Overview',
      'Categories',
      'History',
      'Requests',
    ])
  })
})

describe('budget hrefs', () => {
  it('builds nested budget paths', () => {
    expect(budgetHref('p')).toBe('/projects/p/budget')
    expect(budgetCategoriesHref('p')).toBe('/projects/p/budget/categories')
    expect(budgetHistoryHref('p')).toBe('/projects/p/budget/history')
    expect(budgetRequestsHref('p')).toBe('/projects/p/budget/requests')
    expect(budgetNavHref('p', '/history')).toBe('/projects/p/budget/history')
    expect(cardsTabHref('p')).toBe('/projects/p/cards')
  })

  it('throws on empty projectId', () => {
    expect(() => budgetHref('')).toThrow('projectId is required')
    expect(() => budgetCategoriesHref('')).toThrow('projectId is required')
    expect(() => cardsTabHref('')).toThrow('projectId is required')
  })
})

describe('isBudgetNavActive', () => {
  it('does not treat Overview as active on /categories', () => {
    expect(isBudgetNavActive('/projects/p/budget/categories', 'p', '')).toBe(false)
    expect(isBudgetNavActive('/projects/p/budget/categories', 'p', '/categories')).toBe(true)
    expect(isBudgetNavActive('/projects/p/budget', 'p', '')).toBe(true)
    expect(isBudgetNavActive('/projects/p/budget', 'p', '/categories')).toBe(false)
  })
})

describe('formulaContextFromBudget', () => {
  it('has exactly one key', () => {
    expect(formulaContextFromBudget(42)).toEqual({ approvedAmount: 42 })
    expect(Object.keys(formulaContextFromBudget(42))).toEqual(['approvedAmount'])
  })
})

describe('formulaIdentTokens', () => {
  it('drops allowlisted functions and keeps first-seen idents', () => {
    expect(formulaIdentTokens('pct(approvedAmount, 10) + headcount')).toEqual([
      'approvedAmount',
      'headcount',
    ])
  })

  it('knows B4 function idents', () => {
    expect([...FORMULA_FUNCTION_IDENTS].sort()).toEqual(
      ['ceil', 'clamp', 'floor', 'max', 'min', 'pct', 'round'].sort(),
    )
  })
})

describe('formula length / empty', () => {
  it('flags expressions over 500 characters', () => {
    expect(MAX_FORMULA_LENGTH).toBe(500)
    expect(FORMULA_DEBOUNCE_MS).toBe(300)
    expect(formulaExpressionTooLong('a'.repeat(500))).toBe(false)
    expect(formulaExpressionTooLong('a'.repeat(501))).toBe(true)
    expect(isFormulaExpressionEmpty('  ')).toBe(true)
    expect(isFormulaExpressionEmpty('approvedAmount')).toBe(false)
  })
})

describe('allocations', () => {
  it('sums integers and flags overflow strictly greater', () => {
    expect(allocationsSum([{ allocated: 40 }, { allocated: 60 }])).toBe(100)
    expect(allocationsExceedApproved(100, 100)).toBe(false)
    expect(allocationsExceedApproved(101, 100)).toBe(true)
  })
})

describe('pendingChangeRequests', () => {
  it('keeps only PENDING', () => {
    expect(
      pendingChangeRequests([
        { id: '1', status: 'PENDING' },
        { id: '2', status: 'APPROVED' },
        { id: '3', status: 'REJECTED' },
        { id: '4', status: 'PENDING' },
      ]).map((row) => row.id),
    ).toEqual(['1', '4'])
  })
})

describe('card transaction limit diffs', () => {
  it('emits a row when MONTHLY amount changes and none when equal', () => {
    const before = snapshotCardTransactionLimits([CARD])
    const afterSame = snapshotCardTransactionLimits([CARD])
    expect(diffCardTransactionLimits(before, afterSame)).toEqual([])

    const afterChanged = snapshotCardTransactionLimits([
      {
        ...CARD,
        desiredControls: {
          transactionLimits: {
            currency: 'USD',
            limits: [{ interval: 'MONTHLY', amount: 80 }],
          },
        },
      },
    ])
    expect(diffCardTransactionLimits(before, afterChanged)).toEqual([
      {
        cardId: 'card_1',
        nickName: 'Ops',
        maskedNumber: '************1234',
        interval: 'MONTHLY',
        currency: 'USD',
        beforeAmount: 100,
        afterAmount: 80,
      },
    ])
  })

  it('treats a new card as moved from 0 and omits cards only in before', () => {
    const before = snapshotCardTransactionLimits([CARD])
    const after = snapshotCardTransactionLimits([
      {
        id: 'card_2',
        nickName: 'Travel',
        maskedNumber: '************9999',
        desiredControls: {
          transactionLimits: {
            currency: 'USD',
            limits: [{ interval: 'DAILY', amount: 50 }],
          },
        },
      },
    ])
    expect(diffCardTransactionLimits(before, after)).toEqual([
      {
        cardId: 'card_2',
        nickName: 'Travel',
        maskedNumber: '************9999',
        interval: 'DAILY',
        currency: 'USD',
        beforeAmount: 0,
        afterAmount: 50,
      },
    ])
  })

  it('maps diffs to money objects for DiffView', () => {
    const diffs = diffCardTransactionLimits(
      snapshotCardTransactionLimits([CARD]),
      snapshotCardTransactionLimits([
        {
          ...CARD,
          desiredControls: {
            transactionLimits: {
              currency: 'USD',
              limits: [{ interval: 'MONTHLY', amount: 80 }],
            },
          },
        },
      ]),
    )
    const view = cardLimitDiffToDiffView(diffs)
    const key = 'Ops ************1234 MONTHLY'
    expect(view.before[key]).toEqual({ amount: 100, currency: 'USD' })
    expect(view.after[key]).toEqual({ amount: 80, currency: 'USD' })
  })
})

describe('projectionToBudgetBarProps', () => {
  it('does not clamp negative remaining', () => {
    const props = projectionToBudgetBarProps(
      {
        approved: 100,
        committed: 200,
        actual: 0,
        remaining: -1,
        utilisationPct: 200,
        overCommitted: true,
      },
      'USD',
    )
    expect(props.remaining).toBe(-1)
    expect(props.currency).toBe('USD')
    expect(props.overCommitted).toBe(true)
  })
})

describe('budgetHistoryReason', () => {
  it('reads metadata.reason first', () => {
    expect(
      budgetHistoryReason({
        metadata: { reason: 'Need more headcount', note: 'ignored' },
        after: { reason: 'also ignored' },
      }),
    ).toBe('Need more headcount')
  })

  it('falls back to metadata.note then after.reason', () => {
    expect(budgetHistoryReason({ metadata: { note: 'trimmed note' } })).toBe('trimmed note')
    expect(budgetHistoryReason({ metadata: {}, after: { reason: 'from after' } })).toBe(
      'from after',
    )
    expect(budgetHistoryReason({ metadata: {}, after: 'nope' })).toBeNull()
    expect(budgetHistoryReason({ metadata: { reason: '' } })).toBeNull()
  })
})

describe('toBudgetHistoryTimelineItem', () => {
  it('uses action as summary and omits before/after/metadata', () => {
    const item = toBudgetHistoryTimelineItem({
      id: 'h1',
      action: 'budget.updated',
      actorType: ActorType.USER,
      actorId: 'u1',
      subjectType: 'budget',
      subjectId: 'b1',
      at: '2026-08-16T00:00:00.000Z',
    })
    expect(item.summary).toBe('budget.updated')
    expect(item).not.toHaveProperty('before')
    expect(item).not.toHaveProperty('after')
    expect(item).not.toHaveProperty('metadata')
  })
})

describe('hasBudgetRecord', () => {
  it('is true for objects and false for null', () => {
    expect(hasBudgetRecord(null)).toBe(false)
    expect(hasBudgetRecord({ id: 'b1' })).toBe(true)
    expect(hasBudgetRecord(undefined)).toBe(false)
  })
})

describe('locked copy', () => {
  it('returns the §12 sentences', () => {
    expect(editBudgetDenialMessage()).toBe("You don't have permission to edit the budget.")
    expect(requestBudgetDenialMessage()).toBe(
      "You don't have permission to request a budget change.",
    )
    expect(overCommittedMessage()).toBe('Remaining is negative — this project is over-committed.')
    expect(noCardLimitsMovedMessage()).toBe('No card limits moved.')
    expect(categoriesExceedMessage()).toBe('Category allocations exceed the approved amount.')
    expect(formulaTooLongMessage()).toBe('Expression must be at most 500 characters.')
    expect(attributeFormulaLandsInA6Message()).toBe(
      'This identifier is an attribute. Attribute formulas land in A6.',
    )
    expect(BUDGET_TERM_TOOLTIPS.committed).toBe('Approved but not yet spent')
  })
})

describe('minorToInputString', () => {
  it('formats USD minor units without parseFloat', () => {
    expect(minorToInputString(402350, 'USD')).toBe('4023.50')
    expect(minorToInputString(5000, 'JPY')).toBe('5000')
    expect(minorToInputString(-150, 'USD')).toBe('-1.50')
  })
})

describe('attributeValueForIdent', () => {
  it('finds by key', () => {
    const values = [
      { key: 'campaign.roas', value: 12 },
      { key: 'headcount', value: 8 },
    ]
    expect(attributeValueForIdent('headcount', values)?.value).toBe(8)
    expect(attributeValueForIdent('missing', values)).toBeUndefined()
  })
})

describe('A4.9 invariant proofs', () => {
  it('does not clamp remaining: -200', () => {
    const props = projectionToBudgetBarProps(
      {
        approved: 100,
        committed: 200,
        actual: 100,
        remaining: -200,
        utilisationPct: 300,
        overCommitted: true,
      },
      'USD',
    )
    expect(props.remaining).toBe(-200)
  })

  it('formulaContextFromBudget is { approvedAmount } only', () => {
    expect(formulaContextFromBudget(42)).toEqual({ approvedAmount: 42 })
    expect(Object.keys(formulaContextFromBudget(42))).toEqual(['approvedAmount'])
  })

  it('BUDGET_NAV labels are locked and Overview is not a prefix of /categories', () => {
    expect(BUDGET_NAV.map((item) => item.label)).toEqual([
      'Overview',
      'Categories',
      'History',
      'Requests',
    ])
    expect(isBudgetNavActive('/projects/p/budget/categories', 'p', '')).toBe(false)
  })

  it('MONTHLY 100 → 80 is one money-object DiffView row', () => {
    const diffs = diffCardTransactionLimits(
      snapshotCardTransactionLimits([CARD]),
      snapshotCardTransactionLimits([
        {
          ...CARD,
          desiredControls: {
            transactionLimits: {
              currency: 'USD',
              limits: [{ interval: 'MONTHLY', amount: 80 }],
            },
          },
        },
      ]),
    )
    expect(diffs).toHaveLength(1)
    const view = cardLimitDiffToDiffView(diffs)
    const key = 'Ops ************1234 MONTHLY'
    expect(view.before[key]).toEqual({ amount: 100, currency: 'USD' })
    expect(view.after[key]).toEqual({ amount: 80, currency: 'USD' })
  })

  it('budget screens and BudgetStep never mention PAN, cvv, or card_number', () => {
    function walk(dir: string): string[] {
      return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name)
        return entry.isDirectory() ? walk(path) : [path]
      })
    }

    const files = [
      ...walk(join(process.cwd(), 'src/app/(app)/projects/[id]/budget')),
      join(process.cwd(), 'src/app/(app)/projects/new/steps/BudgetStep.tsx'),
    ]
    expect(files.length).toBeGreaterThan(1)
    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      expect(src, file).not.toMatch(/\bPAN\b/)
      expect(src.toLowerCase(), file).not.toContain('cvv')
      expect(src.toLowerCase(), file).not.toContain('card_number')
    }
  })

  it('keeps requireApp, AppShell collapse, and BudgetBar md:grid-cols-4', () => {
    const layout = readFileSync(join(process.cwd(), 'src/app/(app)/layout.tsx'), 'utf8')
    expect(layout).toContain('requireApp()')
    expect(layout).toContain('AppShellFrame')
    const shell = readFileSync(join(process.cwd(), 'src/client/shell/AppShell.tsx'), 'utf8')
    expect(shell).toMatch(/aside className="[^"]*\bhidden\b/)
    expect(shell).toMatch(/aside className="[^"]*\bmd:flex\b/)
    const bar = readFileSync(join(process.cwd(), 'src/components/patterns/BudgetBar.tsx'), 'utf8')
    expect(bar).toContain('md:grid-cols-4')
    expect(bar).not.toContain('sm:grid-cols-4')
  })
})
