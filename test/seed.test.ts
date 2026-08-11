import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { disconnectDb } from '@/server/db/connect'
import { runSeed, SEED } from '../scripts/seed'

describe('pnpm seed idempotency', () => {
  let memory: MongoMemoryServer
  let uri: string

  beforeAll(async () => {
    memory = await MongoMemoryServer.create()
    uri = memory.getUri()
  }, 60_000)

  afterAll(async () => {
    await disconnectDb()
    await memory.stop()
  })

  it('succeeds twice with no duplicates', async () => {
    await disconnectDb()
    await runSeed({ uri, dbName: 'allocard-seed' })
    await disconnectDb()
    await runSeed({ uri, dbName: 'allocard-seed' })

    const ownerUsers = await mongoose.connection.collection('users').countDocuments({
      email: SEED.ownerEmail,
    })
    const adminUsers = await mongoose.connection.collection('users').countDocuments({
      email: SEED.adminEmail,
    })
    const memberUsers = await mongoose.connection.collection('users').countDocuments({
      email: SEED.memberEmail,
    })
    const orgs = await mongoose.connection.collection('organizations').countDocuments({
      slug: SEED.orgSlug,
    })
    const memberships = await mongoose.connection.collection('memberships').countDocuments({})
    const pendingInvites = await mongoose.connection.collection('invites').countDocuments({
      email: SEED.pendingInviteEmail,
      status: 'PENDING',
    })
    const projects = await mongoose.connection.collection('projects').countDocuments({})
    const draft = await mongoose.connection.collection('projects').countDocuments({
      code: SEED.projectDraftCode,
      status: 'DRAFT',
    })
    const active = await mongoose.connection.collection('projects').countDocuments({
      code: SEED.projectActiveCode,
      status: 'ACTIVE',
    })
    const closing = await mongoose.connection.collection('projects').countDocuments({
      code: SEED.projectClosingCode,
      status: 'CLOSING',
    })
    const closed = await mongoose.connection.collection('projects').countDocuments({
      code: SEED.projectClosedCode,
      status: 'CLOSED',
    })
    const roles = await mongoose.connection.collection('roles').countDocuments({
      isTemplate: true,
    })
    const projectMembers = await mongoose.connection
      .collection('projectMembers')
      .countDocuments({ removedAt: null })
    const approverUsers = await mongoose.connection.collection('users').countDocuments({
      email: SEED.approverEmail,
    })
    const spenderUsers = await mongoose.connection.collection('users').countDocuments({
      email: SEED.spenderEmail,
    })
    const contractorUsers = await mongoose.connection.collection('users').countDocuments({
      email: SEED.contractorEmail,
    })
    const procurementUsers = await mongoose.connection.collection('users').countDocuments({
      email: SEED.procurementEmail,
    })

    expect(ownerUsers).toBe(1)
    expect(adminUsers).toBe(1)
    expect(memberUsers).toBe(1)
    expect(orgs).toBe(1)
    // owner + admin + member + approver + spender + contractor + procurement
    expect(memberships).toBe(7)
    expect(pendingInvites).toBe(1)
    expect(projects).toBe(4)
    expect(draft).toBe(1)
    expect(active).toBe(1)
    expect(closing).toBe(1)
    expect(closed).toBe(1)
    expect(roles).toBe(7)
    // 7 on ACTIVE (all templates) + 1 viewer on DRAFT
    expect(projectMembers).toBe(8)
    expect(approverUsers).toBe(1)
    expect(spenderUsers).toBe(1)
    expect(contractorUsers).toBe(1)
    expect(procurementUsers).toBe(1)

    const budgetDocs = await mongoose.connection.collection('budgets').find({}).toArray()
    expect(budgetDocs).toHaveLength(1)
    expect(budgetDocs[0]?.categories).toHaveLength(2)
    expect(budgetDocs[0]?.approvedAmount).toBe(
      SEED.budgetApprovedAmount + SEED.budgetAdjustmentAmount,
    )

    const entries = await mongoose.connection.collection('budgetEntries').countDocuments({})
    expect(entries).toBe(2)

    const activeProject = await mongoose.connection.collection('projects').findOne({
      code: SEED.projectActiveCode,
    })
    expect(activeProject?.budgetSnapshot).toMatchObject({
      approved: SEED.budgetApprovedAmount + SEED.budgetAdjustmentAmount,
      committed: 0,
      actual: 0,
      remaining: SEED.budgetApprovedAmount + SEED.budgetAdjustmentAmount,
      overCommitted: false,
    })

    const cardholders = await mongoose.connection.collection('cardholders').countDocuments({})
    expect(cardholders).toBeGreaterThanOrEqual(2)
    const individual = await mongoose.connection.collection('cardholders').countDocuments({
      type: 'INDIVIDUAL',
      status: 'READY',
    })
    expect(individual).toBeGreaterThanOrEqual(1)
    const cards = await mongoose.connection.collection('cards').find({}).toArray()
    expect(cards).toHaveLength(1)
    expect(cards[0]?.purpose).toBe('MEMBER')
    expect(cards[0]?.status).toBe('ACTIVE')
    expect(cards[0]?.desiredControls).toEqual(cards[0]?.appliedControls)

    const attributeDefs = await mongoose.connection
      .collection('attributeDefinitions')
      .countDocuments({ key: 'campaign.roas' })
    expect(attributeDefs).toBe(1)
    const attributeValues = await mongoose.connection
      .collection('attributeValues')
      .countDocuments({ key: 'campaign.roas' })
    expect(attributeValues).toBe(1)
    const rules = await mongoose.connection.collection('rules').countDocuments({ enabled: true })
    expect(rules).toBeGreaterThanOrEqual(2)
    const ruleRuns = await mongoose.connection.collection('ruleRuns').countDocuments({})
    expect(ruleRuns).toBeGreaterThanOrEqual(1)
  })
})
