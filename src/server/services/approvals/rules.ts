/**
 * Project approval-rules list + atomic replace.
 * PUT writes exactly one audit entry.
 */
import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import { listApprovalRules, replaceProjectRules } from '@/server/repositories/approvalRules'
import { findProjectById } from '@/server/repositories/projects'
import { audit } from '@/server/services/audit/log'
import { ActorType } from '@/shared/enums/audit'
import type {
  ApprovalRule,
  ApprovalRuleList,
  PutApprovalRulesInput,
} from '@/shared/types/approvalRule'

async function requireProject(ctx: OrgContext, projectId: string) {
  const project = await findProjectById(ctx, projectId)
  if (!project) {
    throw AppError.notFound()
  }
  return project
}

/** GET /api/projects/:id/approval-rules — project rules only (not org defaults). */
export async function listProjectApprovalRules(
  ctx: OrgContext,
  projectId: string,
): Promise<ApprovalRuleList> {
  await connectDb()
  await requireProject(ctx, projectId)
  return listApprovalRules(ctx, projectId)
}

/**
 * PUT /api/projects/:id/approval-rules — replace-all for the project.
 * Org-default rules (projectId null) are never touched. Exactly one audit entry.
 */
export async function putProjectApprovalRules(
  ctx: OrgContext,
  projectId: string,
  bodies: PutApprovalRulesInput,
): Promise<ApprovalRule[]> {
  await connectDb()
  await requireProject(ctx, projectId)

  const before = await listApprovalRules(ctx, projectId)
  const after = await replaceProjectRules(ctx, projectId, bodies)

  await audit(ctx, {
    action: 'approval_rule.replaced',
    subjectType: 'project',
    subjectId: projectId,
    projectId,
    actorType: ActorType.USER,
    actorId: ctx.userId,
    before,
    after,
  })

  return after
}
