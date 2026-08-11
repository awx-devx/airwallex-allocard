/**
 * Enter CLOSING via closure/start only (not generic /transition).
 * Freezes project cards → INACTIVE (reuses freezeCard), emits project.closing,
 * upserts ProjectClosure with FREEZE→DONE and currentStep SETTLE.
 */
import { connectDb } from '@/server/db/connect'
import { publishEvent } from '@/server/events/bus'
import { DomainEventType } from '@/server/events/types'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import { listCards } from '@/server/repositories/cards'
import {
  findByProject as findClosureByProject,
  upsertStart,
} from '@/server/repositories/projectClosures'
import { findProjectById, updateStatus } from '@/server/repositories/projects'
import { audit } from '@/server/services/audit/log'
import { freezeCard, type LifecycleDeps } from '@/server/services/cards/lifecycle'
import { closurePreflight } from '@/server/services/closure/preflight'
import { toClosureStatus } from '@/server/services/closure/status'
import { ActorType } from '@/shared/enums/audit'
import { CardStatus } from '@/shared/enums/cardStatus'
import { ClosureStep } from '@/shared/enums/closureStep'
import { ClosureStepStatus } from '@/shared/enums/closureStepStatus'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import type { ClosureStatus } from '@/shared/types/closure'

export type StartClosureDeps = LifecycleDeps

function startSteps(now: Date): Array<{
  step: ClosureStep
  status: ClosureStepStatus
  startedAt: Date | null
  completedAt: Date | null
  detail: string | null
}> {
  return (Object.values(ClosureStep) as ClosureStep[]).map((step) => {
    if (step === ClosureStep.PREFLIGHT || step === ClosureStep.FREEZE) {
      return {
        step,
        status: ClosureStepStatus.DONE,
        startedAt: now,
        completedAt: now,
        detail: null,
      }
    }
    return {
      step,
      status: ClosureStepStatus.PENDING,
      startedAt: null,
      completedAt: null,
      detail: null,
    }
  })
}

async function freezeProjectCards(
  ctx: OrgContext,
  projectId: string,
  deps: StartClosureDeps,
): Promise<void> {
  const listed = await listCards(ctx, { projectId, page: 1, pageSize: 100 })
  for (const card of listed.items) {
    if (card.status === CardStatus.CLOSED) continue
    if (card.status === CardStatus.INACTIVE) continue
    await freezeCard(ctx, card.id, deps)
  }
}

/**
 * Start (or resume) project closure.
 * Resume: already CLOSING → return status without re-freezing DONE steps.
 */
export async function startClosure(
  ctx: OrgContext,
  projectId: string,
  deps: StartClosureDeps = {},
): Promise<ClosureStatus> {
  await connectDb()

  const project = await findProjectById(ctx, projectId)
  if (!project) {
    throw AppError.notFound()
  }

  // Idempotent resume — do not re-run FREEZE or re-emit events.
  if (project.status === ProjectStatus.CLOSING) {
    let closure = await findClosureByProject(ctx, projectId)
    if (!closure) {
      const now = new Date()
      closure = await upsertStart(ctx, {
        projectId,
        startedBy: ctx.userId,
        currentStep: ClosureStep.SETTLE,
        steps: startSteps(now),
        startedAt: now,
      })
    }
    return toClosureStatus(project, closure)
  }

  if (project.status !== ProjectStatus.ACTIVE) {
    throw AppError.conflict(`Project must be ACTIVE to start closure (was ${project.status})`)
  }

  const preflight = await closurePreflight(ctx, projectId)
  if (!preflight.canStart) {
    throw AppError.conflict(`Cannot start closure: ${preflight.blockers.length} blocker(s)`)
  }

  const now = new Date()
  const after = await updateStatus(ctx, projectId, ProjectStatus.ACTIVE, ProjectStatus.CLOSING)
  if (!after) {
    throw AppError.conflict('Project status changed concurrently')
  }

  await freezeProjectCards(ctx, projectId, deps)

  const closure = await upsertStart(ctx, {
    projectId,
    startedBy: ctx.userId,
    currentStep: ClosureStep.SETTLE,
    steps: startSteps(now),
    startedAt: now,
  })

  await audit(ctx, {
    action: 'project.closure_started',
    subjectType: 'project',
    subjectId: projectId,
    projectId,
    actorType: ActorType.USER,
    actorId: ctx.userId,
    before: { status: ProjectStatus.ACTIVE },
    after: { status: ProjectStatus.CLOSING },
    metadata: { currentStep: ClosureStep.SETTLE },
  })

  await publishEvent({
    type: DomainEventType.PROJECT_CLOSING,
    orgId: ctx.orgId,
    projectId,
    subjectType: 'project',
    subjectId: projectId,
    payload: {
      projectId,
      from: ProjectStatus.ACTIVE,
      to: ProjectStatus.CLOSING,
    },
  })

  return toClosureStatus(after, closure)
}
