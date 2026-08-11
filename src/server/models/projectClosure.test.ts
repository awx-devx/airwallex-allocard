import { beforeAll, describe, expect, it } from 'vitest'
import { useTestDb } from '../../../test/helpers/db'
import { ClosureStep } from '@/shared/enums/closureStep'
import { ClosureStepStatus } from '@/shared/enums/closureStepStatus'
import { ProjectClosureModel, defaultClosureSteps } from '@/server/models/ProjectClosure'
import { toDomain } from '@/server/models/base'
import type { ProjectClosure } from '@/shared/types/closure'

async function syncIndexes(): Promise<void> {
  await ProjectClosureModel.syncIndexes()
}

function minimalClosure(overrides: Record<string, unknown> = {}) {
  return {
    orgId: 'org_1',
    projectId: 'proj_1',
    currentStep: ClosureStep.PREFLIGHT,
    steps: defaultClosureSteps(),
    startedBy: 'user_1',
    startedAt: new Date('2026-08-12T10:00:00.000Z'),
    ...overrides,
  }
}

describe('models/projectClosure', () => {
  useTestDb()

  beforeAll(async () => {
    await syncIndexes()
  })

  it('defaults null completedAt and finalReportSnapshot; stores all seven steps', async () => {
    const doc = await ProjectClosureModel.create(minimalClosure())

    expect(doc.completedAt).toBeNull()
    expect(doc.finalReportSnapshot).toBeNull()
    expect(doc.steps).toHaveLength(7)
    expect(doc.steps.map((s) => s.step)).toEqual(Object.values(ClosureStep))
    expect(doc.steps.every((s) => s.status === ClosureStepStatus.PENDING)).toBe(true)
    expect(doc.currentStep).toBe(ClosureStep.PREFLIGHT)
  })

  it('embeds steps without subdocument _id; dates become ISO via toDomain', async () => {
    const startedAt = new Date('2026-08-12T10:00:00.000Z')
    const steps = defaultClosureSteps()
    steps[0] = {
      step: ClosureStep.PREFLIGHT,
      status: ClosureStepStatus.DONE,
      startedAt,
      completedAt: startedAt,
      detail: 'ok',
    }

    const doc = await ProjectClosureModel.create(
      minimalClosure({
        currentStep: ClosureStep.FREEZE,
        steps,
      }),
    )

    const domain = toDomain<ProjectClosure>(doc)
    expect(domain.steps[0]).toMatchObject({
      step: ClosureStep.PREFLIGHT,
      status: ClosureStepStatus.DONE,
      startedAt: startedAt.toISOString(),
      completedAt: startedAt.toISOString(),
      detail: 'ok',
    })
    expect(domain.steps[0]).not.toHaveProperty('_id')
    expect(domain).toMatchObject({
      id: expect.any(String),
      projectId: 'proj_1',
      currentStep: ClosureStep.FREEZE,
      startedAt: startedAt.toISOString(),
      completedAt: null,
      finalReportSnapshot: null,
    })
  })

  it('throws without orgId (tenantScoped)', async () => {
    await expect(ProjectClosureModel.find({ projectId: 'proj_1' }).exec()).rejects.toThrow(
      /Tenant scope missing/,
    )
  })

  it('enforces unique projectId', async () => {
    await ProjectClosureModel.create(minimalClosure({ orgId: 'org_1', projectId: 'proj_uniq' }))
    await expect(
      ProjectClosureModel.create(minimalClosure({ orgId: 'org_2', projectId: 'proj_uniq' })),
    ).rejects.toMatchObject({ code: 11000 })
  })
})
