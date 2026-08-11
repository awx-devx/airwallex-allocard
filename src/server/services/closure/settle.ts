/**
 * Closure SETTLE — wait until no uncleared AUTHORIZED auths remain for project cards.
 * Marks SETTLE DONE when clear; else BLOCKED with pending count.
 * Callable from status poll or complete.
 */
import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import {
  findByProject as findClosureByProject,
  updateStep,
} from '@/server/repositories/projectClosures'
import { findProjectById } from '@/server/repositories/projects'
import { listTransactions } from '@/server/repositories/transactions'
import { ClosureStep } from '@/shared/enums/closureStep'
import { ClosureStepStatus } from '@/shared/enums/closureStepStatus'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import { TransactionStatus } from '@/shared/enums/transactionStatus'
import { TransactionType } from '@/shared/enums/transactionType'
import type { ProjectClosure } from '@/shared/types/closure'

const AUTH_TYPES: ReadonlySet<string> = new Set([
  TransactionType.AUTHORIZATION,
  TransactionType.INCREMENTAL_AUTHORIZATION,
])

const LIST_PAGE_SIZE = 100

/**
 * Count AUTHORIZED auth-type transactions still uncleared for the project.
 * (No separate PENDING status — AUTHORIZED is the non-terminal uncleared state.)
 */
export async function countPendingAuthorizations(
  ctx: OrgContext,
  projectId: string,
): Promise<number> {
  const listed = await listTransactions(ctx, {
    projectId,
    status: TransactionStatus.AUTHORIZED,
    page: 1,
    pageSize: LIST_PAGE_SIZE,
  })
  return listed.items.filter((tx) => AUTH_TYPES.has(tx.type)).length
}

/**
 * Advance SETTLE: DONE when no pending auths; BLOCKED with detail count otherwise.
 * Idempotent when SETTLE is already DONE.
 */
export async function settleClosure(ctx: OrgContext, projectId: string): Promise<ProjectClosure> {
  await connectDb()

  const project = await findProjectById(ctx, projectId)
  if (!project) {
    throw AppError.notFound()
  }
  if (project.status !== ProjectStatus.CLOSING) {
    throw AppError.conflict(`Project must be CLOSING to settle (was ${project.status})`)
  }

  const closure = await findClosureByProject(ctx, projectId)
  if (!closure) {
    throw AppError.notFound()
  }

  const settleStep = closure.steps.find((s) => s.step === ClosureStep.SETTLE)
  if (settleStep?.status === ClosureStepStatus.DONE) {
    return closure
  }

  const pending = await countPendingAuthorizations(ctx, projectId)
  const now = new Date()

  if (pending > 0) {
    const updated = await updateStep(ctx, projectId, ClosureStep.SETTLE, {
      status: ClosureStepStatus.BLOCKED,
      startedAt: settleStep?.startedAt ? new Date(settleStep.startedAt) : now,
      completedAt: null,
      detail: `${pending} pending authorization(s)`,
    })
    if (!updated) {
      throw AppError.notFound()
    }
    return updated
  }

  const updated = await updateStep(
    ctx,
    projectId,
    ClosureStep.SETTLE,
    {
      status: ClosureStepStatus.DONE,
      startedAt: settleStep?.startedAt ? new Date(settleStep.startedAt) : now,
      completedAt: now,
      detail: null,
    },
    ClosureStep.REVOKE,
  )
  if (!updated) {
    throw AppError.notFound()
  }
  return updated
}
