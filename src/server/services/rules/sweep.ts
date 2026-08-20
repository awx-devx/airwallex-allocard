/**
 * Scheduled rules sweep — ARCHITECTURE §8 path 2 (backstop).
 *
 * Walks every org and evaluates enabled rules whose trigger carries a
 * `schedule`. Event-only rules are ignored (`SCHEDULED_SWEEP` selection).
 * In a healthy system this finds nothing to apply: the event path already
 * kept desired state current.
 */
import { connectDb } from '@/server/db/connect'
import type { ApplyDeps } from '@/server/services/rules/apply'
import { evaluateAndApply } from '@/server/services/rules/evaluateAndApply'
import { SCHEDULED_SWEEP } from '@/server/services/rules/select'
import { listAllOrganizations } from '@/server/repositories/organizations'
import { listProjects } from '@/server/repositories/projects'
import type { OrgContext } from '@/server/http/types'
import { ActorType } from '@/shared/enums/audit'
import { OrgRole } from '@/shared/enums/orgRole'

function systemCtx(orgId: string): OrgContext {
  return { orgId, userId: 'system', orgRole: OrgRole.OWNER }
}

export type SweepRulesResult = {
  orgsVisited: number
  evaluations: number
}

/**
 * Re-evaluate scheduled rules for every organisation.
 * Org-scoped rules run once with `projectId: null`; project-scoped rules run
 * once per project so `listEnabledRulesForScope` can see them.
 */
export async function sweepScheduledRules(deps: ApplyDeps = {}): Promise<SweepRulesResult> {
  await connectDb()
  const orgs = await listAllOrganizations()
  let evaluations = 0

  for (const org of orgs) {
    const ctx = systemCtx(org.id)

    await evaluateAndApply(
      ctx,
      {
        triggerEvent: SCHEDULED_SWEEP,
        projectId: null,
        triggeredBy: 'system',
        triggeredByType: ActorType.SYSTEM,
      },
      deps,
    )
    evaluations += 1

    // Page through projects — a demo org is small; production can grow.
    let page = 1
    let total = Infinity
    while ((page - 1) * 100 < total) {
      const projects = await listProjects(ctx, { page, pageSize: 100 })
      total = projects.total
      for (const project of projects.items) {
        await evaluateAndApply(
          ctx,
          {
            triggerEvent: SCHEDULED_SWEEP,
            projectId: project.id,
            triggeredBy: 'system',
            triggeredByType: ActorType.SYSTEM,
          },
          deps,
        )
        evaluations += 1
      }
      page += 1
      if (projects.items.length === 0) {
        break
      }
    }
  }

  return { orgsVisited: orgs.length, evaluations }
}
