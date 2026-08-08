import { beforeAll, describe, expect, it } from 'vitest'
import { useTestDb } from '../../../test/helpers/db'
import { OrgRole } from '@/shared/enums/orgRole'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import { ProjectModel } from '@/server/models/Project'
import type { OrgContext } from '@/server/http/types'
import * as projects from '@/server/repositories/projects'

function ctx(orgId: string, userId = 'user_1'): OrgContext {
  return { orgId, userId, orgRole: OrgRole.OWNER }
}

describe('repositories/projects', () => {
  useTestDb()

  beforeAll(async () => {
    await ProjectModel.syncIndexes()
  })

  it('creates a DRAFT and finds by id within org', async () => {
    const orgCtx = ctx('org_1')
    const created = await projects.createProject(orgCtx, {
      name: 'APAC Launch',
      code: 'APAC-01',
      description: 'Launch',
    })

    expect(created.status).toBe(ProjectStatus.DRAFT)
    expect(created.orgId).toBe('org_1')
    expect(created.ownerId).toBeNull()
    expect(created.workstreams).toEqual([])

    const found = await projects.findProjectById(orgCtx, created.id)
    expect(found).toEqual(created)

    expect(await projects.findProjectById(ctx('org_other'), created.id)).toBeNull()
    expect(await projects.findProjectById(orgCtx, 'not-an-id')).toBeNull()
  })

  it('rejects duplicate code in the same org; allows it in another', async () => {
    await projects.createProject(ctx('org_1'), { name: 'A', code: 'SHARED' })

    await expect(
      projects.createProject(ctx('org_1'), { name: 'B', code: 'SHARED' }),
    ).rejects.toMatchObject({ code: 11000 })

    const other = await projects.createProject(ctx('org_2'), { name: 'C', code: 'SHARED' })
    expect(other.orgId).toBe('org_2')
  })

  it('lists with filters, pagination, and stable sort', async () => {
    const orgCtx = ctx('org_list')
    const stamp = Date.now()

    for (let i = 0; i < 5; i += 1) {
      await projects.createProject(orgCtx, {
        name: `P${i}`,
        code: `L-${stamp}-${i}`,
        ownerId: i % 2 === 0 ? 'owner_a' : 'owner_b',
        costCentre: i < 3 ? 'MKT' : 'ENG',
      })
      // Distinct updatedAt for primary sort when needed
      await new Promise((r) => setTimeout(r, 5))
    }

    const byOwner = await projects.listProjects(orgCtx, { ownerId: 'owner_a' })
    expect(byOwner.items.every((p) => p.ownerId === 'owner_a')).toBe(true)
    expect(byOwner.total).toBe(3)

    const byCc = await projects.listProjects(orgCtx, { costCentre: 'ENG' })
    expect(byCc.total).toBe(2)

    const page1 = await projects.listProjects(orgCtx, {
      page: 1,
      pageSize: 2,
      sort: 'name',
    })
    const page2 = await projects.listProjects(orgCtx, {
      page: 2,
      pageSize: 2,
      sort: 'name',
    })
    expect(page1.items).toHaveLength(2)
    expect(page2.items).toHaveLength(2)
    expect(page1.total).toBe(5)
    const ids = [...page1.items, ...page2.items].map((p) => p.id)
    expect(new Set(ids).size).toBe(4)

    // Equal sort keys: create two with same name, ensure pages don't overlap
    const tieCtx = ctx('org_tie')
    await projects.createProject(tieCtx, { name: 'Same', code: `T1-${stamp}` })
    await projects.createProject(tieCtx, { name: 'Same', code: `T2-${stamp}` })
    await projects.createProject(tieCtx, { name: 'Same', code: `T3-${stamp}` })

    const t1 = await projects.listProjects(tieCtx, { page: 1, pageSize: 2, sort: 'name' })
    const t2 = await projects.listProjects(tieCtx, { page: 2, pageSize: 2, sort: 'name' })
    const tieIds = [...t1.items, ...t2.items].map((p) => p.id)
    expect(new Set(tieIds).size).toBe(3)
  })

  it('updates fields and changes owner', async () => {
    const orgCtx = ctx('org_upd')
    const created = await projects.createProject(orgCtx, { name: 'Old', code: 'UPD-1' })

    const updated = await projects.updateProject(orgCtx, created.id, {
      name: 'New',
      costCentre: 'FIN',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
    })
    expect(updated?.name).toBe('New')
    expect(updated?.costCentre).toBe('FIN')
    expect(updated?.startDate).toBe('2026-01-01T00:00:00.000Z')

    const owned = await projects.changeOwner(orgCtx, created.id, 'user_9')
    expect(owned?.ownerId).toBe('user_9')
  })

  it('updateStatus is conditional on current status', async () => {
    const orgCtx = ctx('org_status')
    const created = await projects.createProject(orgCtx, { name: 'S', code: 'ST-1' })

    const launched = await projects.updateStatus(
      orgCtx,
      created.id,
      ProjectStatus.DRAFT,
      ProjectStatus.PENDING_APPROVAL,
    )
    expect(launched?.status).toBe(ProjectStatus.PENDING_APPROVAL)

    // Stale fromStatus → null (concurrency)
    const stale = await projects.updateStatus(
      orgCtx,
      created.id,
      ProjectStatus.DRAFT,
      ProjectStatus.CANCELLED,
    )
    expect(stale).toBeNull()

    const still = await projects.findProjectById(orgCtx, created.id)
    expect(still?.status).toBe(ProjectStatus.PENDING_APPROVAL)

    const activated = await projects.updateStatus(
      orgCtx,
      created.id,
      ProjectStatus.PENDING_APPROVAL,
      ProjectStatus.ACTIVE,
      { launchedAt: new Date('2026-04-01T00:00:00.000Z') },
    )
    expect(activated?.status).toBe(ProjectStatus.ACTIVE)
    expect(activated?.launchedAt).toBe('2026-04-01T00:00:00.000Z')
  })

  it('supports workstream add/update/delete', async () => {
    const orgCtx = ctx('org_ws')
    const created = await projects.createProject(orgCtx, { name: 'W', code: 'WS-1' })

    const ws = await projects.addWorkstream(orgCtx, created.id, 'Retail')
    expect(ws?.name).toBe('Retail')
    expect(ws?.id).toEqual(expect.any(String))

    const renamed = await projects.updateWorkstream(orgCtx, created.id, ws!.id, 'Retail EU')
    expect(renamed?.name).toBe('Retail EU')

    const missing = await projects.updateWorkstream(orgCtx, created.id, 'nope', 'X')
    expect(missing).toBeNull()

    expect(await projects.deleteWorkstream(orgCtx, created.id, ws!.id)).toBe(true)
    expect(await projects.deleteWorkstream(orgCtx, created.id, ws!.id)).toBe(false)

    const after = await projects.findProjectById(orgCtx, created.id)
    expect(after?.workstreams).toEqual([])
  })
})
