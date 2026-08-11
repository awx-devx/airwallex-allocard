import { describe, expect, it } from 'vitest'
import { actionLabel, operatorLabel } from '@/lib/rules/operators'
import { ruleToSentence, stubActionForType, stubConditionForOperator } from '@/lib/rules/sentence'
import { ConditionOperator } from '@/shared/enums/conditionOperator'
import { RuleActionType } from '@/shared/enums/ruleActionType'
import { RuleTargetSelect } from '@/shared/enums/ruleTargetSelect'

describe('lib/rules/sentence', () => {
  it('renders nested all/any/not conditions', () => {
    const all = ruleToSentence({
      when: {
        all: [
          { attr: 'project.status', op: ConditionOperator.EQ, value: 'ACTIVE' },
          { attr: 'project.budget.remaining', op: ConditionOperator.GT, value: 0 },
        ],
      },
      then: [stubActionForType(RuleActionType.CARD_SET_CONTROLS)],
    })
    expect(all).toContain('project status equals "ACTIVE"')
    expect(all).toContain('remaining budget is greater than 0')

    const any = ruleToSentence({
      when: {
        any: [{ attr: 'card.status', op: ConditionOperator.EQ, value: 'ACTIVE' }],
      },
      then: [stubActionForType(RuleActionType.NOTIFY)],
    })
    expect(any).toContain('any of')

    const not = ruleToSentence({
      when: {
        not: { attr: 'project.status', op: ConditionOperator.EQ, value: 'CLOSED' },
      },
      then: [stubActionForType(RuleActionType.NOTIFY)],
    })
    expect(not).toContain('not (')
  })

  it('covers every ConditionOperator in a sentence', () => {
    for (const op of Object.values(ConditionOperator)) {
      let value: unknown = 10
      if (op === ConditionOperator.IN || op === ConditionOperator.NIN) {
        value = ['A', 'B']
      }
      if (op === ConditionOperator.BETWEEN) {
        value = [0, 100]
      }
      if (op === ConditionOperator.CONTAINS) {
        value = 'foo'
      }
      if (op === ConditionOperator.CHANGED_BY) {
        value = 5
      }
      const sentence = ruleToSentence({
        when: stubConditionForOperator(op, value as never),
        then: [stubActionForType(RuleActionType.NOTIFY)],
      })
      expect(sentence.toLowerCase()).toContain(operatorLabel(op).split(' ')[0]!)
    }
  })

  it('covers every RuleActionType in a sentence', () => {
    for (const action of Object.values(RuleActionType)) {
      const sentence = ruleToSentence({
        when: {
          attr: 'project.budget.utilisationPct',
          op: ConditionOperator.CROSSED_BELOW,
          value: 10,
        },
        then: [stubActionForType(action)],
      })
      expect(sentence).toContain(actionLabel(action))
    }
  })

  it('renders crossedBelow example from spec', () => {
    const sentence = ruleToSentence({
      when: {
        attr: 'project.budget.utilisationPct',
        op: ConditionOperator.CROSSED_BELOW,
        value: 10,
      },
      then: [
        {
          action: RuleActionType.CARD_FREEZE,
          target: { select: RuleTargetSelect.MEMBER_CARDS },
          params: {},
        },
      ],
    })
    expect(sentence).toMatch(/crosses below 10/i)
    expect(sentence).toMatch(/freeze card\(s\)/i)
    expect(sentence).toMatch(/member cards/i)
  })

  it('includes else branch when present', () => {
    const sentence = ruleToSentence({
      when: { attr: 'project.status', op: ConditionOperator.EQ, value: 'ACTIVE' },
      then: [stubActionForType(RuleActionType.NOTIFY)],
      else: [stubActionForType(RuleActionType.FLAG_REVIEW)],
    })
    expect(sentence).toContain('otherwise')
  })
})
