import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose, { Schema, type Model } from 'mongoose'
import { baseOptions, tenantScoped, toDomain } from '@/server/models/base'

type Probe = {
  orgId: string
  name: string
  createdAt?: Date
  updatedAt?: Date
}

describe('models/base', () => {
  let memory: MongoMemoryServer
  let ProbeModel: Model<Probe>

  beforeAll(async () => {
    memory = await MongoMemoryServer.create()
    await mongoose.connect(memory.getUri(), { dbName: 'allocard-base-test' })

    const schema = new Schema<Probe>(
      {
        orgId: { type: String, required: true },
        name: { type: String, required: true },
      },
      baseOptions,
    )
    schema.plugin(tenantScoped)

    ProbeModel = mongoose.model<Probe>('TenantProbe', schema)
  }, 60_000)

  afterAll(async () => {
    await mongoose.disconnect()
    await memory.stop()
    mongoose.deleteModel('TenantProbe')
  })

  beforeEach(async () => {
    await ProbeModel.deleteMany({}).setOptions({ allowCrossTenant: true })
  })

  describe('tenantScoped', () => {
    it('throws when a guarded query lacks orgId', async () => {
      await expect(ProbeModel.find({}).exec()).rejects.toThrow(
        /Tenant scope missing on TenantProbe\.find/,
      )
      await expect(ProbeModel.findOne({ name: 'x' }).exec()).rejects.toThrow(/Tenant scope missing/)
      await expect(ProbeModel.countDocuments({}).exec()).rejects.toThrow(/Tenant scope missing/)
    })

    it('permits queries that include orgId', async () => {
      await ProbeModel.create({ orgId: 'org_1', name: 'alpha' })

      const docs = await ProbeModel.find({ orgId: 'org_1' }).exec()
      expect(docs).toHaveLength(1)
      expect(docs[0]?.name).toBe('alpha')
    })

    it('permits queries with allowCrossTenant', async () => {
      await ProbeModel.create({ orgId: 'org_1', name: 'alpha' })
      await ProbeModel.create({ orgId: 'org_2', name: 'beta' })

      const docs = await ProbeModel.find({}).setOptions({ allowCrossTenant: true }).exec()
      expect(docs).toHaveLength(2)
    })
  })

  describe('toJSON transform', () => {
    it('emits id and drops _id and __v', async () => {
      const doc = await ProbeModel.create({ orgId: 'org_1', name: 'alpha' })
      const json = doc.toJSON() as Record<string, unknown>

      expect(json.id).toEqual(expect.any(String))
      expect(json).not.toHaveProperty('_id')
      expect(json).not.toHaveProperty('__v')
      expect(json.orgId).toBe('org_1')
      expect(json.name).toBe('alpha')
      expect(typeof json.createdAt).toBe('string')
    })
  })

  describe('toDomain', () => {
    it('maps a hydrated document', async () => {
      const doc = await ProbeModel.create({ orgId: 'org_1', name: 'alpha' })
      const domain = toDomain<{ id: string; orgId: string; name: string; createdAt: string }>(doc)

      expect(domain.id).toEqual(expect.any(String))
      expect(domain).not.toHaveProperty('_id')
      expect(domain.orgId).toBe('org_1')
      expect(typeof domain.createdAt).toBe('string')
    })

    it('maps a lean document', async () => {
      await ProbeModel.create({ orgId: 'org_1', name: 'alpha' })
      const lean = await ProbeModel.findOne({ orgId: 'org_1' }).lean().exec()
      expect(lean).not.toBeNull()

      const domain = toDomain<{ id: string; name: string }>(lean!)
      expect(domain.id).toEqual(expect.any(String))
      expect(domain).not.toHaveProperty('_id')
      expect(domain.name).toBe('alpha')
    })
  })
})
