import { type HydratedDocument, type Query, type Schema, type SchemaOptions } from 'mongoose'

declare module 'mongoose' {
  interface QueryOptions {
    /** Escape hatch for worker sweeps that iterate all orgs. Keep rare and greppable. */
    allowCrossTenant?: boolean
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && value.constructor === Object
}

/** Convert Date values (recursively) to ISO 8601 strings for the wire/domain. */
export function datesToIso(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (Array.isArray(value)) {
    return value.map(datesToIso)
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(value)) {
      out[key] = datesToIso(nested)
    }
    return out
  }
  return value
}

function applyIdTransform(ret: Record<string, unknown>): Record<string, unknown> {
  if (ret._id != null) {
    ret.id = String(ret._id)
    delete ret._id
  }
  delete ret.__v
  return datesToIso(ret) as Record<string, unknown>
}

/**
 * Shared schema options: timestamps, fail on unknown fields, and `_id` → `id`.
 * Applied to every model via the second argument to `new Schema(...)`.
 */
export const baseOptions: SchemaOptions = {
  timestamps: true,
  strict: 'throw',
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform(_doc, ret) {
      return applyIdTransform(ret as Record<string, unknown>)
    },
  },
  toObject: {
    virtuals: true,
    versionKey: false,
    transform(_doc, ret) {
      return applyIdTransform(ret as Record<string, unknown>)
    },
  },
}

const GUARDED_OPS = [
  'find',
  'findOne',
  'findOneAndUpdate',
  'updateOne',
  'updateMany',
  'deleteOne',
  'deleteMany',
  'countDocuments',
] as const

/**
 * Throws when a tenant-owned query reaches the driver without `orgId` in its
 * filter. Pass `{ allowCrossTenant: true }` for legitimate cross-org sweeps.
 */
export function tenantScoped(schema: Schema): void {
  for (const op of GUARDED_OPS) {
    schema.pre(op, function tenantScopeGuard(this: Query<unknown, unknown>) {
      const filter = this.getFilter() as { orgId?: unknown }
      const allowCrossTenant = Boolean(this.getOptions().allowCrossTenant)
      if (!filter.orgId && !allowCrossTenant) {
        throw new Error(`Tenant scope missing on ${this.model.modelName}.${op}`)
      }
    })
  }
}

type WithToJSON = { toJSON: (options?: object) => unknown }

function hasToJSON(doc: unknown): doc is WithToJSON {
  return (
    typeof doc === 'object' &&
    doc !== null &&
    'toJSON' in doc &&
    typeof (doc as WithToJSON).toJSON === 'function'
  )
}

/**
 * Map a Mongoose document or lean object to a plain domain object.
 * Domain ids are always `string`; dates are ISO strings.
 */
export function toDomain<T>(
  doc: HydratedDocument<unknown> | Record<string, unknown> | null | undefined,
): T {
  if (doc == null) {
    throw new Error('toDomain received null or undefined')
  }

  if (hasToJSON(doc)) {
    return doc.toJSON() as T
  }

  return applyIdTransform({ ...doc }) as T
}
