import type { z } from 'zod'
import { connectDb } from '@/server/db/connect'
import { publishEvent } from '@/server/events/bus'
import { DomainEventType } from '@/server/events/types'
import { AppError, type FieldErrors } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import { findBudgetByProject } from '@/server/repositories/budgets'
import {
  findProjectById,
  updateStatus,
  type UpdateStatusExtras,
} from '@/server/repositories/projects'
import { audit } from '@/server/services/audit/log'
import { canTransition, type TransitionGuard } from '@/server/services/projects/transitions'
import { ActorType } from '@/shared/enums/audit'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import { projectReadyForApproval } from '@/shared/schemas/project'
import type { Project, TransitionProjectInput } from '@/shared/types/project'

function zodToFieldErrors(error: z.ZodError): FieldErrors {
  const fieldErrors: FieldErrors = {}
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_root'
    const existing = fieldErrors[key] ?? []
    fieldErrors[key] = [...existing, issue.message]
  }
  return fieldErrors
}

/**
 * Permission required to transition *to* the given status.
 * Submit / draft-cancel → edit; approve+launch → request.approve; lifecycle end → close.
 */
export function permissionForTransition(to: ProjectStatus): string {
  switch (to) {
    case ProjectStatus.PENDING_APPROVAL:
    case ProjectStatus.CANCELLED:
      return 'project.edit'
    case ProjectStatus.ACTIVE:
      return 'request.approve'
    case ProjectStatus.CLOSING:
    case ProjectStatus.CLOSED:
    case ProjectStatus.ARCHIVED:
      return 'project.close'
    default:
      return 'project.edit'
  }
}

async function applyReadyForApproval(ctx: OrgContext, project: Project): Promise<void> {
  const budget = await findBudgetByProject(ctx, project.id)
  const hasBudget = (budget?.approvedAmount ?? 0) > 0 || (project.budgetSnapshot?.approved ?? 0) > 0

  const parsed = projectReadyForApproval.safeParse({
    name: project.name,
    ownerId: project.ownerId,
    startDate: project.startDate,
    endDate: project.endDate,
    hasBudget,
  })
  if (!parsed.success) {
    throw AppError.validationFailed(zodToFieldErrors(parsed.error))
  }
}

function applyNoActiveCards(_project: Project): void {
  // TODO(B5): block → CLOSING while cards are active. No-op allow until B5.
  void _project
}

async function runGuards(
  ctx: OrgContext,
  project: Project,
  guards: readonly TransitionGuard[],
): Promise<void> {
  for (const guard of guards) {
    if (guard === 'readyForApproval') {
      await applyReadyForApproval(ctx, project)
    } else if (guard === 'noActiveCards') {
      applyNoActiveCards(project)
    }
  }
}

function statusExtras(to: ProjectStatus, now: Date): UpdateStatusExtras {
  if (to === ProjectStatus.ACTIVE) {
    return { approvedAt: now, launchedAt: now }
  }
  if (to === ProjectStatus.CLOSED) {
    return { closedAt: now }
  }
  return {}
}

async function emitTransitionEvents(
  ctx: OrgContext,
  project: Project,
  from: ProjectStatus,
  to: ProjectStatus,
): Promise<void> {
  const base = {
    orgId: ctx.orgId,
    projectId: project.id,
    subjectType: 'project' as const,
    subjectId: project.id,
  }

  if (to === ProjectStatus.ACTIVE) {
    await publishEvent({
      ...base,
      type: DomainEventType.PROJECT_APPROVED,
      payload: { projectId: project.id, from, to },
    })
    await publishEvent({
      ...base,
      type: DomainEventType.PROJECT_LAUNCHED,
      payload: { projectId: project.id, from, to },
    })
    return
  }

  if (to === ProjectStatus.CLOSING) {
    await publishEvent({
      ...base,
      type: DomainEventType.PROJECT_CLOSING,
      payload: { projectId: project.id, from, to },
    })
    return
  }

  if (to === ProjectStatus.CLOSED) {
    await publishEvent({
      ...base,
      type: DomainEventType.PROJECT_CLOSED,
      payload: { projectId: project.id, from, to },
    })
  }
}

/**
 * Single status mutation authority. Uses `canTransition` + data guards;
 * conditional `updateStatus` so concurrent launches emit `project.launched` once.
 */
export async function transitionProject(
  ctx: OrgContext,
  projectId: string,
  input: TransitionProjectInput,
): Promise<Project> {
  await connectDb()

  const before = await findProjectById(ctx, projectId)
  if (!before) {
    throw AppError.notFound()
  }

  const decision = canTransition(before.status, input.to)
  if (!decision.ok) {
    throw AppError.conflict('Invalid project status transition')
  }

  await runGuards(ctx, before, decision.guards)

  const now = new Date()
  const after = await updateStatus(
    ctx,
    projectId,
    before.status,
    input.to,
    statusExtras(input.to, now),
  )

  // Lost the race (e.g. concurrent → ACTIVE) — treat as conflict, no second event.
  if (!after) {
    throw AppError.conflict('Project status changed concurrently')
  }

  await audit(ctx, {
    action: 'project.transitioned',
    subjectType: 'project',
    subjectId: projectId,
    projectId,
    actorType: ActorType.USER,
    actorId: ctx.userId,
    before: { status: before.status },
    after: { status: after.status },
    metadata: {
      from: before.status,
      to: after.status,
      ...(input.reason !== undefined ? { reason: input.reason } : {}),
    },
  })

  await emitTransitionEvents(ctx, after, before.status, after.status)

  return after
}
