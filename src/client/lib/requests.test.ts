import { describe, expect, it } from 'vitest'
import { cardHref, controlsHref, projectCardsHref } from '@/client/lib/cards'
import {
  POLICY_PREVIEW_DEBOUNCE_MS,
  approvalHref,
  approvalProgress,
  approvalsHref,
  approvalsListHref,
  approvedCount,
  canCancelRequest,
  canDecideRequest,
  canEditDraft,
  canSubmitDraft,
  checkingPolicyMessage,
  createRequestDenialMessage,
  emptyApprovalRuleBody,
  formatApprovalProgress,
  formatApprovalRequired,
  formatApproverSelector,
  formatEscalatedAt,
  holdsPaymentMake,
  holdsRequestApprove,
  isSelfApproval,
  isTerminalRequestStatus,
  newRequestHref,
  noApprovalsEmpty,
  noProjectRulesMessage,
  noRequestsEmpty,
  parseApprovalsSearchParams,
  parseOptionalIdParam,
  parseRequestListSearchParams,
  policyPreviewHeading,
  recentApprovedSpend,
  rejectionReason,
  remainingShortfall,
  requestHref,
  requestListHref,
  requestsHref,
  selectProjectEmpty,
  selfApprovalMessage,
  toApprovalRuleBody,
  unlockedCardIds,
  viewerHasDecided,
  wizardApprovalRulesLinkMessage,
} from '@/client/lib/requests'

describe('constants and hrefs', () => {
  it('locks debounce and paths', () => {
    expect(POLICY_PREVIEW_DEBOUNCE_MS).toBe(300)
    expect(requestsHref()).toBe('/requests')
    expect(approvalsHref()).toBe('/approvals')
    expect(requestHref('r1')).toBe('/requests/r1')
    expect(approvalHref('r1')).toBe('/approvals/r1')
    expect(newRequestHref()).toBe('/requests/new')
    expect(newRequestHref('p')).toBe('/requests/new?projectId=p')
    expect(cardHref('c1')).toBe('/cards/c1')
    expect(projectCardsHref('p')).toBe('/projects/p/cards')
    expect(controlsHref('p')).toBe('/projects/p/controls')
  })

  it('throws on empty request ids', () => {
    expect(() => requestHref('')).toThrow('requestId is required')
    expect(() => approvalHref('')).toThrow('requestId is required')
  })
})

describe('parseRequestListSearchParams', () => {
  it('drops status and unknown keys', () => {
    const parsed = parseRequestListSearchParams({
      status: 'PENDING',
      page: '1',
    })
    expect(parsed).toEqual({ page: 1, pageSize: 20 })
    expect(parsed).not.toHaveProperty('status')
  })

  it('returns defaults without projectId when page is invalid', () => {
    expect(parseRequestListSearchParams({ page: 'abc' })).toEqual({ page: 1, pageSize: 20 })
  })

  it('keeps projectId when page is valid or invalid', () => {
    expect(parseRequestListSearchParams({ projectId: 'p', page: '2' })).toEqual({
      projectId: 'p',
      page: 2,
      pageSize: 20,
    })
    expect(parseRequestListSearchParams({ projectId: 'p', page: '0' })).toEqual({
      projectId: 'p',
      page: 1,
      pageSize: 20,
    })
  })
})

describe('requestListHref / approvalsListHref', () => {
  it('omits default page and pageSize', () => {
    expect(requestListHref({ page: 1 })).toBe('/requests')
    expect(requestListHref({ projectId: 'p', page: 2 })).toBe('/requests?projectId=p&page=2')
    expect(approvalsListHref({ page: 1 })).toBe('/approvals')
    expect(approvalsListHref({ page: 3, pageSize: 50 })).toBe('/approvals?page=3&pageSize=50')
  })
})

describe('parseApprovalsSearchParams / parseOptionalIdParam', () => {
  it('parses page query and optional ids', () => {
    expect(parseApprovalsSearchParams({ page: '2' })).toEqual({ page: 2, pageSize: 20 })
    expect(parseApprovalsSearchParams({ page: 'nope' })).toEqual({ page: 1, pageSize: 20 })
    expect(parseOptionalIdParam('abc')).toBe('abc')
    expect(parseOptionalIdParam(['x'])).toBe('x')
    expect(parseOptionalIdParam('')).toBeUndefined()
    expect(parseOptionalIdParam(undefined)).toBeUndefined()
  })
})

describe('permission and decision helpers', () => {
  it('holdsRequestApprove OWNER vs MEMBER', () => {
    expect(holdsRequestApprove('MEMBER', [{ permissions: ['request.approve'] }])).toBe(true)
    expect(holdsRequestApprove('MEMBER', [{ permissions: ['payment.make'] }])).toBe(false)
    expect(holdsRequestApprove('OWNER', [])).toBe(true)
    expect(holdsPaymentMake('ADMIN', [])).toBe(true)
    expect(holdsPaymentMake('MEMBER', [{ permissions: ['payment.make'] }])).toBe(true)
    expect(holdsPaymentMake('MEMBER', [{ permissions: ['request.approve'] }])).toBe(false)
  })

  it('self-approval and decide gates', () => {
    expect(isSelfApproval('u1', 'u1')).toBe(true)
    expect(isSelfApproval('u1', 'u2')).toBe(false)
    expect(isSelfApproval('u1', undefined)).toBe(false)
    expect(canDecideRequest('PENDING', 'u1', 'u2')).toBe(true)
    expect(canDecideRequest('PENDING', 'u1', 'u1')).toBe(false)
    expect(canDecideRequest('APPROVED', 'u1', 'u2')).toBe(false)
    expect(canDecideRequest('PENDING', 'u1', 'u2', [{ approverId: 'u2' }])).toBe(false)
    expect(viewerHasDecided([{ approverId: 'u2' }], 'u2')).toBe(true)
    expect(canEditDraft('DRAFT', 'u1', 'u1')).toBe(true)
    expect(canSubmitDraft('DRAFT', 'u1', 'u1')).toBe(true)
    expect(canCancelRequest('PENDING', 'u1', 'u1')).toBe(true)
    expect(canCancelRequest('APPROVED', 'u1', 'u1')).toBe(false)
    expect(isTerminalRequestStatus('EXPIRED')).toBe(true)
    expect(isTerminalRequestStatus('PENDING')).toBe(false)
  })
})

describe('policy copy and trail', () => {
  it('locks preview sentences', () => {
    expect(formatApprovalRequired(2)).toBe('Approval needed from 2 approver(s).')
    expect(policyPreviewHeading('NOT_PERMITTED')).toBe('Not permitted.')
    expect(policyPreviewHeading('NO_APPROVAL_REQUIRED')).toBe('No approval needed.')
    expect(policyPreviewHeading('APPROVAL_REQUIRED')).toBe('')
    expect(checkingPolicyMessage()).toBe('Checking policy…')
    expect(selfApprovalMessage()).toBe('You cannot approve your own request.')
    expect(createRequestDenialMessage()).toBe(
      "You don't have permission to create a purchase request.",
    )
  })

  it('uses last REJECT reason', () => {
    expect(
      rejectionReason([
        { decision: 'APPROVE', reason: null },
        { decision: 'REJECT', reason: 'too much' },
        { decision: 'REJECT', reason: 'final no' },
      ]),
    ).toBe('final no')
    expect(rejectionReason([{ decision: 'REJECT', reason: null }])).toBeNull()
  })

  it('formats progress and escalation', () => {
    expect(approvedCount([{ decision: 'APPROVE' }, { decision: 'REJECT' }])).toBe(1)
    expect(
      formatApprovalProgress(
        approvalProgress({
          approvals: [{ decision: 'APPROVE' }],
          policyDecision: { requiredApprovals: 2 },
        }),
      ),
    ).toBe('1 of 2 approved.')
    expect(formatEscalatedAt('2026-01-01T00:00:00.000Z', () => '1 Jan')).toBe('Escalated 1 Jan.')
  })
})

describe('recent spend, remaining, unlocked cards', () => {
  it('excludes excludeId and non-APPROVED and caps at 3', () => {
    const items = [
      {
        id: 'keep-out',
        requestedBy: 'u1',
        status: 'APPROVED',
        vendor: 'Skip',
        amount: 1,
        currency: 'USD',
      },
      { id: 'a', requestedBy: 'u1', status: 'PENDING', vendor: 'No', amount: 2, currency: 'USD' },
      {
        id: 'b',
        requestedBy: 'u2',
        status: 'APPROVED',
        vendor: 'Other',
        amount: 3,
        currency: 'USD',
      },
      { id: 'c', requestedBy: 'u1', status: 'APPROVED', vendor: 'One', amount: 4, currency: 'USD' },
      { id: 'd', requestedBy: 'u1', status: 'APPROVED', vendor: 'Two', amount: 5, currency: 'USD' },
      {
        id: 'e',
        requestedBy: 'u1',
        status: 'APPROVED',
        vendor: 'Three',
        amount: 6,
        currency: 'USD',
      },
      {
        id: 'f',
        requestedBy: 'u1',
        status: 'APPROVED',
        vendor: 'Four',
        amount: 7,
        currency: 'USD',
      },
    ]
    expect(recentApprovedSpend(items, 'u1', 'keep-out')).toEqual([
      { vendor: 'One', amount: 4, currency: 'USD' },
      { vendor: 'Two', amount: 5, currency: 'USD' },
      { vendor: 'Three', amount: 6, currency: 'USD' },
    ])
  })

  it('does not clamp remaining and does not mutate unlocked inputs', () => {
    expect(remainingShortfall(-1, 1)).toBe(true)
    expect(remainingShortfall(500, 500)).toBe(false)
    const before = ['a']
    const after = ['a', 'b']
    expect(unlockedCardIds(before, after)).toEqual(['b'])
    expect(before).toEqual(['a'])
    expect(after).toEqual(['a', 'b'])
  })
})

describe('approval rule bodies', () => {
  it('strips identity fields and locks empty body', () => {
    const body = toApprovalRuleBody({
      id: 'rule_1',
      orgId: 'org',
      projectId: 'p',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      threshold: 1000,
      approverSelection: { type: 'ROLE', roleKey: 'approver' },
      requiredCount: 2,
      escalationAfterMins: 30,
      escalateTo: { type: 'PROJECT_OWNER' },
    })
    expect(body).not.toHaveProperty('id')
    expect(body).not.toHaveProperty('orgId')
    expect(body).not.toHaveProperty('projectId')
    expect(body.threshold).toBe(1000)
    expect(emptyApprovalRuleBody().approverSelection.type).toBe('PROJECT_OWNER')
    expect(formatApproverSelector({ type: 'ROLE', roleKey: 'approver' })).toBe('Role approver')
    expect(formatApproverSelector({ type: 'PROJECT_OWNER' })).toBe('Project owner')
    expect(formatApproverSelector({ type: 'NAMED_USERS', userIds: ['a'] }, (id) => `n:${id}`)).toBe(
      'n:a',
    )
  })
})

describe('empty copy', () => {
  it('locks empty states and wizard link', () => {
    expect(selectProjectEmpty()).toEqual({
      title: 'Select a project',
      description: 'Purchase requests are listed per project.',
    })
    expect(noRequestsEmpty().title).toBe('No requests yet')
    expect(noApprovalsEmpty().title).toBe('No pending approvals')
    expect(noProjectRulesMessage()).toBe(
      'No project approval rules. Org defaults still apply on submit.',
    )
    expect(wizardApprovalRulesLinkMessage()).toBe('Set approval rules on the controls tab.')
  })
})
