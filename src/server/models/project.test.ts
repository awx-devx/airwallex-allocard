import { beforeAll, describe, expect, it } from 'vitest'
import { useTestDb } from '../../../test/helpers/db'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import { ProjectModel } from '@/server/models/Project'
import { toDomain } from '@/server/models/base'
import type { Project } from '@/shared/types/project'

async function syncIndexes(): Promise<void> {
  await ProjectModel.syncIndexes()
}

function minimalProject(overrides: Record<string, unknown> = {}) {
  return {
    orgId: 'org_1',
    name: 'APAC Launch',
    code: 'APAC-01',
    ...overrides,
  }
}

describe('models/project', () => {
  useTestDb()

  beforeAll(async () => {
    await syncIndexes()
  })

  it('defaults to DRAFT with empty workstreams and false cardStructure', async () => {
    const doc = await ProjectModel.create(minimalProject())

    expect(doc.status).toBe(ProjectStatus.DRAFT)
    expect(doc.description).toBe('')
    expect(doc.ownerId).toBeNull()
    expect(doc.costCentre).toBeNull()
    expect(doc.startDate).toBeNull()
    expect(doc.endDate).toBeNull()
    expect(doc.workstreams).toEqual([])
    expect(doc.cardStructure).toMatchObject({
      shared: false,
      perMember: false,
      vendor: false,
      oneTime: false,
    })
    expect(doc.approvedAt).toBeNull()
    expect(doc.launchedAt).toBeNull()
    expect(doc.closedAt).toBeNull()
    expect(doc.budgetSnapshot).toBeNull()
  })

  it('enforces unique (orgId, code)', async () => {
    await ProjectModel.create(minimalProject({ code: 'DUP' }))

    await expect(
      ProjectModel.create(minimalProject({ code: 'DUP', name: 'Other' })),
    ).rejects.toMatchObject({
      code: 11000,
    })
  })

  it('allows the same code in a different org', async () => {
    await ProjectModel.create(minimalProject({ orgId: 'org_1', code: 'SHARED' }))
    const other = await ProjectModel.create(minimalProject({ orgId: 'org_2', code: 'SHARED' }))

    expect(other.orgId).toBe('org_2')
    expect(other.code).toBe('SHARED')
  })

  it('requires orgId on queries (tenantScoped)', async () => {
    await expect(ProjectModel.find({}).exec()).rejects.toThrow(
      /Tenant scope missing on Project\.find/,
    )

    await ProjectModel.create(minimalProject())
    const docs = await ProjectModel.find({ orgId: 'org_1' }).exec()
    expect(docs).toHaveLength(1)
  })

  it('embeds workstreams with explicit id (no subdocument _id)', async () => {
    const doc = await ProjectModel.create(
      minimalProject({
        workstreams: [{ id: 'ws_1', name: 'Retail' }],
      }),
    )

    expect(doc.workstreams).toHaveLength(1)
    expect(doc.workstreams[0]).toMatchObject({ id: 'ws_1', name: 'Retail' })

    const json = doc.toJSON() as Record<string, unknown>
    const workstreams = json.workstreams as Record<string, unknown>[]
    expect(workstreams[0]).not.toHaveProperty('_id')
    expect(workstreams[0]?.id).toBe('ws_1')
  })

  it('emits id and ISO dates via toJSON / toDomain', async () => {
    const start = new Date('2026-03-01T00:00:00.000Z')
    const end = new Date('2026-06-30T00:00:00.000Z')
    const doc = await ProjectModel.create(
      minimalProject({
        ownerId: 'user_1',
        costCentre: 'MKT',
        startDate: start,
        endDate: end,
        cardStructure: { shared: true, perMember: false, vendor: true, oneTime: false },
      }),
    )

    const json = doc.toJSON() as Record<string, unknown>
    expect(json.id).toEqual(expect.any(String))
    expect(json).not.toHaveProperty('_id')
    expect(json.startDate).toBe('2026-03-01T00:00:00.000Z')
    expect(json.endDate).toBe('2026-06-30T00:00:00.000Z')
    expect(typeof json.createdAt).toBe('string')
    expect(typeof json.updatedAt).toBe('string')

    const domain = toDomain<Project>(doc)
    expect(domain.id).toEqual(expect.any(String))
    expect(domain.startDate).toBe('2026-03-01T00:00:00.000Z')
    expect(domain.cardStructure.shared).toBe(true)
    expect(domain.cardStructure.vendor).toBe(true)
  })
})
