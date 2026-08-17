import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cardExplainHref } from '@/client/lib/rules'
import { cardHref, closedCardMessage, flattenTransactionPages } from '@/client/lib/cards'
import {
  RECEIPT_CONTENT_TYPES,
  RECEIPT_MAX_BASE64_CHARS,
  RECEIPT_THRESHOLD_MINOR,
  activityHref,
  authClearingDiffer,
  authorizationAmount,
  base64FromDataUrl,
  billingDiffers,
  clearingAmount,
  declineReason,
  declinedHref,
  declinedListHref,
  holdsTransactionView,
  isOptimisticReceiptId,
  isPendingAuthorization,
  isReversalType,
  lifecycleSorted,
  needsReceipt,
  parseDeclinedSearchParams,
  parseIsoQueryParam,
  parseOptionalIdParam,
  parseReceiptsSearchParams,
  parseTransactionListSearchParams,
  parseTxStatusParam,
  projectActivityHref,
  receiptContentType,
  receiptLabel,
  receiptsHref,
  receiptsListHref,
  requiresProjectIdOnTxList,
  transactionHref,
  transactionListHref,
  transactionStatusLabel,
  transactionTypeLabel,
  transactionsHref,
} from '@/client/lib/transactions'

describe('constants and hrefs', () => {
  it('locks threshold, receipt types, and paths', () => {
    expect(RECEIPT_THRESHOLD_MINOR).toBe(5000)
    expect(RECEIPT_MAX_BASE64_CHARS).toBe(10 * 1024 * 1024)
    expect(RECEIPT_CONTENT_TYPES).toEqual([
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
    ])
    expect(activityHref()).toBe('/activity')
    expect(transactionsHref()).toBe('/transactions')
    expect(declinedHref()).toBe('/transactions/declined')
    expect(receiptsHref()).toBe('/receipts')
    expect(transactionHref('t1')).toBe('/transactions/t1')
    expect(projectActivityHref('p')).toBe('/projects/p/activity')
    expect(cardHref('c1')).toBe('/cards/c1')
    expect(cardExplainHref('c1')).toBe('/cards/c1/explain')
    expect(closedCardMessage()).toBe('This card is closed. It is kept for transaction history.')
    expect(flattenTransactionPages(undefined)).toEqual([])
  })

  it('throws on empty ids', () => {
    expect(() => transactionHref('')).toThrow('transactionId is required')
    expect(() => projectActivityHref('')).toThrow('projectId is required')
  })
})

describe('parseTransactionListSearchParams', () => {
  it('drops page, merchant, and invalid status', () => {
    const parsed = parseTransactionListSearchParams({
      status: 'NOPE',
      merchant: 'x',
      page: '2',
    } as never)
    expect(parsed).toEqual({})
    expect('status' in parsed).toBe(false)
    expect('merchant' in parsed).toBe(false)
    expect('page' in parsed).toBe(false)
  })

  it('keeps legal filters and omits empty ids', () => {
    expect(
      parseTransactionListSearchParams({
        projectId: 'p',
        cardId: '',
        status: 'CLEARED',
        from: '2026-01-01T00:00:00.000Z',
      }),
    ).toEqual({
      projectId: 'p',
      status: 'CLEARED',
      from: '2026-01-01T00:00:00.000Z',
    })
  })
})

describe('href builders', () => {
  it('omits empty keys and does not put page in the URL', () => {
    expect(transactionListHref({})).toBe('/transactions')
    expect(transactionListHref({ projectId: 'p', status: 'CLEARED' })).toBe(
      '/transactions?projectId=p&status=CLEARED',
    )
    expect(declinedListHref({ projectId: 'p' })).toBe('/transactions/declined?projectId=p')
    expect(receiptsListHref({ projectId: 'p' })).toBe('/receipts?projectId=p')
  })
})

describe('parseDeclinedSearchParams', () => {
  it('drops status if present', () => {
    const parsed = parseDeclinedSearchParams({ status: 'CLEARED' } as never)
    expect(parsed).toEqual({})
    expect('status' in parsed).toBe(false)
  })
})

describe('parse helpers', () => {
  it('parseOptionalIdParam uses first array item and drops empty', () => {
    expect(parseOptionalIdParam(['p', 'x'])).toBe('p')
    expect(parseOptionalIdParam('')).toBeUndefined()
    expect(parseOptionalIdParam(undefined)).toBeUndefined()
  })

  it('parseTxStatusParam and parseIsoQueryParam reject junk', () => {
    expect(parseTxStatusParam('AUTHORIZED')).toBe('AUTHORIZED')
    expect(parseTxStatusParam('NOPE')).toBeUndefined()
    expect(parseIsoQueryParam('2026-01-01T00:00:00.000Z')).toBe('2026-01-01T00:00:00.000Z')
    expect(parseIsoQueryParam('not-a-date')).toBeUndefined()
  })

  it('parseReceiptsSearchParams has no status or cardId', () => {
    const parsed = parseReceiptsSearchParams({
      projectId: 'p',
      status: 'CLEARED',
      cardId: 'c',
    } as never)
    expect(parsed).toEqual({ projectId: 'p' })
    expect('status' in parsed).toBe(false)
    expect('cardId' in parsed).toBe(false)
  })
})

describe('permissions', () => {
  it('holdsTransactionView and requiresProjectIdOnTxList', () => {
    expect(holdsTransactionView('MEMBER', [{ permissions: ['transaction.view'] }])).toBe(true)
    expect(holdsTransactionView('MEMBER', [{ permissions: ['payment.make'] }])).toBe(false)
    expect(holdsTransactionView('OWNER', [])).toBe(true)
    expect(requiresProjectIdOnTxList('MEMBER')).toBe(true)
    expect(requiresProjectIdOnTxList('OWNER')).toBe(false)
    expect(requiresProjectIdOnTxList('ADMIN')).toBe(false)
  })
})

describe('money and receipts', () => {
  it('billingDiffers requires two length-3 codes', () => {
    expect(billingDiffers('USD', 'EUR')).toBe(true)
    expect(billingDiffers('USD', 'USD')).toBe(false)
    expect(billingDiffers('US', 'EUR')).toBe(false)
  })

  it('needsReceipt does not clamp and ignores non-CLEARED', () => {
    expect(needsReceipt({ status: 'CLEARED', receiptFileId: null, amount: 5000 })).toBe(true)
    expect(needsReceipt({ status: 'CLEARED', receiptFileId: null, amount: 4999 })).toBe(false)
    expect(needsReceipt({ status: 'AUTHORIZED', receiptFileId: null, amount: 9000 })).toBe(false)
    expect(needsReceipt({ status: 'CLEARED', receiptFileId: 'f', amount: 9000 })).toBe(false)
    expect(needsReceipt({ status: 'CLEARED', receiptFileId: null, amount: -9000 })).toBe(false)
  })

  it('receiptLabel prefers attached then required', () => {
    expect(receiptLabel({ status: 'CLEARED', receiptFileId: 'f1', amount: 9000 })).toBe(
      'Receipt attached.',
    )
    expect(receiptLabel({ status: 'CLEARED', receiptFileId: null, amount: 5000 })).toBe(
      'Receipt required.',
    )
    expect(receiptLabel({ status: 'AUTHORIZED', receiptFileId: null, amount: 9000 })).toBe(
      'No receipt required.',
    )
  })
})

describe('decline and lifecycle', () => {
  it('declineReason uses fallback when empty', () => {
    expect(declineReason(null)).toBe('No reason recorded.')
    expect(declineReason('')).toBe('No reason recorded.')
    expect(declineReason('LIMIT_EXCEEDED')).toBe('LIMIT_EXCEEDED')
  })

  it('lifecycleSorted does not mutate and sorts by transactedAt then id', () => {
    const input = [
      { id: 'b', transactedAt: '2026-01-02T00:00:00.000Z' },
      { id: 'a', transactedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'c', transactedAt: '2026-01-01T00:00:00.000Z' },
    ]
    const copy = [...input]
    expect(lifecycleSorted(input).map((row) => row.id)).toEqual(['a', 'c', 'b'])
    expect(input).toEqual(copy)
  })

  it('authorizationAmount is the last AUTHORIZATION or INCREMENTAL', () => {
    expect(
      authorizationAmount([
        { type: 'AUTHORIZATION', amount: 100 },
        { type: 'INCREMENTAL_AUTHORIZATION', amount: 120 },
        { type: 'CLEARING', amount: 90 },
      ]),
    ).toBe(120)
    expect(authorizationAmount([{ type: 'CLEARING', amount: 90 }])).toBeNull()
  })

  it('clearingAmount and authClearingDiffer', () => {
    expect(
      authClearingDiffer([
        { type: 'AUTHORIZATION', amount: 100 },
        { type: 'CLEARING', amount: 90 },
      ]),
    ).toBe(true)
    expect(
      authClearingDiffer([
        { type: 'AUTHORIZATION', amount: 100 },
        { type: 'CLEARING', amount: 100 },
      ]),
    ).toBe(false)
    expect(clearingAmount([{ type: 'PARTIAL_CLEARING', amount: 40 }])).toBe(40)
    expect(authClearingDiffer([{ type: 'AUTHORIZATION', amount: 100 }])).toBe(false)
  })

  it('isPendingAuthorization and isReversalType', () => {
    expect(isPendingAuthorization('AUTHORIZED', [{ type: 'AUTHORIZATION' }])).toBe(true)
    expect(
      isPendingAuthorization('AUTHORIZED', [
        { type: 'AUTHORIZATION' },
        { type: 'PARTIAL_CLEARING' },
      ]),
    ).toBe(false)
    expect(isPendingAuthorization('CLEARED', [])).toBe(false)
    expect(isReversalType('REVERSAL_AUTH')).toBe(true)
    expect(isReversalType('CLEARING')).toBe(false)
  })
})

describe('labels and receipt bytes', () => {
  it('humanises status and type', () => {
    expect(transactionStatusLabel('AUTHORIZED')).toBe('Authorized')
    expect(transactionTypeLabel('PARTIAL_CLEARING')).toBe('Partial clearing')
  })

  it('receiptContentType maps jpg and rejects plain text', () => {
    expect(receiptContentType('image/jpg')).toBe('image/jpeg')
    expect(receiptContentType('image/png')).toBe('image/png')
    expect(receiptContentType('text/plain')).toBeNull()
  })

  it('base64FromDataUrl strips the prefix', () => {
    expect(base64FromDataUrl('data:image/png;base64,QQ==')).toBe('QQ==')
    expect(base64FromDataUrl('QQ==')).toBe('QQ==')
  })

  it('isOptimisticReceiptId', () => {
    expect(isOptimisticReceiptId('optimistic-receipt')).toBe(true)
    expect(isOptimisticReceiptId('file_1')).toBe(false)
    expect(isOptimisticReceiptId(null)).toBe(false)
  })
})

function walkFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? walkFiles(path) : [path]
  })
}

describe('A8.8 invariant proofs', () => {
  it('does not clamp needsReceipt and does not mutate lifecycle inputs', () => {
    expect(needsReceipt({ status: 'CLEARED', receiptFileId: null, amount: 5000 })).toBe(true)
    expect(needsReceipt({ status: 'CLEARED', receiptFileId: null, amount: 4999 })).toBe(false)
    expect(needsReceipt({ status: 'CLEARED', receiptFileId: null, amount: -9000 })).toBe(false)
    const input = [
      { id: 'b', transactedAt: '2026-01-02T00:00:00.000Z' },
      { id: 'a', transactedAt: '2026-01-01T00:00:00.000Z' },
    ]
    const copy = [...input]
    lifecycleSorted(input)
    expect(input).toEqual(copy)
    expect(
      authClearingDiffer([
        { type: 'AUTHORIZATION', amount: 100 },
        { type: 'CLEARING', amount: 90 },
      ]),
    ).toBe(true)
    expect(authClearingDiffer([{ type: 'AUTHORIZATION', amount: 100 }])).toBe(false)
    expect(
      authClearingDiffer([
        { type: 'AUTHORIZATION', amount: 100 },
        { type: 'CLEARING', amount: 100 },
      ]),
    ).toBe(false)
  })

  it('drops page, merchant, and invalid status from list search params', () => {
    const parsed = parseTransactionListSearchParams({
      status: 'NOPE',
      merchant: 'x',
      page: '2',
    } as never)
    expect('status' in parsed).toBe(false)
    expect('merchant' in parsed).toBe(false)
    expect('page' in parsed).toBe(false)
  })

  it('requires projectId on MEMBER lists and not OWNER', () => {
    expect(requiresProjectIdOnTxList('MEMBER')).toBe(true)
    expect(requiresProjectIdOnTxList('OWNER')).toBe(false)
  })

  it('strips data-URL prefix and maps image/jpg', () => {
    expect(base64FromDataUrl('data:image/png;base64,QQ==')).toBe('QQ==')
    expect(receiptContentType('image/jpg')).toBe('image/jpeg')
  })

  it('A8 screens never import a client ledger, type number, or mention PAN', () => {
    const files = [
      ...walkFiles(join(process.cwd(), 'src/app/(app)/activity')),
      ...walkFiles(join(process.cwd(), 'src/app/(app)/transactions')),
      ...walkFiles(join(process.cwd(), 'src/app/(app)/receipts')),
      ...walkFiles(join(process.cwd(), 'src/app/(app)/projects/[id]/activity')),
      join(process.cwd(), 'src/app/(app)/cards/[id]/CardDetail.tsx'),
    ]
    expect(files.length).toBeGreaterThan(1)
    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      expect(src, file).not.toContain('ledgerMap')
      expect(src, file).not.toContain("from '@/server/")
      expect(src, file).not.toContain('type="number"')
      expect(src, file).not.toContain('parseFloat')
      expect(src, file).not.toContain('useSimulatePurchase')
      expect(src, file).not.toContain('usePanToken')
      expect(src, file).not.toContain('useExportTransactions')
      expect(src, file).not.toContain('useSyncTransactionsAdmin')
      expect(src, file).not.toMatch(/\bPAN\b/)
      expect(src.toLowerCase(), file).not.toContain('cvv')
      expect(src.toLowerCase(), file).not.toContain('card_number')
    }
  })

  it('keeps requireApp, AppShell collapse, and Activity then Transactions then Receipts then Automation', () => {
    const layout = readFileSync(join(process.cwd(), 'src/app/(app)/layout.tsx'), 'utf8')
    expect(layout).toContain('requireApp()')
    expect(layout).toContain('AppShellFrame')
    const shell = readFileSync(join(process.cwd(), 'src/client/shell/AppShell.tsx'), 'utf8')
    expect(shell).toMatch(/aside className="[^"]*\bhidden\b/)
    expect(shell).toMatch(/aside className="[^"]*\bmd:flex\b/)
    expect(
      shell.includes(
        "{ href: '/activity', label: 'Activity' },\n  { href: '/transactions', label: 'Transactions' },\n  { href: '/receipts', label: 'Receipts' },\n  { href: '/automation', label: 'Automation' }",
      ),
    ).toBe(true)
  })
})
