import { describe, expect, it } from 'vitest'
import {
  ARCHIVE_CONFIRM_PHRASE,
  CLOSE_CONFIRM_PHRASE,
  CLOSURE_STEPS,
  SETTLE_POLL_MS,
  archiveConfirm,
  auditHref,
  auditListHref,
  blockerHref,
  canClickComplete,
  canClickStart,
  closeCardsConfirm,
  closureActiveStep,
  closureHref,
  completeClosureInput,
  exportBody,
  exportCatalogueHref,
  finalReportHref,
  holdsMemberManage,
  holdsProjectClose,
  holdsReportExport,
  isProjectArchived,
  isProjectCloseable,
  isProjectClosing,
  memberDisplayName,
  organizationReportHref,
  orgTotalsExcludeSomeProjects,
  parseAuditSearchParams,
  parseExportSearchParams,
  parseOptionalIdParam,
  projectReportHref,
  reportOverCommitted,
  reportsHref,
  reportToBudgetBar,
  shouldPollSettle,
} from '@/client/lib/reports'

describe('constants and hrefs', () => {
  it('locks poll, phrases, steps, and paths', () => {
    expect(SETTLE_POLL_MS).toBe(5000)
    expect(CLOSE_CONFIRM_PHRASE).toBe('CLOSE')
    expect(ARCHIVE_CONFIRM_PHRASE).toBe('ARCHIVE')
    expect(CLOSURE_STEPS.map((step) => `${step.id}:${step.label}`)).toEqual([
      'PREFLIGHT:Pre-flight',
      'FREEZE:Freeze',
      'SETTLE:Settle',
      'REVOKE:Revoke access',
      'CLOSE_CARDS:Close cards',
      'FINAL_REPORT:Final report',
      'ARCHIVE:Archive',
    ])
    expect(reportsHref()).toBe('/reports')
    expect(organizationReportHref()).toBe('/reports/organization')
    expect(projectReportHref('p1')).toBe('/reports/project/p1')
    expect(auditHref()).toBe('/audit')
    expect(closureHref('p')).toBe('/projects/p/closure')
    expect(finalReportHref('p')).toBe('/projects/p/report/final')
    expect(auditListHref({ subjectType: 'card', subjectId: 'c1' })).toBe(
      '/audit?subjectType=card&subjectId=c1',
    )
    expect(auditListHref({ cursor: 'x' } as never)).toBe('/audit')
    expect(exportCatalogueHref({ projectId: 'p' })).toBe('/reports?projectId=p')
  })

  it('throws on empty ids', () => {
    expect(() => projectReportHref('')).toThrow('projectId is required')
    expect(() => closureHref('')).toThrow('projectId is required')
    expect(() => finalReportHref('')).toThrow('projectId is required')
    expect(() => blockerHref({ subjectType: 'card', subjectId: 'c1' }, '')).toThrow(
      'projectId is required',
    )
  })
})

describe('parseAuditSearchParams', () => {
  it('drops cursor, page, and unknown keys', () => {
    const parsed = parseAuditSearchParams({
      cursor: 'abc',
      page: '2',
      subjectType: 'card',
    } as never)
    expect(parsed).toEqual({ subjectType: 'card' })
    expect('cursor' in parsed).toBe(false)
    expect('page' in parsed).toBe(false)
  })

  it('keeps free-string filters and omits empty ids', () => {
    expect(
      parseAuditSearchParams({
        subjectType: 'card',
        subjectId: '',
        action: 'card.freeze',
        from: '2026-01-01T00:00:00.000Z',
      }),
    ).toEqual({
      subjectType: 'card',
      action: 'card.freeze',
      from: '2026-01-01T00:00:00.000Z',
    })
  })
})

describe('parse helpers', () => {
  it('parseOptionalIdParam uses first array item and drops empty', () => {
    expect(parseOptionalIdParam(['p', 'x'])).toBe('p')
    expect(parseOptionalIdParam('')).toBeUndefined()
    expect(parseOptionalIdParam(undefined)).toBeUndefined()
  })

  it('parseExportSearchParams drops unknown keys', () => {
    const parsed = parseExportSearchParams({
      projectId: 'p',
      kind: 'budget',
      page: '2',
    } as never)
    expect(parsed).toEqual({ projectId: 'p' })
    expect('kind' in parsed).toBe(false)
    expect('page' in parsed).toBe(false)
  })

  it('exportBody omits empty keys', () => {
    expect(exportBody({ projectId: '', from: '2026-01-01T00:00:00.000Z' })).toEqual({
      from: '2026-01-01T00:00:00.000Z',
    })
  })
})

describe('permissions and lifecycle', () => {
  it('holdsReportExport / member.manage / project.close', () => {
    expect(holdsReportExport('MEMBER', [{ permissions: ['report.export'] }])).toBe(true)
    expect(holdsReportExport('MEMBER', [{ permissions: ['transaction.view'] }])).toBe(false)
    expect(holdsReportExport('OWNER', [])).toBe(true)
    expect(holdsMemberManage('ADMIN', [])).toBe(true)
    expect(holdsProjectClose('MEMBER', [{ permissions: ['project.close'] }])).toBe(true)
  })

  it('status helpers', () => {
    expect(isProjectArchived('ARCHIVED')).toBe(true)
    expect(isProjectCloseable('ACTIVE')).toBe(true)
    expect(isProjectCloseable('CLOSING')).toBe(false)
    expect(isProjectClosing('CLOSING')).toBe(true)
    expect(closureActiveStep('ACTIVE', 'SETTLE')).toBe('PREFLIGHT')
    expect(closureActiveStep('CLOSING', 'SETTLE')).toBe('SETTLE')
    expect(canClickStart({ projectStatus: 'ACTIVE', canStart: true, archived: false })).toBe(true)
    expect(canClickStart({ projectStatus: 'ACTIVE', canStart: false, archived: false })).toBe(false)
    expect(
      canClickComplete({
        projectStatus: 'CLOSING',
        steps: [{ step: 'SETTLE', status: 'DONE' }],
        archived: false,
      }),
    ).toBe(true)
    expect(
      canClickComplete({
        projectStatus: 'CLOSING',
        steps: [{ step: 'SETTLE', status: 'BLOCKED' }],
        archived: false,
      }),
    ).toBe(false)
    expect(shouldPollSettle('SETTLE', [{ step: 'SETTLE', status: 'BLOCKED' }])).toBe(true)
    expect(shouldPollSettle('SETTLE', [{ step: 'SETTLE', status: 'DONE' }])).toBe(false)
  })
})

describe('blockerHref', () => {
  it('maps preflight subject types', () => {
    expect(blockerHref({ subjectType: 'transaction', subjectId: 't1' }, 'p')).toBe(
      '/transactions/t1',
    )
    expect(blockerHref({ subjectType: 'card', subjectId: 'c1' }, 'p')).toBe('/cards/c1')
    expect(blockerHref({ subjectType: 'purchaseRequest', subjectId: 'r1' }, 'p')).toBe(
      '/requests/r1',
    )
    expect(blockerHref({ subjectType: 'projectMember', subjectId: 'm1' }, 'p')).toBe(
      '/projects/p/people',
    )
    expect(blockerHref({ subjectType: 'unknown', subjectId: 'x' }, 'p')).toBe('/projects/p/people')
  })
})

describe('money helpers', () => {
  it('does not clamp remaining or utilisation', () => {
    expect(
      orgTotalsExcludeSomeProjects([{ approved: 100 }, { approved: 50 }], { approved: 100 }),
    ).toBe(true)
    expect(orgTotalsExcludeSomeProjects([{ approved: 100 }], { approved: 100 })).toBe(false)
    expect(orgTotalsExcludeSomeProjects([], { approved: 0 })).toBe(false)
    expect(reportOverCommitted(-1)).toBe(true)
    expect(reportOverCommitted(0)).toBe(false)
    const bar = reportToBudgetBar({
      approved: 10,
      committed: 4,
      actual: 7,
      remaining: -1,
      utilisationPct: 110,
      currency: 'USD',
    })
    expect(bar.remaining).toBe(-1)
    expect(bar.overCommitted).toBe(true)
    expect(bar.utilisationPct).toBe(110)
    expect(bar.currency).toBe('USD')
  })
})

describe('display and complete input', () => {
  it('memberDisplayName falls back to userId', () => {
    expect(memberDisplayName('u1', [{ userId: 'u1', user: { name: 'Ada' } }])).toBe('Ada')
    expect(memberDisplayName('u2', [])).toBe('u2')
  })

  it('completeClosureInput both literals', () => {
    expect(completeClosureInput()).toEqual({ confirmCloseCards: true, confirmArchive: true })
  })

  it('confirm copy includes post-close clearing on CLOSE', () => {
    expect(closeCardsConfirm().phrase).toBe('CLOSE')
    expect(closeCardsConfirm().description).toBe(
      'Pending transactions will still clear after cards are closed.',
    )
    expect(archiveConfirm().phrase).toBe('ARCHIVE')
  })
})
