import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { ActorType } from '@/shared/enums/audit'
import { AuditLogModel } from '@/server/models/AuditLog'
import { audit } from '@/server/services/audit/log'
import type { OrgContext } from '@/server/http/types'

const ctx: OrgContext = {
  orgId: 'org_1',
  userId: 'user_1',
  orgRole: 'OWNER',
}

describe('audit', () => {
  let memory: MongoMemoryServer

  beforeAll(async () => {
    memory = await MongoMemoryServer.create()
    await mongoose.connect(memory.getUri(), { dbName: 'allocard-audit-test' })
  }, 60_000)

  afterAll(async () => {
    await mongoose.disconnect()
    await memory.stop()
  })

  beforeEach(async () => {
    await AuditLogModel.deleteMany({}).setOptions({ allowCrossTenant: true })
  })

  it('writes an audit entry for the ctx org and user', async () => {
    const entry = await audit(ctx, {
      action: 'project.create',
      subjectType: 'project',
      subjectId: 'proj_1',
      after: { name: 'APAC Launch' },
      metadata: { source: 'api' },
    })

    expect(entry.id).toEqual(expect.any(String))
    expect(entry.orgId).toBe('org_1')
    expect(entry.actorType).toBe(ActorType.USER)
    expect(entry.actorId).toBe('user_1')
    expect(entry.action).toBe('project.create')
    expect(entry.subjectType).toBe('project')
    expect(entry.subjectId).toBe('proj_1')
    expect(entry.after).toEqual({ name: 'APAC Launch' })
    expect(entry.metadata).toEqual({ source: 'api' })
    expect(typeof entry.at).toBe('string')

    const stored = await AuditLogModel.find({ orgId: 'org_1' }).exec()
    expect(stored).toHaveLength(1)
  })

  it('defaults metadata to {} and supports non-user actors', async () => {
    const entry = await audit(ctx, {
      action: 'card.freeze',
      subjectType: 'card',
      subjectId: 'card_1',
      actorType: ActorType.RULE,
      actorId: 'rule_budget_cap',
      before: { status: 'ACTIVE' },
      after: { status: 'FROZEN' },
    })

    expect(entry.actorType).toBe(ActorType.RULE)
    expect(entry.actorId).toBe('rule_budget_cap')
    expect(entry.metadata).toEqual({})
    expect(entry.before).toEqual({ status: 'ACTIVE' })
  })

  it('is tenant-scoped — queries without orgId throw', async () => {
    await expect(AuditLogModel.find({}).exec()).rejects.toThrow(/Tenant scope missing/)
  })

  it('declares the required indexes', () => {
    const indexes = AuditLogModel.schema.indexes()
    expect(indexes).toEqual(
      expect.arrayContaining([
        [{ orgId: 1, at: -1 }, expect.any(Object)],
        [{ orgId: 1, subjectType: 1, subjectId: 1 }, expect.any(Object)],
      ]),
    )
  })
})
