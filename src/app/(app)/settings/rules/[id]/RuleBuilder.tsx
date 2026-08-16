'use client'

import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { isApiError } from '@/client/api/errors'
import { useProjectCards } from '@/client/hooks/useCards'
import { useProjects } from '@/client/hooks/useProjects'
import {
  useAttributes,
  useCreateRule,
  useDeleteRule,
  useEnableRule,
  useRules,
  useSimulateRules,
  useUpdateRule,
  useValidateRule,
} from '@/client/hooks/useRules'
import { useMe, usePermissions } from '@/client/hooks/useSession'
import { applyServerErrorsFromApiError, useZodForm } from '@/client/lib/forms'
import { activeOrgRole } from '@/client/lib/projects'
import {
  applyTemplate,
  attributeOptions,
  DRAFT_RULE_ID,
  editControlsDenialMessage,
  emptyDraftRule,
  findRuleById,
  formatMatchPreview,
  holdsControlEdit,
  isNewRuleId,
  matchPreviewFromSimulate,
  orgRulesHref,
  parseIntInput,
  parseOptionalIdParam,
  parseTemplateParam,
  RULE_VALIDATE_DEBOUNCE_MS,
  ruleBuilderHref,
  ruleNotFoundMessage,
  ruleSimulateHref,
  toCreateRuleInput,
} from '@/client/lib/rules'
import { useActiveOrg } from '@/client/providers/ActiveOrgProvider'
import { ActionList } from '@/app/(app)/settings/rules/[id]/ActionList'
import { ConditionBuilder } from '@/app/(app)/settings/rules/[id]/ConditionBuilder'
import { TriggerPicker } from '@/app/(app)/settings/rules/[id]/TriggerPicker'
import { ConfirmDialog } from '@/components/patterns/ConfirmDialog'
import { ErrorState } from '@/components/patterns/ErrorState'
import { LoadingState } from '@/components/patterns/LoadingState'
import { MoneyDisplay } from '@/components/patterns/MoneyDisplay'
import { PermissionGateView } from '@/components/patterns/PermissionGate'
import { RuleSentence } from '@/components/patterns/RuleSentence'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { formatMaskedCard } from '@/lib/format/cardNumber'
import { ErrorCode } from '@/shared/enums/errors'
import { RuleScopeLevel } from '@/shared/enums/ruleScopeLevel'
import { createRuleInput } from '@/shared/schemas/rule'
import type { CreateRuleInput, Rule, RuleScope } from '@/shared/types/rule'
import type { SimulateRulesOutput } from '@/shared/types/ruleRun'
import type { FieldValues, UseFormReturn } from 'react-hook-form'

function initialNewDraft(search: {
  template: string | null
  projectId: string | undefined
}): CreateRuleInput {
  const template = parseTemplateParam({ template: search.template ?? undefined })
  const projectId = search.projectId
  const scope: RuleScope =
    projectId !== undefined
      ? { level: RuleScopeLevel.PROJECT, projectId }
      : { level: RuleScopeLevel.ORG }
  if (template) {
    return applyTemplate(template, scope)
  }
  return emptyDraftRule(
    projectId !== undefined
      ? { level: RuleScopeLevel.PROJECT, projectId }
      : { level: RuleScopeLevel.ORG },
  )
}

function ruleToDraft(rule: Rule): CreateRuleInput {
  const scope: RuleScope =
    rule.scope.level === RuleScopeLevel.ORG
      ? { level: RuleScopeLevel.ORG }
      : { level: RuleScopeLevel.PROJECT, projectId: rule.scope.projectId ?? '' }
  return {
    scope,
    name: rule.name,
    description: rule.description ?? undefined,
    priority: rule.priority,
    trigger: rule.trigger,
    when: rule.when,
    then: rule.then,
    else: rule.else,
  }
}

function triggerReady(trigger: CreateRuleInput['trigger']): boolean {
  return (
    (trigger.events?.length ?? 0) > 0 || Boolean(trigger.schedule && trigger.schedule.length > 0)
  )
}

export function RuleBuilder() {
  const raw = useParams().id
  const id =
    parseOptionalIdParam(typeof raw === 'string' ? raw : Array.isArray(raw) ? raw : undefined) ?? ''
  const params = useSearchParams()
  const router = useRouter()
  const { orgId } = useActiveOrg()
  const me = useMe()
  const permissions = usePermissions()
  const isNew = isNewRuleId(id)
  const listQuery = useRules({ page: 1, pageSize: 100, enabled: undefined })
  const existing = isNew ? undefined : findRuleById(listQuery.data?.items, id)
  const baseDraft = isNew
    ? initialNewDraft({
        template: params.get('template'),
        projectId: parseOptionalIdParam(params.get('projectId') ?? undefined),
      })
    : existing
      ? ruleToDraft(existing)
      : null
  const [override, setOverride] = useState<CreateRuleInput | null>(null)
  const [enabledOverride, setEnabledOverride] = useState<boolean | null>(null)
  const [draftId, setDraftId] = useState(id)
  if (draftId !== id) {
    setDraftId(id)
    setOverride(null)
    setEnabledOverride(null)
  }
  const draft = override ?? baseDraft
  const enabled = enabledOverride ?? existing?.enabled ?? false
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const form = useZodForm(createRuleInput, {
    defaultValues: emptyDraftRule({ level: RuleScopeLevel.ORG }),
  })
  const projects = useProjects({ page: 1, pageSize: 100 })
  const attributes = useAttributes({ page: 1, pageSize: 100 })
  const projectId = draft?.scope.level === RuleScopeLevel.PROJECT ? draft.scope.projectId : ''
  const cards = useProjectCards(projectId ?? '', { page: 1, pageSize: 100 })
  const createRule = useCreateRule()
  const updateRule = useUpdateRule()
  const deleteRule = useDeleteRule()
  const enableRule = useEnableRule()
  const validateRule = useValidateRule()
  const simulateRules = useSimulateRules()
  const generation = useRef(0)
  const [validateErrors, setValidateErrors] = useState<{ path: string; message: string }[]>([])
  const [lastSimulate, setLastSimulate] = useState<SimulateRulesOutput | null>(null)
  const orgRole = activeOrgRole(me.data?.memberships ?? [], orgId ?? me.data?.activeOrg?.id ?? null)
  const allowed =
    me.isPending || permissions.isPending || holdsControlEdit(orgRole, permissions.data?.projects)

  function patch(next: Partial<CreateRuleInput>) {
    setOverride((prev) => {
      const current = prev ?? baseDraft
      if (current === null) return current
      return { ...current, ...next }
    })
  }

  function insertAttributeKey(key: string) {
    setOverride((prev) => {
      const current = prev ?? baseDraft
      if (current === null) return current
      const negated = current.when.not !== undefined
      const inner = negated ? current.when.not : current.when
      if (inner !== undefined && inner.expr !== undefined) {
        const nextInner = { expr: `${inner.expr}${key}` }
        return { ...current, when: negated ? { not: nextInner } : nextInner }
      }
      const then = current.then.map((action, index) => {
        if (index !== 0) return action
        const limits = action.params?.transactionLimits
        const first = limits?.limits[0]
        if (limits === undefined || first === undefined) return action
        return {
          ...action,
          params: {
            ...action.params,
            transactionLimits: {
              ...limits,
              limits: [{ ...first, amount: `${first.amount}${key}` }, ...limits.limits.slice(1)],
            },
          },
        }
      })
      return { ...current, then }
    })
  }

  const serializedDraft = draft === null ? '' : JSON.stringify(toCreateRuleInput(draft))
  useEffect(() => {
    if (draft === null || serializedDraft.length < 1) {
      return
    }
    const body = toCreateRuleInput(draft)
    const projectIdForSim =
      draft.scope.level === RuleScopeLevel.PROJECT ? draft.scope.projectId : undefined
    const timer = window.setTimeout(() => {
      const gen = ++generation.current
      validateRule.mutate(body, {
        onSuccess: (output) => {
          if (gen !== generation.current) return
          if (!output.ok) {
            setValidateErrors(output.errors)
            return
          }
          setValidateErrors([])
          simulateRules.mutate(
            { draftRule: body, projectId: projectIdForSim },
            {
              onSuccess: (sim) => {
                if (gen !== generation.current) return
                setLastSimulate(sim)
              },
            },
          )
        },
      })
    }, RULE_VALIDATE_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [draft, serializedDraft, simulateRules, validateRule])

  async function onSave() {
    if (draft === null) return
    setAlertMessage(null)
    const input = toCreateRuleInput(draft)
    try {
      if (isNew) {
        const created = await createRule.mutateAsync(input)
        router.replace(ruleBuilderHref(created.id))
        return
      }
      await updateRule.mutateAsync({
        id,
        input: {
          scope: input.scope,
          name: input.name,
          description: input.description,
          priority: input.priority,
          trigger: input.trigger,
          when: input.when,
          then: input.then,
          else: input.else,
        },
      })
    } catch (error) {
      if (isApiError(error) && error.code === ErrorCode.VALIDATION_FAILED) {
        applyServerErrorsFromApiError(form as unknown as UseFormReturn<FieldValues>, error)
        setAlertMessage(error.message)
        return
      }
      setAlertMessage(isApiError(error) ? error.message : 'Unable to save rule')
    }
  }

  if (!id) {
    return <ErrorState message={ruleNotFoundMessage()} />
  }

  if (!isNew && listQuery.isPending) {
    return <LoadingState />
  }

  if (!isNew && listQuery.error) {
    return (
      <ErrorState
        message={isApiError(listQuery.error) ? listQuery.error.message : 'Unable to load rules'}
      />
    )
  }

  if (!isNew && listQuery.data && existing === undefined) {
    return <ErrorState message={ruleNotFoundMessage()} />
  }

  if (draft === null) {
    return <LoadingState />
  }

  const canSave =
    triggerReady(draft.trigger) && draft.then.length >= 1 && draft.name.trim().length > 0
  const cardOptions = (cards.data?.items ?? []).map((card) => ({
    value: card.id,
    label: `${card.nickName} ${formatMaskedCard(card.maskedNumber)}`,
  }))
  const fieldErrors = Object.entries(form.formState.errors).flatMap(([path, error]) => {
    const message =
      error && typeof error === 'object' && 'message' in error ? String(error.message) : ''
    return message.length > 0 ? [`${path}: ${message}`] : []
  })

  return (
    <div className="flex min-w-0 flex-col gap-6 md:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {alertMessage ? (
          <Alert variant="destructive">
            <AlertDescription>
              <p>{alertMessage}</p>
              {fieldErrors.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="flex min-w-0 flex-col gap-1">
          <Label htmlFor="rule-name">Name</Label>
          <Input
            id="rule-name"
            maxLength={200}
            value={draft.name}
            onChange={(event) => patch({ name: event.target.value })}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <Label htmlFor="rule-description">Description</Label>
          <Textarea
            id="rule-description"
            maxLength={2000}
            value={draft.description ?? ''}
            onChange={(event) => patch({ description: event.target.value })}
          />
        </div>
        <RadioGroup
          className="flex flex-wrap gap-3"
          value={draft.scope.level}
          onValueChange={(level) => {
            if (level === RuleScopeLevel.ORG) {
              patch({ scope: { level: RuleScopeLevel.ORG } })
              return
            }
            const nextId =
              draft.scope.level === RuleScopeLevel.PROJECT
                ? draft.scope.projectId
                : (projects.data?.items[0]?.id ?? '')
            patch({ scope: { level: RuleScopeLevel.PROJECT, projectId: nextId } })
          }}
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value={RuleScopeLevel.ORG} id="scope-org" />
            <Label htmlFor="scope-org" className="font-normal">
              ORG
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value={RuleScopeLevel.PROJECT} id="scope-project" />
            <Label htmlFor="scope-project" className="font-normal">
              PROJECT
            </Label>
          </div>
        </RadioGroup>
        {draft.scope.level === RuleScopeLevel.PROJECT ? (
          <Select
            value={draft.scope.projectId}
            onValueChange={(projectIdValue) =>
              patch({ scope: { level: RuleScopeLevel.PROJECT, projectId: projectIdValue } })
            }
          >
            <SelectTrigger aria-label="Project" size="sm">
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              {(projects.data?.items ?? []).map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <div className="flex min-w-0 flex-col gap-1">
          <Label htmlFor="rule-priority">Priority</Label>
          <Input
            id="rule-priority"
            value={draft.priority === undefined ? '' : String(draft.priority)}
            onChange={(event) => patch({ priority: parseIntInput(event.target.value) })}
          />
        </div>
        <TriggerPicker value={draft.trigger} onChange={(trigger) => patch({ trigger })} />
        <ConditionBuilder
          value={draft.when}
          onChange={(when) => patch({ when })}
          attributeKeys={attributes.data?.items ?? []}
        />
        <ActionList
          then={draft.then}
          onThenChange={(then) => patch({ then })}
          elseActions={draft.else}
          onElseChange={(elseActions) => patch({ else: elseActions })}
          cardOptions={cardOptions}
          hasProjectScope={draft.scope.level === RuleScopeLevel.PROJECT}
        />
        <div className="flex flex-wrap gap-2">
          <PermissionGateView allowed={allowed} denialMessage={editControlsDenialMessage()}>
            <Button
              type="button"
              disabled={!canSave || !allowed}
              loading={createRule.isPending || updateRule.isPending}
              onClick={() => void onSave()}
            >
              Save rule
            </Button>
          </PermissionGateView>
          {!isNew ? (
            <>
              <PermissionGateView allowed={allowed} denialMessage={editControlsDenialMessage()}>
                <div className="flex items-center gap-2">
                  <Switch
                    id="rule-enabled"
                    aria-label="Enabled"
                    checked={enabled}
                    disabled={!allowed}
                    onCheckedChange={(next) => {
                      setEnabledOverride(next)
                      enableRule.mutate({ id, input: { enabled: next } })
                    }}
                  />
                  <Label htmlFor="rule-enabled" className="font-normal">
                    Enabled
                  </Label>
                </div>
              </PermissionGateView>
              <Link href={ruleSimulateHref(id)} className={buttonVariants({ variant: 'outline' })}>
                Simulate
              </Link>
              <PermissionGateView allowed={allowed} denialMessage={editControlsDenialMessage()}>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={!allowed}
                  onClick={() => setDeleteOpen(true)}
                >
                  Delete
                </Button>
              </PermissionGateView>
            </>
          ) : null}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-medium">Rule</h2>
        <RuleSentence
          rule={{ name: draft.name, when: draft.when, then: draft.then, else: draft.else }}
        />
        {validateErrors.length > 0 ? (
          <ul className="mt-3 flex min-w-0 flex-col gap-1 text-sm text-destructive">
            {validateErrors.map((error) => (
              <li key={`${error.path}:${error.message}`}>
                {error.path}: {error.message}
              </li>
            ))}
          </ul>
        ) : null}
        <MatchPreview output={lastSimulate} />
        <div className="mt-3 flex flex-wrap gap-2">
          {attributeOptions(attributes.data?.items ?? []).map((option) => (
            <Button
              key={option.value}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => insertAttributeKey(option.value)}
            >
              {option.value}
            </Button>
          ))}
        </div>
      </div>
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this rule?"
        description="Cards keep their last applied controls."
        confirmLabel="Delete"
        variant="destructive"
        loading={deleteRule.isPending}
        onConfirm={() => {
          setDeleteOpen(false)
          void deleteRule
            .mutateAsync({ id })
            .then(() => router.push(orgRulesHref()))
            .catch((error: unknown) => {
              setAlertMessage(isApiError(error) ? error.message : 'Unable to delete rule')
            })
        }}
      />
    </div>
  )
}

function MatchPreview({ output }: { output: SimulateRulesOutput | null }) {
  if (output === null) {
    return null
  }
  const stats = matchPreviewFromSimulate(output, DRAFT_RULE_ID)
  if (stats.sampleLimit === null) {
    return (
      <p className="mt-3 text-sm">
        {formatMatchPreview(stats, (money) => `${money.currency} ${money.amount}`)}
      </p>
    )
  }
  return (
    <p className="mt-3 text-sm">
      With today&apos;s values, this rule matches {stats.matchedCardCount} cards and would set the{' '}
      {stats.sampleLimit.interval} limit to{' '}
      <MoneyDisplay
        money={{ amount: stats.sampleLimit.amount, currency: stats.sampleLimit.currency }}
      />
      .
    </p>
  )
}
