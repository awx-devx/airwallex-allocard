import { describe, expect, it } from 'vitest'
import {
  AIRWALLEX_PCI_CSS_CLASSES,
  AIRWALLEX_PCI_IFRAME_ORIGIN,
  AIRWALLEX_PCI_MESSAGE_ORIGINS,
  CLOSE_CONFIRM_PHRASE,
  accessListNames,
  airwallexRevealIframeSrc,
  canCloseCard,
  canEditCardMeta,
  canFreezeCard,
  canRevealCard,
  canUnfreezeCard,
  cardHref,
  cardLimitsToMeters,
  cardListHref,
  cardRevealHref,
  cardholderScreeningMessage,
  classifyRevealMessage,
  closedCardMessage,
  controlsDiverge,
  controlsHref,
  controlsToDiffView,
  failedCreateMessage,
  flattenTransactionPages,
  frozenCardMessage,
  holderLabel,
  iframeErrorMessage,
  iframePendingMessage,
  isAirwallexPciOrigin,
  isClosed,
  isFailed,
  isFrozen,
  isPendingAirwallexId,
  isPendingCreate,
  isScreeningCardholder,
  isSingleUse,
  isSingleUseUsed,
  isTerminalLost,
  lostCardMessage,
  manageCardDenialMessage,
  orgCardsHref,
  parseCardListSearchParams,
  parseProjectCardListSearchParams,
  pendingCreateMessage,
  projectCardListHref,
  projectCardsHref,
  revealAuditedMessage,
  revealCardDenialMessage,
  ruleHref,
  singleUseUsedMessage,
  tokenIsExpired,
} from '@/client/lib/cards'

const APPLIED = {
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

describe('PCI constants', () => {
  it('locks iframe origin, message origins, CSS classes, and CLOSE phrase', () => {
    expect(AIRWALLEX_PCI_IFRAME_ORIGIN).toBe('https://airwallex.com')
    expect([...AIRWALLEX_PCI_MESSAGE_ORIGINS]).toEqual([
      'https://airwallex.com',
      'https://www.airwallex.com',
    ])
    expect(AIRWALLEX_PCI_CSS_CLASSES).toEqual({
      cardNumberRow: 'details__row--card-number',
      value: 'details__value',
    })
    expect(CLOSE_CONFIRM_PHRASE).toBe('CLOSE')
  })
})

describe('hrefs', () => {
  it('builds card, reveal, project, controls, and rule paths', () => {
    expect(orgCardsHref()).toBe('/cards')
    expect(cardHref('c1')).toBe('/cards/c1')
    expect(cardRevealHref('c1')).toBe('/cards/c1/reveal')
    expect(projectCardsHref('p')).toBe('/projects/p/cards')
    expect(controlsHref('p')).toBe('/projects/p/controls')
    expect(ruleHref('p', 'r 1')).toBe('/projects/p/controls?ruleId=r%201')
  })

  it('throws on empty ids', () => {
    expect(() => cardHref('')).toThrow('cardId is required')
    expect(() => cardRevealHref('')).toThrow('cardId is required')
    expect(() => projectCardsHref('')).toThrow('projectId is required')
    expect(() => controlsHref('')).toThrow('projectId is required')
    expect(() => ruleHref('', 'r')).toThrow('projectId is required')
    expect(() => ruleHref('p', '')).toThrow('ruleId is required')
  })
})

describe('parseCardListSearchParams', () => {
  it('maps known filters and drops unknown status', () => {
    expect(parseCardListSearchParams({ status: 'ACTIVE', page: '2' })).toEqual({
      status: 'ACTIVE',
      page: 2,
      pageSize: 20,
    })
    expect(parseCardListSearchParams({ status: 'NOPE' })).toEqual({ page: 1, pageSize: 20 })
  })

  it('uses the first array value and has no holder key', () => {
    const parsed = parseCardListSearchParams({
      projectId: ['proj_1'],
      purpose: ['SHARED', 'VENDOR'],
    })
    expect(parsed).toEqual({
      projectId: 'proj_1',
      purpose: 'SHARED',
      page: 1,
      pageSize: 20,
    })
    expect(parsed).not.toHaveProperty('holder')
    expect(
      parseCardListSearchParams({ holder: 'x', status: 'ACTIVE' } as never),
    ).not.toHaveProperty('holder')
  })
})

describe('cardListHref', () => {
  it('omits default page and pageSize', () => {
    expect(cardListHref({ page: 1 })).toBe('/cards')
    expect(cardListHref({ status: 'ACTIVE', page: 2, pageSize: 50 })).toBe(
      '/cards?status=ACTIVE&page=2&pageSize=50',
    )
  })
})

describe('project card list query', () => {
  it('parses and builds hrefs without a holder key', () => {
    expect(parseProjectCardListSearchParams({ purpose: 'VENDOR', pageSize: '10' })).toEqual({
      purpose: 'VENDOR',
      page: 1,
      pageSize: 10,
    })
    expect(parseProjectCardListSearchParams({ status: 'NOPE' })).toEqual({
      page: 1,
      pageSize: 20,
    })
    expect(projectCardListHref('p', { page: 1 })).toBe('/projects/p/cards')
    expect(projectCardListHref('p', { status: 'FAILED', page: 3 })).toBe(
      '/projects/p/cards?status=FAILED&page=3',
    )
  })
})

describe('status helpers', () => {
  it('classifies lifecycle and reveal eligibility', () => {
    expect(isPendingCreate('PENDING')).toBe(true)
    expect(isPendingAirwallexId('pending:abc')).toBe(true)
    expect(isPendingAirwallexId('awx_1')).toBe(false)
    expect(isFrozen('INACTIVE')).toBe(true)
    expect(isClosed('CLOSED')).toBe(true)
    expect(isFailed('FAILED')).toBe(true)
    expect(isTerminalLost('BLOCKED')).toBe(true)
    expect(isTerminalLost('LOST')).toBe(true)
    expect(isTerminalLost('STOLEN')).toBe(true)
    expect(isTerminalLost('ACTIVE')).toBe(false)
    expect(canRevealCard('ACTIVE', 'pending:abc')).toBe(false)
    expect(canRevealCard('CLOSED', 'awx')).toBe(false)
    expect(canRevealCard('ACTIVE', 'awx')).toBe(true)
    expect(canRevealCard('INACTIVE', 'awx')).toBe(true)
    expect(canFreezeCard('ACTIVE')).toBe(true)
    expect(canUnfreezeCard('INACTIVE')).toBe(true)
    expect(canCloseCard('ACTIVE')).toBe(true)
    expect(canCloseCard('CLOSED')).toBe(false)
    expect(canEditCardMeta('INACTIVE')).toBe(true)
    expect(canEditCardMeta('PENDING')).toBe(false)
    expect(isScreeningCardholder('PENDING')).toBe(true)
    expect(isScreeningCardholder('INCOMPLETE')).toBe(true)
    expect(isScreeningCardholder('READY')).toBe(false)
    expect(isSingleUse('SINGLE')).toBe(true)
    expect(
      isSingleUseUsed({
        allowedTransactionCount: 'SINGLE',
        status: 'ACTIVE',
        transactionCount: 1,
      }),
    ).toBe(true)
    expect(
      isSingleUseUsed({
        allowedTransactionCount: 'SINGLE',
        status: 'CLOSED',
        transactionCount: 0,
      }),
    ).toBe(true)
    expect(
      isSingleUseUsed({
        allowedTransactionCount: 'MULTIPLE',
        status: 'ACTIVE',
        transactionCount: 4,
      }),
    ).toBe(false)
  })
})

describe('controls diff', () => {
  it('detects MONTHLY amount changes and emits money objects', () => {
    const desired = {
      ...APPLIED,
      transactionLimits: {
        currency: 'USD',
        limits: [{ interval: 'MONTHLY', amount: 80 }],
      },
    }
    expect(controlsDiverge(desired, APPLIED)).toBe(true)
    expect(controlsDiverge(APPLIED, APPLIED)).toBe(false)
    const view = controlsToDiffView(APPLIED, desired)
    expect(view.before['limit.MONTHLY']).toEqual({ amount: 100, currency: 'USD' })
    expect(view.after['limit.MONTHLY']).toEqual({ amount: 80, currency: 'USD' })
  })

  it('leaves a missing interval undefined on that side', () => {
    const desired = {
      ...APPLIED,
      transactionLimits: {
        currency: 'USD',
        limits: [
          { interval: 'MONTHLY', amount: 100 },
          { interval: 'DAILY', amount: 10 },
        ],
      },
    }
    const view = controlsToDiffView(APPLIED, desired)
    expect(view.before['limit.DAILY']).toBeUndefined()
    expect(view.after['limit.DAILY']).toEqual({ amount: 10, currency: 'USD' })
  })
})

describe('reveal iframe', () => {
  it('builds the integration §8 src and rejects empty ids', () => {
    expect(airwallexRevealIframeSrc('awx_1', 'tok')).toBe(
      'https://airwallex.com/issuing/pci/v2/awx_1/details#tok',
    )
    expect(() => airwallexRevealIframeSrc('', 'tok')).toThrow()
    expect(() => airwallexRevealIframeSrc('awx_1', '')).toThrow()
    expect(isAirwallexPciOrigin('https://airwallex.com')).toBe(true)
    expect(isAirwallexPciOrigin('https://evil.example')).toBe(false)
  })

  it('classifies postMessage payloads', () => {
    expect(classifyRevealMessage({ type: 'pciError' })).toBe('error')
    expect(classifyRevealMessage({ type: 'ready' })).toBe('ready')
    expect(classifyRevealMessage('nope')).toBe('ignore')
    expect(classifyRevealMessage({ type: 1 })).toBe('ignore')
  })

  it('treats invalid expiresAt as expired', () => {
    expect(tokenIsExpired('not-a-date', 0)).toBe(true)
    expect(tokenIsExpired('2026-08-16T00:00:00.000Z', Date.parse('2026-08-16T00:00:00.000Z'))).toBe(
      true,
    )
    expect(tokenIsExpired('2026-08-16T00:00:01.000Z', Date.parse('2026-08-16T00:00:00.000Z'))).toBe(
      false,
    )
  })
})

describe('labels and lists', () => {
  it('prefers userName, then userId, then type+status', () => {
    expect(holderLabel({ type: 'DELEGATE', status: 'READY', userId: 'u1' }, 'Ada')).toBe('Ada')
    expect(holderLabel({ type: 'DELEGATE', status: 'READY', userId: 'u1' }, undefined)).toBe('u1')
    expect(holderLabel({ type: 'DELEGATE', status: 'READY', userId: null }, undefined)).toBe(
      'DELEGATE READY',
    )
  })

  it('keeps accessList order and falls back to the raw id', () => {
    expect(
      accessListNames(
        ['a', 'b'],
        [{ user: { id: 'b', name: 'Bea' } }, { userId: 'a', user: { id: 'a', name: 'Ann' } }],
      ),
    ).toEqual([
      { userId: 'a', name: 'Ann' },
      { userId: 'b', name: 'Bea' },
    ])
    expect(accessListNames(['missing'], [])).toEqual([{ userId: 'missing', name: 'missing' }])
  })

  it('flattens transaction pages and passes remaining through unclamped', () => {
    expect(flattenTransactionPages(undefined)).toEqual([])
    expect(flattenTransactionPages([{ items: [1] }, { items: [2, 3] }])).toEqual([1, 2, 3])
    expect(
      cardLimitsToMeters({
        currency: 'USD',
        limits: [{ interval: 'MONTHLY', amount: 100, remaining: -1 }],
      }),
    ).toEqual([{ interval: 'MONTHLY', amount: 100, remaining: -1, currency: 'USD' }])
  })
})

describe('locked copy', () => {
  it('matches §13 sentences', () => {
    expect(manageCardDenialMessage()).toBe("You don't have permission to manage this card.")
    expect(revealCardDenialMessage()).toContain('audited')
    expect(revealCardDenialMessage()).toBe(
      "You don't have permission to reveal card details. Reveals are audited.",
    )
    expect(revealAuditedMessage()).toBe('Revealing card details is audited.')
    expect(pendingCreateMessage()).toBe('This card is still being created.')
    expect(cardholderScreeningMessage()).toBe(
      'The cardholder is still screening. The card issues when the cardholder is READY.',
    )
    expect(failedCreateMessage()).toBe('Card creation failed.')
    expect(frozenCardMessage()).toBe('This card is frozen.')
    expect(closedCardMessage()).toBe('This card is closed. It is kept for transaction history.')
    expect(singleUseUsedMessage()).toBe('This single-use card has been used.')
    expect(iframePendingMessage()).toBe('Card details are not available until the card is issued.')
    expect(iframeErrorMessage()).toBe('The secure card frame failed to load.')
    expect(lostCardMessage('LOST')).toBe('This card is LOST.')
  })
})
