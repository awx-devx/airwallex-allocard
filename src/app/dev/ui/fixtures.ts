import { ActorType } from '@/shared/enums/audit'
import { CardPurpose } from '@/shared/enums/cardPurpose'
import { CardStatus } from '@/shared/enums/cardStatus'
import { ConditionOperator } from '@/shared/enums/conditionOperator'
import { DesiredCardStatus } from '@/shared/enums/desiredCardStatus'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import { RuleActionType } from '@/shared/enums/ruleActionType'
import { RuleTargetSelect } from '@/shared/enums/ruleTargetSelect'
import { TransactionLimitInterval } from '@/shared/enums/transactionLimitInterval'
import type { CardControlsDiff } from '@/shared/types/ruleRun'
import type { RuleSentenceInput } from '@/lib/rules/sentence'
import type { TimelineItem } from '@/components/patterns/types'

export const budgetHealthy = {
  currency: 'USD',
  approved: 5_000_000,
  committed: 1_840_000,
  actual: 2_215_050,
  remaining: 944_950,
  utilisationPct: 81,
  overCommitted: false,
} as const

export const budgetOver = {
  currency: 'USD',
  approved: 1_000_000,
  committed: 700_000,
  actual: 500_000,
  remaining: -200_000,
  utilisationPct: 120,
  overCommitted: true,
} as const

export const budgetZero = {
  currency: 'USD',
  approved: 0,
  committed: 0,
  actual: 0,
  remaining: 0,
} as const

export const budgetZeroWithSpend = {
  currency: 'USD',
  approved: 0,
  committed: 0,
  actual: 50_000,
  remaining: -50_000,
} as const

export const budgetFull = {
  currency: 'USD',
  approved: 1_000_000,
  committed: 0,
  actual: 1_000_000,
  remaining: 0,
} as const

export const limitJpyMonthly = {
  interval: TransactionLimitInterval.MONTHLY,
  amount: 500_000,
  remaining: 120_000,
  currency: 'JPY',
} as const

export const limitEmpty = {
  interval: TransactionLimitInterval.MONTHLY,
  amount: 100_000,
  remaining: 100_000,
  currency: 'USD',
} as const

export const limitFull = {
  interval: TransactionLimitInterval.MONTHLY,
  amount: 100_000,
  remaining: 0,
  currency: 'USD',
} as const

export const limitOver = {
  interval: TransactionLimitInterval.MONTHLY,
  amount: 100_000,
  remaining: -5_000,
  currency: 'USD',
} as const

export const cardAws = {
  nickName: 'AWS — Q3 infra',
  maskedNumber: '************4242',
  status: CardStatus.ACTIVE,
  purpose: CardPurpose.SHARED,
} as const

export const cardStatuses = [
  CardStatus.PENDING,
  CardStatus.INACTIVE,
  CardStatus.CLOSED,
  CardStatus.FAILED,
] as const

export const attributeFresh = {
  value: 3.2,
  label: 'Campaign ROAS',
  unit: 'x',
  observedAt: '2026-08-14T10:50:00.000Z',
  ttlSec: 900,
  now: new Date('2026-08-14T10:55:00.000Z'),
} as const

export const attributeStale = {
  ...attributeFresh,
  observedAt: '2026-08-14T09:00:00.000Z',
} as const

export const attributeTtlNull = {
  ...attributeFresh,
  ttlSec: null,
} as const

export const freezeOnUtilisationRule: RuleSentenceInput = {
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
}

export const timelineItems: TimelineItem[] = [
  {
    id: 'act_maya',
    at: '2026-08-14T09:12:00.000Z',
    actorType: ActorType.USER,
    actorId: 'user_maya',
    actorName: 'Maya Chen',
    summary: 'Maya Chen approved $4,023.50',
  },
  {
    id: 'act_rule',
    at: '2026-08-14T10:01:00.000Z',
    actorType: ActorType.RULE,
    actorId: 'rule_freeze',
    summary: 'Freeze member cards — utilisation crossed below 10%',
  },
  {
    id: 'act_system',
    at: '2026-08-14T11:20:00.000Z',
    actorType: ActorType.SYSTEM,
    actorId: 'system',
    summary: 'Nightly reconciliation completed',
  },
  {
    id: 'act_airwallex',
    at: '2026-08-14T12:04:00.000Z',
    actorType: ActorType.AIRWALLEX,
    actorId: 'awx',
    summary: 'Authorization captured for AWS — Q3 infra',
  },
]

export const diffAudit = {
  before: { status: 'ACTIVE' },
  after: { status: 'INACTIVE' },
} as const

export const diffCardControls: CardControlsDiff = {
  cardId: 'card_aws_q3',
  changed: true,
  before: { controls: null, cardStatus: DesiredCardStatus.ACTIVE },
  after: { controls: null, cardStatus: DesiredCardStatus.INACTIVE },
}

export const tableProjects = [
  { id: 'proj_q3', name: 'Q3 Brand Campaign', code: 'Q3-BRAND', status: ProjectStatus.ACTIVE },
  { id: 'proj_tyo', name: 'Tokyo Vendor Pilot', code: 'TYO-VENDOR', status: ProjectStatus.DRAFT },
  { id: 'proj_off', name: 'Closed Offsite', code: 'OFFSITE-24', status: ProjectStatus.CLOSED },
] as const

export const moneyUsd = { amount: 402_350, currency: 'USD' } as const
export const moneyJpy = { amount: 4023, currency: 'JPY' } as const
export const moneyNegative = { amount: -200_000, currency: 'USD' } as const
