/**
 * Closure complete — SETTLE/REVOKE if needed, CLOSE_CARDS (confirmed), FINAL_REPORT,
 * ARCHIVE (CLOSING→CLOSED→ARCHIVED). Resumable: skips DONE steps.
 *
 * Card close is only reachable here (or the explicit card close HTTP path) —
 * never from rules.
 */
import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import { listCards } from '@/server/repositories/cards'
import {
  findByProject as findClosureByProject,
  markComplete,
  updateStep,
} from '@/server/repositories/projectClosures'
import { findProjectById } from '@/server/repositories/projects'
import { iterateTransactions } from '@/server/repositories/transactions'
import { audit } from '@/server/services/audit/log'
import { closeCard, type LifecycleDeps } from '@/server/services/cards/lifecycle'
import { revokeClosure } from '@/server/services/closure/revoke'
import { settleClosure } from '@/server/services/closure/settle'
import { toClosureStatus } from '@/server/services/closure/status'
import { getProjectAccessHistory } from '@/server/services/projectMembers/accessHistory'
import { transitionProject } from '@/server/services/projects/transition'
import { getProjectReport } from '@/server/services/reports/project'
import { ActorType } from '@/shared/enums/audit'
import { CardStatus } from '@/shared/enums/cardStatus'
import { ClosureStep } from '@/shared/enums/closureStep'
import { ClosureStepStatus } from '@/shared/enums/closureStepStatus'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import type { CompleteClosureInput, ClosureStatus, ProjectClosure } from '@/shared/types/closure'
import type { FinalReport } from '@/shared/types/report'

export type CompleteClosureDeps = LifecycleDeps

function stepStatus(closure: ProjectClosure, step: ClosureStep): ClosureStepStatus | undefined {
  return closure.steps.find((s) => s.step === step)?.status
}

async function countProjectTransactions(ctx: OrgContext, projectId: string): Promise<number> {
  let n = 0
  for await (const _tx of iterateTransactions(ctx, { projectId })) {
    void _tx
    n += 1
  }
  return n
}

async function buildFinalReport(
  ctx: OrgContext,
  projectId: string,
  closedAt: string,
  archivedAt: string | null,
): Promise<FinalReport> {
  const report = await getProjectReport(ctx, projectId)
  const [transactionCount, accessHistory] = await Promise.all([
    countProjectTransactions(ctx, projectId),
    getProjectAccessHistory(ctx, projectId),
  ])
  return {
    ...report,
    closedAt,
    archivedAt,
    transactionCount,
    accessHistoryCount: accessHistory.length,
  }
}

async function closeProjectCards(
  ctx: OrgContext,
  projectId: string,
  deps: CompleteClosureDeps,
): Promise<void> {
  const listed = await listCards(ctx, { projectId, page: 1, pageSize: 100 })
  for (const card of listed.items) {
    if (card.status === CardStatus.CLOSED) continue
    await closeCard(ctx, card.id, { confirm: true }, deps)
  }
}

/**
 * Complete (or resume) project closure through CLOSE_CARDS → FINAL_REPORT → ARCHIVE.
 * Requires both confirm literals (validated by the route schema).
 */
export async function completeClosure(
  ctx: OrgContext,
  projectId: string,
  input: CompleteClosureInput,
  deps: CompleteClosureDeps = {},
): Promise<ClosureStatus> {
  await connectDb()

  if (input.confirmCloseCards !== true || input.confirmArchive !== true) {
    throw AppError.validationFailed({
      ...(input.confirmCloseCards !== true ? { confirmCloseCards: ['Must be true'] } : {}),
      ...(input.confirmArchive !== true ? { confirmArchive: ['Must be true'] } : {}),
    })
  }

  let project = await findProjectById(ctx, projectId)
  if (!project) {
    throw AppError.notFound()
  }

  let closure = await findClosureByProject(ctx, projectId)
  if (!closure) {
    throw AppError.notFound()
  }

  // Idempotent: fully archived + ARCHIVE DONE → return status.
  if (
    stepStatus(closure, ClosureStep.ARCHIVE) === ClosureStepStatus.DONE &&
    closure.completedAt !== null
  ) {
    return toClosureStatus(project, closure)
  }

  if (project.status !== ProjectStatus.CLOSING && project.status !== ProjectStatus.CLOSED) {
    throw AppError.conflict(
      `Project must be CLOSING or CLOSED to complete closure (was ${project.status})`,
    )
  }

  // Advance SETTLE / REVOKE when still CLOSING.
  if (project.status === ProjectStatus.CLOSING) {
    closure = await settleClosure(ctx, projectId)
    if (stepStatus(closure, ClosureStep.SETTLE) !== ClosureStepStatus.DONE) {
      throw AppError.conflict(
        closure.steps.find((s) => s.step === ClosureStep.SETTLE)?.detail ??
          'Cannot complete closure: SETTLE not done',
      )
    }

    if (stepStatus(closure, ClosureStep.REVOKE) !== ClosureStepStatus.DONE) {
      closure = await revokeClosure(ctx, projectId)
    }
  }

  const now = new Date()

  // CLOSE_CARDS — confirmed closes only; never from rules.
  if (stepStatus(closure, ClosureStep.CLOSE_CARDS) !== ClosureStepStatus.DONE) {
    if (project.status !== ProjectStatus.CLOSING) {
      throw AppError.conflict('CLOSE_CARDS requires project CLOSING')
    }
    const closeStep = closure.steps.find((s) => s.step === ClosureStep.CLOSE_CARDS)
    await closeProjectCards(ctx, projectId, deps)
    const updated = await updateStep(
      ctx,
      projectId,
      ClosureStep.CLOSE_CARDS,
      {
        status: ClosureStepStatus.DONE,
        startedAt: closeStep?.startedAt ? new Date(closeStep.startedAt) : now,
        completedAt: now,
        detail: null,
      },
      ClosureStep.FINAL_REPORT,
    )
    if (!updated) throw AppError.notFound()
    closure = updated
  }

  // ARCHIVE transitions: CLOSING→CLOSED then CLOSED→ARCHIVED.
  // FINAL_REPORT runs after CLOSED so closedAt is set; ARCHIVE finishes with archivedAt.
  if (project.status === ProjectStatus.CLOSING) {
    project = await transitionProject(ctx, projectId, { to: ProjectStatus.CLOSED })
  }

  if (stepStatus(closure, ClosureStep.FINAL_REPORT) !== ClosureStepStatus.DONE) {
    const closedAt = project.closedAt ?? now.toISOString()
    const finalReport = await buildFinalReport(ctx, projectId, closedAt, null)
    const stored = await markComplete(ctx, projectId, { finalReportSnapshot: finalReport })
    if (!stored) throw AppError.notFound()

    const reportStep = stored.steps.find((s) => s.step === ClosureStep.FINAL_REPORT)
    const updated = await updateStep(
      ctx,
      projectId,
      ClosureStep.FINAL_REPORT,
      {
        status: ClosureStepStatus.DONE,
        startedAt: reportStep?.startedAt ? new Date(reportStep.startedAt) : now,
        completedAt: now,
        detail: null,
      },
      ClosureStep.ARCHIVE,
    )
    if (!updated) throw AppError.notFound()
    closure = updated
  }

  if (stepStatus(closure, ClosureStep.ARCHIVE) !== ClosureStepStatus.DONE) {
    if (project.status === ProjectStatus.CLOSED) {
      project = await transitionProject(ctx, projectId, { to: ProjectStatus.ARCHIVED })
    }

    const archivedAt = now.toISOString()
    const closedAt = project.closedAt ?? closure.finalReportSnapshot?.closedAt ?? archivedAt
    const finalReport = await buildFinalReport(ctx, projectId, closedAt, archivedAt)
    const completedAt = now
    const stored = await markComplete(ctx, projectId, {
      completedAt,
      finalReportSnapshot: finalReport,
    })
    if (!stored) throw AppError.notFound()

    const archiveStep = stored.steps.find((s) => s.step === ClosureStep.ARCHIVE)
    const updated = await updateStep(ctx, projectId, ClosureStep.ARCHIVE, {
      status: ClosureStepStatus.DONE,
      startedAt: archiveStep?.startedAt ? new Date(archiveStep.startedAt) : now,
      completedAt: now,
      detail: null,
    })
    if (!updated) throw AppError.notFound()
    closure = updated

    await audit(ctx, {
      action: 'project.closure_completed',
      subjectType: 'project',
      subjectId: projectId,
      projectId,
      actorType: ActorType.USER,
      actorId: ctx.userId,
      before: { status: ProjectStatus.CLOSING },
      after: { status: ProjectStatus.ARCHIVED },
      metadata: {
        closedAt,
        archivedAt,
        transactionCount: finalReport.transactionCount,
        accessHistoryCount: finalReport.accessHistoryCount,
      },
    })
  }

  // Refresh project for wire status.
  const fresh = await findProjectById(ctx, projectId)
  if (!fresh) throw AppError.notFound()
  return toClosureStatus(fresh, closure)
}

/**
 * Return the stored final report snapshot. Missing / not yet generated → 404.
 */
export async function getFinalReport(ctx: OrgContext, projectId: string): Promise<FinalReport> {
  await connectDb()

  const project = await findProjectById(ctx, projectId)
  if (!project) {
    throw AppError.notFound()
  }

  const closure = await findClosureByProject(ctx, projectId)
  if (!closure?.finalReportSnapshot) {
    throw AppError.notFound()
  }

  return closure.finalReportSnapshot
}
