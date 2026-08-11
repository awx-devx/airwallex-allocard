/**
 * Approval rules are tenant-owned. Every method takes `OrgContext` first.
 * `projectId` null = org-wide default; project PUT replace never deletes those.
 */
import type { ApproverSelectorFields } from '@/server/models/ApprovalRule'
import { ApprovalRuleModel } from '@/server/models/ApprovalRule'
import { toDomain } from '@/server/models/base'
import type { OrgContext } from '@/server/http/types'
import { ApproverSelection } from '@/shared/enums/approverSelection'
import type { ApprovalRule, ApprovalRuleBody, ApproverSelector } from '@/shared/types/approvalRule'

/** Strip unused discriminator payload fields so domain matches the Zod union. */
function toApproverSelector(raw: unknown): ApproverSelector {
  const sel = raw as { type: ApproverSelection; roleKey?: unknown; userIds?: unknown }
  if (sel.type === ApproverSelection.ROLE) {
    return { type: ApproverSelection.ROLE, roleKey: String(sel.roleKey) }
  }
  if (sel.type === ApproverSelection.NAMED_USERS) {
    const userIds = Array.isArray(sel.userIds) ? sel.userIds.map(String) : []
    return { type: ApproverSelection.NAMED_USERS, userIds }
  }
  return { type: ApproverSelection.PROJECT_OWNER }
}

function selectorForStorage(sel: ApproverSelector): ApproverSelectorFields {
  if (sel.type === ApproverSelection.ROLE) {
    return { type: ApproverSelection.ROLE, roleKey: sel.roleKey }
  }
  if (sel.type === ApproverSelection.NAMED_USERS) {
    return { type: ApproverSelection.NAMED_USERS, userIds: sel.userIds }
  }
  return { type: ApproverSelection.PROJECT_OWNER }
}

function toApprovalRule(doc: Parameters<typeof toDomain>[0]): ApprovalRule {
  const raw = toDomain<Record<string, unknown>>(doc)
  return {
    id: String(raw.id),
    orgId: String(raw.orgId),
    projectId: raw.projectId == null ? null : String(raw.projectId),
    threshold: Number(raw.threshold),
    approverSelection: toApproverSelector(raw.approverSelection),
    requiredCount: Number(raw.requiredCount),
    escalationAfterMins: Number(raw.escalationAfterMins),
    escalateTo: toApproverSelector(raw.escalateTo),
    createdAt: String(raw.createdAt),
    updatedAt: String(raw.updatedAt),
  }
}

export async function listApprovalRules(
  ctx: OrgContext,
  projectId: string,
): Promise<ApprovalRule[]> {
  const docs = await ApprovalRuleModel.find({ orgId: ctx.orgId, projectId })
    .sort({ threshold: 1, _id: 1 })
    .lean()
    .exec()
  return docs.map((doc) => toApprovalRule(doc))
}

/** Org-wide defaults (`projectId` null). */
export async function listOrgDefaultApprovalRules(ctx: OrgContext): Promise<ApprovalRule[]> {
  const docs = await ApprovalRuleModel.find({ orgId: ctx.orgId, projectId: null })
    .sort({ threshold: 1, _id: 1 })
    .lean()
    .exec()
  return docs.map((doc) => toApprovalRule(doc))
}

/** Project rules plus org defaults, sorted by threshold ascending. */
export async function listApplicableApprovalRules(
  ctx: OrgContext,
  projectId: string,
): Promise<ApprovalRule[]> {
  const docs = await ApprovalRuleModel.find({
    orgId: ctx.orgId,
    $or: [{ projectId }, { projectId: null }],
  })
    .sort({ threshold: 1, _id: 1 })
    .lean()
    .exec()
  return docs.map((doc) => toApprovalRule(doc))
}

/**
 * Replace-all for a project: delete that project's rules, then insert bodies.
 * Org defaults (`projectId` null) are never deleted.
 */
export async function replaceProjectRules(
  ctx: OrgContext,
  projectId: string,
  bodies: ApprovalRuleBody[],
): Promise<ApprovalRule[]> {
  await ApprovalRuleModel.deleteMany({ orgId: ctx.orgId, projectId }).exec()

  if (bodies.length === 0) {
    return []
  }

  const docs = await ApprovalRuleModel.create(
    bodies.map((body) => ({
      orgId: ctx.orgId,
      projectId,
      threshold: body.threshold,
      approverSelection: selectorForStorage(body.approverSelection),
      requiredCount: body.requiredCount,
      escalationAfterMins: body.escalationAfterMins,
      escalateTo: selectorForStorage(body.escalateTo),
    })),
  )

  return docs
    .map((doc) => toApprovalRule(doc))
    .sort((a, b) => a.threshold - b.threshold || a.id.localeCompare(b.id))
}
