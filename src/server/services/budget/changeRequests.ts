import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import {
  createChangeRequest as createChangeRequestRecord,
  decideChangeRequest as decideChangeRequestRecord,
  findChangeRequestById,
  listChangeRequests as listChangeRequestsRecord,
} from '@/server/repositories/budgetChangeRequests'
import { findBudgetByProject, upsertBudgetFields } from '@/server/repositories/budgets'
import { findProjectById } from '@/server/repositories/projects'
import { audit } from '@/server/services/audit/log'
import { appendBudgetEntry } from '@/server/services/budget/ledger'
import { ActorType } from '@/shared/enums/audit'
import { BudgetChangeRequestStatus } from '@/shared/enums/budgetChangeRequestStatus'
import { BudgetEntrySourceType } from '@/shared/enums/budgetEntrySourceType'
import { BudgetEntryType } from '@/shared/enums/budgetEntryType'
import type {
  BudgetChangeRequest,
  CreateBudgetChangeRequestInput,
  DecideBudgetChangeRequestInput,
} from '@/shared/types/budget'

async function requireProject(ctx: OrgContext, projectId: string) {
  const project = await findProjectById(ctx, projectId)
  if (!project) {
    throw AppError.notFound()
  }
  return project
}

/** List change requests for a project. */
export async function listBudgetChangeRequests(
  ctx: OrgContext,
  projectId: string,
): Promise<BudgetChangeRequest[]> {
  await connectDb()
  await requireProject(ctx, projectId)
  return listChangeRequestsRecord(ctx, projectId)
}

/** Create a PENDING budget change request. */
export async function createBudgetChangeRequest(
  ctx: OrgContext,
  projectId: string,
  input: CreateBudgetChangeRequestInput,
): Promise<BudgetChangeRequest> {
  await connectDb()
  await requireProject(ctx, projectId)

  const budget = await findBudgetByProject(ctx, projectId)
  if (!budget) {
    throw AppError.notFound()
  }

  const nextApproved = budget.approvedAmount + input.deltaAmount
  if (nextApproved < 0) {
    throw AppError.validationFailed({
      deltaAmount: ['Change would make approvedAmount negative'],
    })
  }

  const created = await createChangeRequestRecord(ctx, {
    projectId,
    requestedBy: ctx.userId,
    deltaAmount: input.deltaAmount,
    reason: input.reason,
  })

  await audit(ctx, {
    action: 'budget.change_request_created',
    subjectType: 'budgetChangeRequest',
    subjectId: created.id,
    projectId,
    actorType: ActorType.USER,
    actorId: ctx.userId,
    after: created,
  })

  return created
}

/**
 * Approve or reject a PENDING change request.
 * APPROVE appends an ADJUSTMENT via the ledger and updates budget.approvedAmount.
 * Concurrent double-decide: one wins, the other gets 409.
 */
export async function decideBudgetChangeRequest(
  ctx: OrgContext,
  requestId: string,
  input: DecideBudgetChangeRequestInput,
): Promise<BudgetChangeRequest> {
  await connectDb()

  const before = await findChangeRequestById(ctx, requestId)
  if (!before) {
    throw AppError.notFound()
  }
  if (before.status !== BudgetChangeRequestStatus.PENDING) {
    throw AppError.conflict('Change request is already decided')
  }

  const status =
    input.decision === 'APPROVE'
      ? BudgetChangeRequestStatus.APPROVED
      : BudgetChangeRequestStatus.REJECTED

  if (input.decision === 'APPROVE') {
    const budget = await findBudgetByProject(ctx, before.projectId)
    if (!budget) {
      throw AppError.notFound()
    }
    const nextApproved = budget.approvedAmount + before.deltaAmount
    if (nextApproved < 0) {
      throw AppError.validationFailed({
        deltaAmount: ['Change would make approvedAmount negative'],
      })
    }
  }

  const after = await decideChangeRequestRecord(ctx, requestId, status)
  if (!after) {
    throw AppError.conflict('Change request is already decided')
  }

  if (input.decision === 'APPROVE') {
    const budget = await findBudgetByProject(ctx, after.projectId)
    if (!budget) {
      throw AppError.notFound()
    }

    const nextApproved = budget.approvedAmount + after.deltaAmount
    await upsertBudgetFields(ctx, after.projectId, {
      currency: budget.currency,
      approvedAmount: nextApproved,
      formula: budget.formula,
      thresholdPcts: budget.thresholdPcts,
    })

    await appendBudgetEntry(ctx, after.projectId, {
      type: BudgetEntryType.ADJUSTMENT,
      amount: after.deltaAmount,
      currency: budget.currency,
      sourceType: BudgetEntrySourceType.MANUAL,
      sourceId: after.id,
      createdBy: ctx.userId,
      note: input.note ?? after.reason,
    })
  }

  await audit(ctx, {
    action: 'budget.change_request_decided',
    subjectType: 'budgetChangeRequest',
    subjectId: after.id,
    projectId: after.projectId,
    actorType: ActorType.USER,
    actorId: ctx.userId,
    before,
    after,
    metadata: {
      decision: input.decision,
      ...(input.note !== undefined ? { note: input.note } : {}),
    },
  })

  return after
}
