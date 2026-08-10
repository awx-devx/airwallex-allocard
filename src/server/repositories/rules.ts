/**
 * Rules are tenant-owned. Every method takes `OrgContext` first and filters on
 * `ctx.orgId`. Cross-org find → null (handler maps to 404).
 * `version` bumps on every content patch — the DSL body is stored verbatim.
 */
import { isValidObjectId } from 'mongoose'
import { RuleModel } from '@/server/models/Rule'
import { toDomain } from '@/server/models/base'
import type { OrgContext } from '@/server/http/types'
import { RuleScopeLevel } from '@/shared/enums/ruleScopeLevel'
import type {
  Condition,
  Rule,
  RuleAction,
  RuleList,
  RuleScope,
  RuleTrigger,
} from '@/shared/types/rule'

export type CreateRuleFields = {
  scope: RuleScope
  name: string
  description?: string | null
  enabled?: boolean
  priority?: number
  trigger: RuleTrigger
  when: Condition
  then: RuleAction[]
  else?: RuleAction[]
  createdBy: string
}

export type UpdateRuleFields = {
  scope?: RuleScope
  name?: string
  description?: string | null
  priority?: number
  trigger?: RuleTrigger
  when?: Condition
  then?: RuleAction[]
  else?: RuleAction[] | null
}

export type ListRulesFilter = {
  projectId?: string
  enabled?: boolean
  page?: number
  pageSize?: number
}

function toRule(doc: Parameters<typeof toDomain>[0]): Rule {
  const raw = toDomain<Record<string, unknown>>(doc)
  const scope = raw.scope as { level: RuleScope['level']; projectId?: string }
  return {
    id: String(raw.id),
    orgId: String(raw.orgId),
    scope:
      scope.projectId === undefined || scope.projectId === null
        ? { level: scope.level }
        : { level: scope.level, projectId: String(scope.projectId) },
    name: String(raw.name),
    description: raw.description == null ? null : String(raw.description),
    enabled: Boolean(raw.enabled),
    priority: Number(raw.priority),
    trigger: raw.trigger as RuleTrigger,
    when: raw.when as Condition,
    then: raw.then as RuleAction[],
    ...(raw.else === undefined || raw.else === null ? {} : { else: raw.else as RuleAction[] }),
    createdBy: String(raw.createdBy),
    version: Number(raw.version),
    createdAt: String(raw.createdAt),
    updatedAt: String(raw.updatedAt),
  }
}

export async function createRule(ctx: OrgContext, input: CreateRuleFields): Promise<Rule> {
  const doc = await RuleModel.create({
    orgId: ctx.orgId,
    scope: input.scope,
    name: input.name,
    description: input.description ?? null,
    enabled: input.enabled ?? false,
    priority: input.priority ?? 100,
    trigger: input.trigger,
    when: input.when,
    then: input.then,
    ...(input.else === undefined ? {} : { else: input.else }),
    createdBy: input.createdBy,
    version: 1,
  })
  return toRule(doc)
}

export async function findRuleById(ctx: OrgContext, id: string): Promise<Rule | null> {
  if (!isValidObjectId(id)) {
    return null
  }
  const doc = await RuleModel.findOne({ _id: id, orgId: ctx.orgId }).lean().exec()
  return doc ? toRule(doc) : null
}

export async function findRulesByIds(ctx: OrgContext, ids: string[]): Promise<Rule[]> {
  const valid = ids.filter((id) => isValidObjectId(id))
  if (valid.length === 0) {
    return []
  }
  const docs = await RuleModel.find({ _id: { $in: valid }, orgId: ctx.orgId })
    .sort({ priority: 1, _id: 1 })
    .lean()
    .exec()
  return docs.map((doc) => toRule(doc))
}

export async function listRules(ctx: OrgContext, filter: ListRulesFilter = {}): Promise<RuleList> {
  const page = filter.page ?? 1
  const pageSize = filter.pageSize ?? 20

  const query: Record<string, unknown> = { orgId: ctx.orgId }
  if (filter.projectId !== undefined) query['scope.projectId'] = filter.projectId
  if (filter.enabled !== undefined) query.enabled = filter.enabled

  const [total, docs] = await Promise.all([
    RuleModel.countDocuments(query).exec(),
    RuleModel.find(query)
      .sort({ priority: 1, createdAt: -1, _id: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean()
      .exec(),
  ])

  return {
    items: docs.map((doc) => toRule(doc)),
    page,
    pageSize,
    total,
  }
}

/**
 * Enabled rules whose scope covers this subject: org-wide rules always apply;
 * project rules apply only to their own project. Sorted by ascending priority —
 * lower numbers merge last and therefore win ties.
 */
export async function listEnabledRulesForScope(
  ctx: OrgContext,
  projectId?: string | null,
): Promise<Rule[]> {
  const scopeClauses: Record<string, unknown>[] = [{ 'scope.level': RuleScopeLevel.ORG }]
  if (projectId) {
    scopeClauses.push({ 'scope.level': RuleScopeLevel.PROJECT, 'scope.projectId': projectId })
  }

  const docs = await RuleModel.find({
    orgId: ctx.orgId,
    enabled: true,
    $or: scopeClauses,
  })
    .sort({ priority: 1, _id: 1 })
    .lean()
    .exec()
  return docs.map((doc) => toRule(doc))
}

export async function updateRule(
  ctx: OrgContext,
  id: string,
  patch: UpdateRuleFields,
): Promise<Rule | null> {
  if (!isValidObjectId(id)) {
    return null
  }

  const $set: Record<string, unknown> = {}
  const $unset: Record<string, unknown> = {}
  if (patch.scope !== undefined) $set.scope = patch.scope
  if (patch.name !== undefined) $set.name = patch.name
  if (patch.description !== undefined) $set.description = patch.description
  if (patch.priority !== undefined) $set.priority = patch.priority
  if (patch.trigger !== undefined) $set.trigger = patch.trigger
  if (patch.when !== undefined) $set.when = patch.when
  if (patch.then !== undefined) $set.then = patch.then
  if (patch.else !== undefined) {
    if (patch.else === null) {
      $unset.else = ''
    } else {
      $set.else = patch.else
    }
  }

  if (Object.keys($set).length === 0 && Object.keys($unset).length === 0) {
    return findRuleById(ctx, id)
  }

  const doc = await RuleModel.findOneAndUpdate(
    { _id: id, orgId: ctx.orgId },
    {
      ...(Object.keys($set).length > 0 ? { $set } : {}),
      ...(Object.keys($unset).length > 0 ? { $unset } : {}),
      $inc: { version: 1 },
    },
    { returnDocument: 'after' },
  )
    .lean()
    .exec()
  return doc ? toRule(doc) : null
}

/** Enable / disable does not bump `version` — the rule body is unchanged. */
export async function setRuleEnabled(
  ctx: OrgContext,
  id: string,
  enabled: boolean,
): Promise<Rule | null> {
  if (!isValidObjectId(id)) {
    return null
  }
  const doc = await RuleModel.findOneAndUpdate(
    { _id: id, orgId: ctx.orgId },
    { $set: { enabled } },
    { returnDocument: 'after' },
  )
    .lean()
    .exec()
  return doc ? toRule(doc) : null
}

export async function deleteRule(ctx: OrgContext, id: string): Promise<boolean> {
  if (!isValidObjectId(id)) {
    return false
  }
  const result = await RuleModel.deleteOne({ _id: id, orgId: ctx.orgId }).exec()
  return result.deletedCount > 0
}
