import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  BUILTIN_ATTRIBUTE_KEYS,
  CAMPAIGN_ANALYTICS_CONNECTOR_ID,
  DRAFT_RULE_ID,
  NEW_RULE_ID,
  RULE_TEMPLATES,
  RULE_TRIGGER_EVENTS,
  applyTemplate,
  attributeListHref,
  attributeOptions,
  attributesHref,
  automationHref,
  automationListHref,
  cardDiffToDiffView,
  cardExplainHref,
  conditionMode,
  emptyDraftRule,
  findRuleById,
  flattenRunPages,
  formatMatchPreview,
  holdsControlEdit,
  isNewRuleId,
  isProminentRunStatus,
  matchPreviewFromSimulate,
  newProjectRuleHref,
  newRuleHref,
  orgRulesHref,
  orgWideRules,
  parseAttributeListSearchParams,
  parseCommaList,
  parseConditionValue,
  parseFormulaOrInt,
  parseIntInput,
  parseOptionalIdParam,
  parseProjectControlsSearchParams,
  parseRuleListSearchParams,
  parseRuleRunSearchParams,
  parseTemplateParam,
  projectControlsHref,
  ruleBuilderHref,
  ruleListHref,
  ruleSimulateHref,
  toCreateRuleInput,
  wizardControlsLinkMessage,
  wrapNot,
} from '@/client/lib/rules'
import { controlsHref, ruleHref } from '@/client/lib/cards'
import { ConditionOperator } from '@/shared/enums/conditionOperator'
import { RuleScopeLevel } from '@/shared/enums/ruleScopeLevel'

const FULL_CONTROLS = {
  allowedTransactionCount: 'MULTIPLE',
  transactionLimits: {
    currency: 'USD',
    limits: [{ interval: 'MONTHLY', amount: 100 }],
  },
  activeFrom: null,
  activeTo: null,
  allowedCurrencies: null,
  allowedMerchantCategories: null,
  allowedMerchantCountries: null,
  allowedMerchantBrands: null,
  blockedTransactionUsages: [],
}

describe('constants', () => {
  it('locks ids, connector, and trigger events', () => {
    expect(NEW_RULE_ID).toBe('new')
    expect(DRAFT_RULE_ID).toBe('draft')
    expect(CAMPAIGN_ANALYTICS_CONNECTOR_ID).toBe('campaign-analytics')
    expect(RULE_TRIGGER_EVENTS).toContain('project.launched')
    expect(RULE_TRIGGER_EVENTS).not.toContain('rule.evaluated')
    expect(BUILTIN_ATTRIBUTE_KEYS.map((row) => row.key)).toContain('project.budget.remaining')
  })
})

describe('hrefs', () => {
  it('builds settings, builder, simulate, automation, and explain paths', () => {
    expect(orgRulesHref()).toBe('/settings/rules')
    expect(ruleListHref({ page: 1 })).toBe('/settings/rules')
    expect(ruleBuilderHref('r1')).toBe('/settings/rules/r1')
    expect(newRuleHref()).toBe('/settings/rules/new')
    expect(newRuleHref('A')).toBe('/settings/rules/new?template=A')
    expect(newProjectRuleHref('p', 'B')).toBe('/settings/rules/new?projectId=p&template=B')
    expect(ruleSimulateHref('r1')).toBe('/settings/rules/r1/simulate')
    expect(ruleSimulateHref('new')).toBe('/settings/rules/new/simulate')
    expect(automationHref()).toBe('/automation')
    expect(attributesHref()).toBe('/settings/attributes')
    expect(cardExplainHref('c1')).toBe('/cards/c1/explain')
    expect(controlsHref('p')).toBe('/projects/p/controls')
    expect(ruleHref('p', 'r 1')).toBe('/projects/p/controls?ruleId=r%201')
    expect(projectControlsHref('p', { enabled: true, ruleId: 'r1' })).toBe(
      '/projects/p/controls?enabled=true&ruleId=r1',
    )
    expect(ruleListHref({ enabled: false, page: 2 })).toBe('/settings/rules?enabled=false&page=2')
    expect(automationListHref({ status: 'PARTIAL', page: 1 })).toBe('/automation?status=PARTIAL')
    expect(attributeListHref({ scope: 'PROJECT' })).toBe('/settings/attributes?scope=PROJECT')
  })

  it('throws on empty ids', () => {
    expect(() => ruleBuilderHref('')).toThrow('ruleId is required')
    expect(() => newProjectRuleHref('')).toThrow('projectId is required')
    expect(() => ruleSimulateHref('')).toThrow('ruleId is required')
    expect(() => cardExplainHref('')).toThrow('cardId is required')
  })
})

describe('parseRuleListSearchParams', () => {
  it('maps known filters, uses array [0], and drops unknown enabled', () => {
    expect(parseRuleListSearchParams({ enabled: 'true', page: '2' })).toEqual({
      enabled: true,
      page: 2,
      pageSize: 20,
    })
    expect(parseRuleListSearchParams({ enabled: ['false'] })).toEqual({
      enabled: false,
      page: 1,
      pageSize: 20,
    })
    const dropped = parseRuleListSearchParams({ enabled: 'maybe', page: '3' })
    expect(dropped).toEqual({ page: 1, pageSize: 20 })
    expect(dropped).not.toHaveProperty('enabled')
    expect(dropped).not.toHaveProperty('holder')
  })
})

describe('parseProjectControlsSearchParams', () => {
  it('keeps ruleId and drops empty', () => {
    expect(parseProjectControlsSearchParams({ ruleId: 'r1', page: '1' })).toEqual({
      page: 1,
      pageSize: 20,
      ruleId: 'r1',
    })
    expect(parseProjectControlsSearchParams({ ruleId: '' })).toEqual({ page: 1, pageSize: 20 })
  })
})

describe('parseRuleRunSearchParams', () => {
  it('keeps known status and drops unknown', () => {
    expect(parseRuleRunSearchParams({ status: 'FAILED' })).toEqual({
      status: 'FAILED',
      page: 1,
      pageSize: 20,
    })
    expect(parseRuleRunSearchParams({ status: 'NOPE' })).toEqual({ page: 1, pageSize: 20 })
  })
})

describe('parseAttributeListSearchParams', () => {
  it('keeps known scope and drops unknown source', () => {
    expect(parseAttributeListSearchParams({ scope: 'ORG' })).toEqual({
      scope: 'ORG',
      page: 1,
      pageSize: 20,
    })
    expect(parseAttributeListSearchParams({ source: 'MAGIC' })).toEqual({ page: 1, pageSize: 20 })
  })
})

describe('ids and lookup', () => {
  it('detects new, finds by id, and parses optional ids', () => {
    expect(isNewRuleId('new')).toBe(true)
    expect(isNewRuleId('r1')).toBe(false)
    expect(findRuleById([{ id: 'a' }, { id: 'b' }], 'b')).toEqual({ id: 'b' })
    expect(findRuleById(undefined, 'a')).toBeUndefined()
    expect(parseOptionalIdParam(['x', 'y'])).toBe('x')
    expect(parseOptionalIdParam('')).toBeUndefined()
  })
})

describe('holdsControlEdit', () => {
  it('grants OWNER/ADMIN or any project with control.edit', () => {
    expect(holdsControlEdit('MEMBER', [{ permissions: ['control.edit'] }])).toBe(true)
    expect(holdsControlEdit('MEMBER', [{ permissions: ['card.view'] }])).toBe(false)
    expect(holdsControlEdit('OWNER', [])).toBe(true)
    expect(holdsControlEdit('ADMIN', undefined)).toBe(true)
    expect(holdsControlEdit(undefined, undefined)).toBe(false)
  })
})

describe('parseFormulaOrInt and related parsers', () => {
  it('keeps formulas as strings, ints as ints, and empty as empty', () => {
    expect(parseFormulaOrInt('412')).toBe(412)
    expect(parseFormulaOrInt('project.budget.remaining * 0.1')).toBe(
      'project.budget.remaining * 0.1',
    )
    expect(parseFormulaOrInt('')).toBe('')
    expect(parseFormulaOrInt('1.02')).toBe('1.02')
    expect(parseCommaList('')).toBeNull()
    expect(parseCommaList('USD, AUD')).toEqual(['USD', 'AUD'])
    expect(parseIntInput('10')).toBe(10)
    expect(parseIntInput('1.5')).toBeUndefined()
    expect(parseConditionValue('true')).toBe(true)
    expect(parseConditionValue('2.0')).toBe(2)
    expect(parseConditionValue('null')).toBeNull()
    expect(parseConditionValue('RUNNING')).toBe('RUNNING')
  })
})

describe('condition helpers', () => {
  it('reports mode and wraps a single not', () => {
    const leaf = { attr: 'project.status', op: ConditionOperator.EQ, value: 'ACTIVE' }
    expect(conditionMode(leaf)).toBe('attr')
    expect(conditionMode({ all: [leaf] })).toBe('all')
    expect(conditionMode({ not: leaf })).toBe('not')
    expect(wrapNot(leaf, true)).toEqual({ not: leaf })
    expect(wrapNot({ not: leaf }, true)).toEqual({ not: leaf })
    expect(wrapNot({ not: leaf }, false)).toEqual(leaf)
    expect(wrapNot(leaf, false)).toEqual(leaf)
  })
})

describe('templates', () => {
  it('applies scope except D which stays ORG', () => {
    const projectScope = { level: RuleScopeLevel.PROJECT, projectId: 'p' } as const
    expect(applyTemplate('D', projectScope).scope.level).toBe('ORG')
    expect(applyTemplate('B', projectScope).when).toMatchObject({
      op: ConditionOperator.CROSSED_ABOVE,
    })
    const cAmount = applyTemplate('C', projectScope).then[0]?.params.transactionLimits?.limits[0]
      ?.amount
    expect(String(cAmount)).toContain('* 200000')
    expect(String(cAmount)).not.toContain('* 2000,')
    expect(RULE_TEMPLATES.D.then[0]?.params.activeToOffsetDays).toBe(7)
    expect(JSON.stringify(RULE_TEMPLATES)).not.toContain('now()')
    expect(parseTemplateParam({ template: 'b' })).toBe('B')
    expect(parseTemplateParam({ template: 'Z' })).toBeNull()
  })
})

describe('emptyDraftRule and toCreateRuleInput', () => {
  it('omits enabled/priority and drops empty description/else', () => {
    const draft = emptyDraftRule({ level: 'ORG' })
    expect(draft.name).toBe('Untitled rule')
    expect(draft).not.toHaveProperty('enabled')
    expect(draft).not.toHaveProperty('priority')
    const cleaned = toCreateRuleInput({
      ...draft,
      description: '',
      else: [],
    })
    expect(cleaned).not.toHaveProperty('description')
    expect(cleaned).not.toHaveProperty('else')
  })
})

describe('matchPreviewFromSimulate', () => {
  it('counts unique matched cards and samples a numeric limit', () => {
    const unmatched = matchPreviewFromSimulate(
      {
        runs: [
          {
            ruleId: DRAFT_RULE_ID,
            matched: false,
            desiredState: { cards: [{ cardId: 'c1' }] },
          },
        ],
        cardDiffs: [],
      },
      DRAFT_RULE_ID,
    )
    expect(unmatched).toEqual({ matchedCardCount: 0, sampleLimit: null })
    expect(formatMatchPreview(unmatched, (m) => String(m.amount))).toBe(
      "With today's values, this rule matches no cards.",
    )

    const matched = matchPreviewFromSimulate(
      {
        runs: [
          {
            ruleId: DRAFT_RULE_ID,
            matched: true,
            desiredState: {
              cards: [
                {
                  cardId: 'c1',
                  controls: {
                    transactionLimits: {
                      currency: 'USD',
                      limits: [{ interval: 'MONTHLY', amount: 41200 }],
                    },
                  },
                },
                { cardId: 'c2' },
              ],
            },
          },
        ],
        cardDiffs: [],
      },
      DRAFT_RULE_ID,
    )
    expect(matched.matchedCardCount).toBe(2)
    expect(matched.sampleLimit).toEqual({
      interval: 'MONTHLY',
      amount: 41200,
      currency: 'USD',
    })
  })
})

describe('cardDiffToDiffView', () => {
  it('includes cardStatus and spreads controls when both sides are objects', () => {
    const view = cardDiffToDiffView({
      before: { controls: FULL_CONTROLS, cardStatus: 'ACTIVE' },
      after: {
        controls: {
          ...FULL_CONTROLS,
          transactionLimits: {
            currency: 'USD',
            limits: [{ interval: 'MONTHLY', amount: 50 }],
          },
        },
        cardStatus: 'INACTIVE',
      },
    })
    expect(view.before.cardStatus).toBe('ACTIVE')
    expect(view.after.cardStatus).toBe('INACTIVE')
    expect(view.after['limit.MONTHLY']).toEqual({ amount: 50, currency: 'USD' })
  })

  it('keeps after as cardStatus only when after.controls is null', () => {
    const view = cardDiffToDiffView({
      before: { controls: FULL_CONTROLS, cardStatus: 'ACTIVE' },
      after: { controls: null, cardStatus: 'CLOSED' },
    })
    expect(view.after).toEqual({ cardStatus: 'CLOSED' })
  })
})

describe('lists', () => {
  it('flattens run pages, flags prominent statuses, and filters org-wide rules', () => {
    expect(flattenRunPages([{ items: [1] }, { items: [2, 3] }])).toEqual([1, 2, 3])
    expect(flattenRunPages(undefined)).toEqual([])
    expect(isProminentRunStatus('FAILED')).toBe(true)
    expect(isProminentRunStatus('PARTIAL')).toBe(true)
    expect(isProminentRunStatus('SUCCESS')).toBe(false)
    expect(
      orgWideRules([
        { id: '1', scope: { level: 'ORG' } },
        { id: '2', scope: { level: 'PROJECT' } },
      ]).map((row) => row.id),
    ).toEqual(['1'])
  })
})

describe('attributeOptions', () => {
  it('lists builtins first then custom keys not already in the catalogue', () => {
    const options = attributeOptions([
      { key: 'campaign.roas', label: 'ROAS' },
      { key: 'project.status', label: 'ignored' },
    ])
    expect(options[0]).toEqual({ value: 'org.baseCurrency', label: 'Base currency' })
    expect(options.some((row) => row.value === 'campaign.roas' && row.label === 'ROAS')).toBe(true)
    expect(options.filter((row) => row.value === 'project.status')).toHaveLength(1)
    expect(options.find((row) => row.value === 'project.status')?.label).toBe('Project status')
  })
})

function walkFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? walkFiles(path) : [path]
  })
}

describe('A6.11 invariant proofs', () => {
  it('keeps 1.02 as a formula string because it is not an integer token', () => {
    expect(parseFormulaOrInt('1.02')).toBe('1.02')
    expect(typeof parseFormulaOrInt('1.02')).toBe('string')
    expect(parseFormulaOrInt('412')).toBe(412)
  })

  it('locks templates to B6-legal DSL without now()', () => {
    expect(JSON.stringify(RULE_TEMPLATES)).not.toContain('now()')
    expect(RULE_TEMPLATES.D.then[0]?.params.activeToOffsetDays).toBe(7)
    const cAmount = RULE_TEMPLATES.C.then[0]?.params.transactionLimits?.limits[0]?.amount
    expect(String(cAmount)).toContain('200000')
  })

  it('treats an empty comma list as unconstrained null', () => {
    expect(parseCommaList('')).toBeNull()
  })

  it('grants OWNER control.edit and denies MEMBER without the permission', () => {
    expect(holdsControlEdit('OWNER', [])).toBe(true)
    expect(holdsControlEdit('MEMBER', [])).toBe(false)
    expect(holdsControlEdit('MEMBER', [{ permissions: ['card.view'] }])).toBe(false)
  })

  it('formats unmatched simulate as the locked n=0 sentence', () => {
    const unmatched = matchPreviewFromSimulate(
      {
        runs: [
          {
            ruleId: DRAFT_RULE_ID,
            matched: false,
            desiredState: { cards: [{ cardId: 'c1' }] },
          },
        ],
        cardDiffs: [],
      },
      DRAFT_RULE_ID,
    )
    expect(unmatched.matchedCardCount).toBe(0)
    expect(formatMatchPreview(unmatched, (m) => String(m.amount))).toBe(
      "With today's values, this rule matches no cards.",
    )
  })

  it('locks wizard controls copy', () => {
    expect(wizardControlsLinkMessage()).toBe('Set project rules on the controls tab.')
  })

  it('A6 screens never parse, ingest, or type number, and never mention PAN', () => {
    const files = [
      ...walkFiles(join(process.cwd(), 'src/app/(app)/projects/[id]/controls')),
      ...walkFiles(join(process.cwd(), 'src/app/(app)/settings/rules')),
      ...walkFiles(join(process.cwd(), 'src/app/(app)/settings/attributes')),
      ...walkFiles(join(process.cwd(), 'src/app/(app)/automation')),
      ...walkFiles(join(process.cwd(), 'src/app/(app)/cards/[id]/explain')),
    ]
    expect(files.length).toBeGreaterThan(1)
    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      expect(src, file).not.toContain('eval(')
      expect(src, file).not.toContain('new Function')
      expect(src, file).not.toContain('useValidateFormula')
      expect(src, file).not.toContain('useSimulatePurchase')
      expect(src, file).not.toContain('attributeContracts.ingest')
      expect(src, file).not.toContain('useIngest')
      expect(src, file).not.toContain('type="number"')
      expect(src, file).not.toContain('parseFloat')
      expect(src, file).not.toMatch(/\bPAN\b/)
      expect(src.toLowerCase(), file).not.toContain('cvv')
      expect(src.toLowerCase(), file).not.toContain('card_number')
    }
  })

  it('keeps requireApp, AppShell collapse, and Automation after Activity', () => {
    const layout = readFileSync(join(process.cwd(), 'src/app/(app)/layout.tsx'), 'utf8')
    expect(layout).toContain('requireApp()')
    expect(layout).toContain('AppShellFrame')
    const shell = readFileSync(join(process.cwd(), 'src/client/shell/AppShell.tsx'), 'utf8')
    expect(shell).toMatch(/aside className="[^"]*\bhidden\b/)
    expect(shell).toMatch(/aside className="[^"]*\bmd:flex\b/)
    const activityAt = shell.indexOf("{ href: '/activity', label: 'Activity' }")
    const automationAt = shell.indexOf("{ href: '/automation', label: 'Automation' }")
    const reviewsAt = shell.indexOf("{ href: '/settings/access-reviews', label: 'Access reviews' }")
    const rulesAt = shell.indexOf("{ href: '/settings/rules', label: 'Rules' }")
    const attributesAt = shell.indexOf("{ href: '/settings/attributes', label: 'Attributes' }")
    expect(activityAt).toBeGreaterThan(-1)
    expect(automationAt).toBeGreaterThan(activityAt)
    expect(rulesAt).toBeGreaterThan(reviewsAt)
    expect(attributesAt).toBeGreaterThan(rulesAt)
  })
})
