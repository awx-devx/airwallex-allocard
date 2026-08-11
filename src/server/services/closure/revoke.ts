/**
 * Closure REVOKE — expire project access scopes and strip spend permissions.
 * Does not close cards (CLOSE_CARDS is complete-only).
 */
import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import {
  findByProject as findClosureByProject,
  updateStep,
} from '@/server/repositories/projectClosures'
import {
  findActiveProjectMember,
  listActiveProjectMembers,
  rewriteEffectivePermissions,
} from '@/server/repositories/projectMembers'
import { findProjectById } from '@/server/repositories/projects'
import { updateProjectMemberForProject } from '@/server/services/projectMembers/mutate'
import { ClosureStep } from '@/shared/enums/closureStep'
import { ClosureStepStatus } from '@/shared/enums/closureStepStatus'
import { Permission } from '@/shared/enums/permissions'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import type { AccessScope } from '@/shared/types/accessScope'
import type { ProjectClosure } from '@/shared/types/closure'

function expiredScope(scope: AccessScope, nowIso: string): AccessScope {
  const existingTo = scope.validTo
  if (existingTo !== undefined && Date.parse(existingTo) <= Date.parse(nowIso)) {
    return scope
  }
  return { ...scope, validTo: nowIso }
}

/**
 * Expire every active member's access window and remove `payment.make`.
 * Marks REVOKE DONE; advances currentStep to CLOSE_CARDS when SETTLE is already DONE.
 */
export async function revokeClosure(ctx: OrgContext, projectId: string): Promise<ProjectClosure> {
  await connectDb()

  const project = await findProjectById(ctx, projectId)
  if (!project) {
    throw AppError.notFound()
  }
  if (project.status !== ProjectStatus.CLOSING) {
    throw AppError.conflict(`Project must be CLOSING to revoke access (was ${project.status})`)
  }

  const closure = await findClosureByProject(ctx, projectId)
  if (!closure) {
    throw AppError.notFound()
  }

  const revokeStep = closure.steps.find((s) => s.step === ClosureStep.REVOKE)
  if (revokeStep?.status === ClosureStepStatus.DONE) {
    return closure
  }

  const now = new Date()
  const nowIso = now.toISOString()
  const members = await listActiveProjectMembers(ctx, projectId)

  for (const member of members) {
    const nextScope = expiredScope(member.scope, nowIso)
    const scopeChanged =
      nextScope.validTo !== member.scope.validTo ||
      JSON.stringify(nextScope) !== JSON.stringify(member.scope)

    if (scopeChanged) {
      await updateProjectMemberForProject(ctx, projectId, member.userId, {
        scope: nextScope,
      })
    }

    const refreshed = await findActiveProjectMember(ctx, projectId, member.userId)
    if (!refreshed) continue

    if (refreshed.effectivePermissions.includes(Permission.PAYMENT_MAKE)) {
      const stripped = refreshed.effectivePermissions.filter((p) => p !== Permission.PAYMENT_MAKE)
      await rewriteEffectivePermissions(ctx, refreshed.id, stripped)
    }
  }

  const settleDone =
    closure.steps.find((s) => s.step === ClosureStep.SETTLE)?.status === ClosureStepStatus.DONE

  const updated = await updateStep(
    ctx,
    projectId,
    ClosureStep.REVOKE,
    {
      status: ClosureStepStatus.DONE,
      startedAt: revokeStep?.startedAt ? new Date(revokeStep.startedAt) : now,
      completedAt: now,
      detail: null,
    },
    settleDone ? ClosureStep.CLOSE_CARDS : undefined,
  )
  if (!updated) {
    throw AppError.notFound()
  }
  return updated
}
