/**
 * Rules HTTP services — CRUD, enable/disable, and builder validation.
 * PATCH bumps `version` (repository); enable does not. Validate never writes.
 */
import { connectDb } from '@/server/db/connect'
import { FormulaError } from '@/server/lib/formula'
import { parseRuleFormula } from '@/server/lib/formula/rules'
import { DomainEventType } from '@/server/events/types'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import {
  createRule,
  deleteRule,
  findRuleById,
  listRules,
  setRuleEnabled,
  updateRule,
} from '@/server/repositories/rules'
import { findProjectById } from '@/server/repositories/projects'
import { audit } from '@/server/services/audit/log'
import { isDateLiteral } from '@/server/services/rules/context'
import { evaluateAndApply } from '@/server/services/rules/evaluateAndApply'
import { ActorType } from '@/shared/enums/audit'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import type {
  Condition,
  CreateRuleInput,
  EnableRuleInput,
  ListRulesQuery,
  Rule,
  RuleAction,
  RuleControlsParams,
  RuleList,
  UpdateRuleInput,
  ValidateRuleInput,
  ValidateRuleOutput,
} from '@/shared/types/rule'

export async function listRulesForOrg(ctx: OrgContext, query: ListRulesQuery): Promise<RuleList> {
  await connectDb()
  return listRules(ctx, query)
}

export async function createRuleForOrg(ctx: OrgContext, input: CreateRuleInput): Promise<Rule> {
  await connectDb()

  const created = await createRule(ctx, {
    scope: input.scope,
    name: input.name,
    description: input.description ?? null,
    enabled: input.enabled ?? false,
    priority: input.priority ?? 100,
    trigger: input.trigger,
    when: input.when,
    then: input.then,
    ...(input.else !== undefined ? { else: input.else } : {}),
    createdBy: ctx.userId,
  })

  await audit(ctx, {
    action: 'rule.created',
    subjectType: 'rule',
    subjectId: created.id,
    ...(created.scope.projectId ? { projectId: created.scope.projectId } : {}),
    after: {
      name: created.name,
      enabled: created.enabled,
      priority: created.priority,
      version: created.version,
    },
  })

  return created
}

export async function updateRuleForOrg(
  ctx: OrgContext,
  id: string,
  input: UpdateRuleInput,
): Promise<Rule> {
  await connectDb()

  const existing = await findRuleById(ctx, id)
  if (!existing) {
    throw AppError.notFound()
  }

  const updated = await updateRule(ctx, id, {
    ...(input.scope !== undefined ? { scope: input.scope } : {}),
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.trigger !== undefined ? { trigger: input.trigger } : {}),
    ...(input.when !== undefined ? { when: input.when } : {}),
    ...(input.then !== undefined ? { then: input.then } : {}),
    ...(input.else !== undefined ? { else: input.else } : {}),
  })

  if (!updated) {
    throw AppError.notFound()
  }

  await audit(ctx, {
    action: 'rule.updated',
    subjectType: 'rule',
    subjectId: updated.id,
    ...(updated.scope.projectId ? { projectId: updated.scope.projectId } : {}),
    before: { version: existing.version, name: existing.name },
    after: { version: updated.version, name: updated.name },
  })

  return updated
}

export async function deleteRuleForOrg(ctx: OrgContext, id: string): Promise<void> {
  await connectDb()

  const existing = await findRuleById(ctx, id)
  if (!existing) {
    throw AppError.notFound()
  }

  const deleted = await deleteRule(ctx, id)
  if (!deleted) {
    throw AppError.notFound()
  }

  await audit(ctx, {
    action: 'rule.deleted',
    subjectType: 'rule',
    subjectId: id,
    ...(existing.scope.projectId ? { projectId: existing.scope.projectId } : {}),
    before: { name: existing.name, version: existing.version },
  })
}

export async function enableRuleForOrg(
  ctx: OrgContext,
  id: string,
  input: EnableRuleInput,
): Promise<Rule> {
  await connectDb()

  const existing = await findRuleById(ctx, id)
  if (!existing) {
    throw AppError.notFound()
  }

  const updated = await setRuleEnabled(ctx, id, input.enabled)
  if (!updated) {
    throw AppError.notFound()
  }

  await audit(ctx, {
    action: input.enabled ? 'rule.enabled' : 'rule.disabled',
    subjectType: 'rule',
    subjectId: updated.id,
    ...(updated.scope.projectId ? { projectId: updated.scope.projectId } : {}),
    before: { enabled: existing.enabled, version: existing.version },
    after: { enabled: updated.enabled, version: updated.version },
  })

  if (input.enabled && existing.enabled === false) {
    await replayLaunchedRuleIfActive(ctx, updated)
  }

  return updated
}

async function replayLaunchedRuleIfActive(ctx: OrgContext, rule: Rule): Promise<void> {
  const projectId = rule.scope.projectId
  if (!projectId) {
    return
  }
  if (!rule.trigger.events?.includes(DomainEventType.PROJECT_LAUNCHED)) {
    return
  }
  const project = await findProjectById(ctx, projectId)
  if (project?.status !== ProjectStatus.ACTIVE) {
    return
  }
  await evaluateAndApply(ctx, {
    triggerEvent: DomainEventType.PROJECT_LAUNCHED,
    projectId,
    ruleIds: [rule.id],
    triggeredBy: ctx.userId,
    triggeredByType: ActorType.USER,
  })
}

type FormulaIssue = { path: string; message: string }

function tryParseFormula(expression: string, path: string, issues: FormulaIssue[]): void {
  try {
    parseRuleFormula(expression)
  } catch (error) {
    issues.push({
      path,
      message: error instanceof FormulaError ? error.message : 'Invalid formula',
    })
  }
}

function collectConditionFormulas(
  condition: Condition,
  path: string,
  issues: FormulaIssue[],
): void {
  if (condition.expr !== undefined) {
    tryParseFormula(condition.expr, `${path}.expr`, issues)
  }
  if (condition.all) {
    condition.all.forEach((child, index) =>
      collectConditionFormulas(child, `${path}.all.${index}`, issues),
    )
  }
  if (condition.any) {
    condition.any.forEach((child, index) =>
      collectConditionFormulas(child, `${path}.any.${index}`, issues),
    )
  }
  if (condition.not) {
    collectConditionFormulas(condition.not, `${path}.not`, issues)
  }
}

function collectParamsFormulas(
  params: RuleControlsParams,
  path: string,
  issues: FormulaIssue[],
): void {
  if (params.transactionLimits) {
    params.transactionLimits.limits.forEach((limit, index) => {
      if (typeof limit.amount === 'string') {
        tryParseFormula(limit.amount, `${path}.transactionLimits.limits.${index}.amount`, issues)
      }
    })
  }
  for (const field of ['activeFrom', 'activeTo'] as const) {
    const value = params[field]
    if (typeof value === 'string' && !isDateLiteral(value)) {
      // Attribute key or formula — bare identifiers parse as a single identifier AST.
      tryParseFormula(value, `${path}.${field}`, issues)
    }
  }
}

function collectActionFormulas(actions: RuleAction[], path: string, issues: FormulaIssue[]): void {
  actions.forEach((action, index) => {
    collectParamsFormulas(action.params, `${path}.${index}.params`, issues)
  })
}

/**
 * Builder validation: structure already passed Zod; this walk catches formula
 * syntax errors so the UI can underline them before save.
 */
export function validateRuleDsl(input: ValidateRuleInput): ValidateRuleOutput {
  const issues: FormulaIssue[] = []

  if (input.when) {
    collectConditionFormulas(input.when, 'when', issues)
  }
  if (input.then) {
    collectActionFormulas(input.then, 'then', issues)
  }
  if (input.else) {
    collectActionFormulas(input.else, 'else', issues)
  }

  if (issues.length > 0) {
    return { ok: false, errors: issues }
  }
  return { ok: true }
}
