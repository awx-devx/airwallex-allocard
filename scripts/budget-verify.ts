/**
 * Recompute every project's budget projection from ledger entries and compare
 * to Project.budgetSnapshot + Redis `budget:project:{id}`.
 *
 * Usage: `pnpm budget:verify` (requires `MONGODB_URI`; Redis optional — memory
 * fallback when unset, same as the app).
 *
 * Exit non-zero on any drift.
 */
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { connectDb, disconnectDb, type ConnectDbOptions } from '../src/server/db/connect'
import { BudgetEntryModel } from '../src/server/models/BudgetEntry'
import { ProjectModel } from '../src/server/models/Project'
import { getRedis, redisKeys } from '../src/server/redis'
import {
  projectBudget,
  type BudgetProjectionValues,
} from '../src/server/services/budget/projectProjection'
import type { BudgetEntryType } from '../src/shared/enums/budgetEntryType'

export type BudgetVerifyDrift = {
  projectId: string
  orgId: string
  reason: string
}

export type BudgetVerifyResult = {
  ok: boolean
  checked: number
  drifts: BudgetVerifyDrift[]
}

function valuesMatch(expected: BudgetProjectionValues, actual: BudgetProjectionValues): boolean {
  return (
    expected.approved === actual.approved &&
    expected.committed === actual.committed &&
    expected.actual === actual.actual &&
    expected.remaining === actual.remaining &&
    expected.utilisationPct === actual.utilisationPct &&
    expected.overCommitted === actual.overCommitted
  )
}

function formatValues(values: BudgetProjectionValues): string {
  return JSON.stringify({
    approved: values.approved,
    committed: values.committed,
    actual: values.actual,
    remaining: values.remaining,
    utilisationPct: values.utilisationPct,
    overCommitted: values.overCommitted,
  })
}

function parseRedisSnapshot(raw: string): BudgetProjectionValues | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (
      typeof parsed.approved !== 'number' ||
      typeof parsed.committed !== 'number' ||
      typeof parsed.actual !== 'number' ||
      typeof parsed.remaining !== 'number' ||
      typeof parsed.utilisationPct !== 'number' ||
      typeof parsed.overCommitted !== 'boolean'
    ) {
      return null
    }
    return {
      approved: parsed.approved,
      committed: parsed.committed,
      actual: parsed.actual,
      remaining: parsed.remaining,
      utilisationPct: parsed.utilisationPct,
      overCommitted: parsed.overCommitted,
    }
  } catch {
    return null
  }
}

/**
 * Verify every project that has at least one budget entry.
 * Safe to call from tests after `connectDb` / Redis are ready.
 */
export async function verifyBudgets(): Promise<BudgetVerifyResult> {
  const projectIds = await BudgetEntryModel.distinct('projectId')
    .setOptions({ allowCrossTenant: true })
    .exec()
  const drifts: BudgetVerifyDrift[] = []
  const redis = getRedis()

  for (const projectId of projectIds.map(String)) {
    const project = await ProjectModel.findById(projectId)
      .setOptions({ allowCrossTenant: true })
      .lean()
      .exec()
    if (!project) {
      drifts.push({
        projectId,
        orgId: 'unknown',
        reason: 'Project missing for ledger entries',
      })
      continue
    }

    const orgId = String(project.orgId)
    const entries = await BudgetEntryModel.find({ orgId, projectId })
      .sort({ createdAt: 1, _id: 1 })
      .lean()
      .exec()

    const expected = projectBudget(
      entries.map((entry) => ({
        type: entry.type as BudgetEntryType,
        amount: Number(entry.amount),
      })),
    )

    const snap = project.budgetSnapshot as BudgetProjectionValues | null | undefined
    if (!snap) {
      drifts.push({
        projectId,
        orgId,
        reason: `Missing Project.budgetSnapshot; expected ${formatValues(expected)}`,
      })
    } else {
      const mongoValues: BudgetProjectionValues = {
        approved: Number(snap.approved),
        committed: Number(snap.committed),
        actual: Number(snap.actual),
        remaining: Number(snap.remaining),
        utilisationPct: Number(snap.utilisationPct),
        overCommitted: Boolean(snap.overCommitted),
      }
      if (!valuesMatch(expected, mongoValues)) {
        drifts.push({
          projectId,
          orgId,
          reason: `Mongo snapshot drift: expected ${formatValues(expected)} got ${formatValues(mongoValues)}`,
        })
      }
    }

    const redisKey = redisKeys.budgetProject(projectId)
    const redisRaw = await redis.get(redisKey)
    if (redisRaw == null) {
      drifts.push({
        projectId,
        orgId,
        reason: `Missing Redis key ${redisKey}; expected ${formatValues(expected)}`,
      })
    } else {
      const redisValues = parseRedisSnapshot(redisRaw)
      if (!redisValues) {
        drifts.push({
          projectId,
          orgId,
          reason: `Invalid Redis payload at ${redisKey}`,
        })
      } else if (!valuesMatch(expected, redisValues)) {
        drifts.push({
          projectId,
          orgId,
          reason: `Redis drift at ${redisKey}: expected ${formatValues(expected)} got ${formatValues(redisValues)}`,
        })
      }
    }
  }

  return {
    ok: drifts.length === 0,
    checked: projectIds.length,
    drifts,
  }
}

export async function runBudgetVerify(options: ConnectDbOptions = {}): Promise<BudgetVerifyResult> {
  await connectDb(options)
  return verifyBudgets()
}

async function main(): Promise<void> {
  try {
    const result = await runBudgetVerify()
    if (result.ok) {
      console.log(`budget:verify ok — checked ${result.checked} project(s)`)
      return
    }
    console.error(
      `budget:verify FAILED — ${result.drifts.length} drift(s) in ${result.checked} project(s)`,
    )
    for (const drift of result.drifts) {
      console.error(`  ${drift.orgId}/${drift.projectId}: ${drift.reason}`)
    }
    process.exitCode = 1
  } finally {
    await disconnectDb()
  }
}

const entry = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : ''
if (import.meta.url === entry) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
