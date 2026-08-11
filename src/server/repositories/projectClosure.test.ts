import { beforeAll, describe, expect, it } from 'vitest'
import { useTestDb } from '../../../test/helpers/db'
import { ClosureStep } from '@/shared/enums/closureStep'
import { ClosureStepStatus } from '@/shared/enums/closureStepStatus'
import { OrgRole } from '@/shared/enums/orgRole'
import type { OrgContext } from '@/server/http/types'
import { ProjectClosureModel } from '@/server/models/ProjectClosure'
import * as projectClosures from '@/server/repositories/projectClosures'
import type { FinalReport } from '@/shared/types/report'

function ctx(orgId: string, userId = 'user_1'): OrgContext {
  return { orgId, userId, orgRole: OrgRole.OWNER }
}

function sampleFinalReport(overrides: Partial<FinalReport> = {}): FinalReport {
  return {
    projectId: 'proj_1',
    currency: 'USD',
    approved: 100_000,
    committed: 0,
    actual: 40_000,
    remaining: 60_000,
    utilisationPct: 40,
    byCategory: [],
    byMember: [],
    generatedAt: '2026-08-12T12:00:00.000Z',
    closedAt: '2026-08-12T12:00:00.000Z',
    archivedAt: '2026-08-12T12:00:00.000Z',
    transactionCount: 3,
    accessHistoryCount: 2,
    ...overrides,
  }
}

describe('repositories/projectClosure', () => {
  useTestDb()

  beforeAll(async () => {
    await ProjectClosureModel.syncIndexes()
  })

  it('upsertStart creates then resumes without resetting', async () => {
    const org = ctx('org_1')
    const created = await projectClosures.upsertStart(org, {
      projectId: 'proj_1',
      startedBy: 'user_1',
      startedAt: new Date('2026-08-12T10:00:00.000Z'),
    })

    expect(created.projectId).toBe('proj_1')
    expect(created.startedBy).toBe('user_1')
    expect(created.startedAt).toBe('2026-08-12T10:00:00.000Z')
    expect(created.currentStep).toBe(ClosureStep.PREFLIGHT)
    expect(created.steps).toHaveLength(7)
    expect(created.completedAt).toBeNull()
    expect(created.finalReportSnapshot).toBeNull()

    const resumed = await projectClosures.upsertStart(org, {
      projectId: 'proj_1',
      startedBy: 'user_other',
      currentStep: ClosureStep.SETTLE,
      startedAt: new Date('2026-08-12T11:00:00.000Z'),
    })
    expect(resumed.id).toBe(created.id)
    expect(resumed.startedBy).toBe('user_1')
    expect(resumed.startedAt).toBe('2026-08-12T10:00:00.000Z')
    expect(resumed.currentStep).toBe(ClosureStep.PREFLIGHT)
  })

  it('findByProject returns within org only', async () => {
    const org = ctx('org_find')
    const created = await projectClosures.upsertStart(org, {
      projectId: 'proj_find',
      startedBy: 'user_1',
    })

    expect(await projectClosures.findByProject(org, 'proj_find')).toMatchObject({
      id: created.id,
      projectId: 'proj_find',
    })
    expect(await projectClosures.findByProject(ctx('org_other'), 'proj_find')).toBeNull()
    expect(await projectClosures.findByProject(org, 'proj_missing')).toBeNull()
  })

  it('updateStep patches one step and can advance currentStep', async () => {
    const org = ctx('org_step')
    await projectClosures.upsertStart(org, {
      projectId: 'proj_step',
      startedBy: 'user_1',
    })

    const updated = await projectClosures.updateStep(
      org,
      'proj_step',
      ClosureStep.FREEZE,
      {
        status: ClosureStepStatus.DONE,
        startedAt: new Date('2026-08-12T10:05:00.000Z'),
        completedAt: new Date('2026-08-12T10:06:00.000Z'),
        detail: 'cards frozen',
      },
      ClosureStep.SETTLE,
    )

    expect(updated?.currentStep).toBe(ClosureStep.SETTLE)
    const freeze = updated?.steps.find((s) => s.step === ClosureStep.FREEZE)
    expect(freeze).toMatchObject({
      status: ClosureStepStatus.DONE,
      startedAt: '2026-08-12T10:05:00.000Z',
      completedAt: '2026-08-12T10:06:00.000Z',
      detail: 'cards frozen',
    })
    expect(updated?.steps.find((s) => s.step === ClosureStep.PREFLIGHT)?.status).toBe(
      ClosureStepStatus.PENDING,
    )

    expect(
      await projectClosures.updateStep(ctx('org_other'), 'proj_step', ClosureStep.SETTLE, {
        status: ClosureStepStatus.DONE,
      }),
    ).toBeNull()
  })

  it('markComplete stores snapshot; cross-org returns null', async () => {
    const org = ctx('org_done')
    await projectClosures.upsertStart(org, {
      projectId: 'proj_done',
      startedBy: 'user_1',
    })

    const report = sampleFinalReport({ projectId: 'proj_done' })
    const done = await projectClosures.markComplete(org, 'proj_done', {
      completedAt: new Date('2026-08-12T12:00:00.000Z'),
      finalReportSnapshot: report,
    })

    expect(done?.completedAt).toBe('2026-08-12T12:00:00.000Z')
    expect(done?.finalReportSnapshot).toMatchObject({
      projectId: 'proj_done',
      actual: 40_000,
      transactionCount: 3,
    })

    expect(
      await projectClosures.markComplete(ctx('org_other'), 'proj_done', {
        finalReportSnapshot: report,
      }),
    ).toBeNull()
  })
})
