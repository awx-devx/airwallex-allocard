'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { isApiError } from '@/client/api/errors'
import { useProjectCards } from '@/client/hooks/useCards'
import { useAttributes, useRules, useSimulateRules } from '@/client/hooks/useRules'
import { useMe, usePermissions } from '@/client/hooks/useSession'
import { activeOrgRole } from '@/client/lib/projects'
import {
  attributeOptions,
  cardDiffToDiffView,
  editControlsDenialMessage,
  findRuleById,
  holdsControlEdit,
  isNewRuleId,
  noSimulateChangesEmpty,
  parseConditionValue,
  parseOptionalIdParam,
  partialRunHeading,
  ruleBuilderHref,
  ruleNotFoundMessage,
  simulationHypotheticalMessage,
} from '@/client/lib/rules'
import { useActiveOrg } from '@/client/providers/ActiveOrgProvider'
import { DiffView } from '@/components/patterns/DiffView'
import { EmptyState } from '@/components/patterns/EmptyState'
import { ErrorState } from '@/components/patterns/ErrorState'
import { LoadingState } from '@/components/patterns/LoadingState'
import { PermissionGateView } from '@/components/patterns/PermissionGate'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import { PageFlow } from '@/components/patterns/PageBody'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { AttributeSubjectType } from '@/shared/enums/attributeSubjectType'
import type {
  AttributeOverride,
  CardControlsDiff,
  SimulateRulesOutput,
} from '@/shared/types/ruleRun'

type OverrideDraft = {
  key: string
  subjectType: AttributeSubjectType
  subjectId: string
  valueRaw: string
}

const EMPTY_OVERRIDE: OverrideDraft = {
  key: '',
  subjectType: AttributeSubjectType.PROJECT,
  subjectId: '',
  valueRaw: '',
}

export function SimulateRule() {
  const raw = useParams().id
  const id =
    parseOptionalIdParam(typeof raw === 'string' ? raw : Array.isArray(raw) ? raw : undefined) ?? ''
  const { orgId } = useActiveOrg()
  const me = useMe()
  const permissions = usePermissions()
  const listQuery = useRules({ page: 1, pageSize: 100, enabled: undefined })
  const attributes = useAttributes({ page: 1, pageSize: 100 })
  const simulate = useSimulateRules()
  const [overrides, setOverrides] = useState<OverrideDraft[]>([])
  const [result, setResult] = useState<SimulateRulesOutput | null>(null)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const rule = findRuleById(listQuery.data?.items, id)
  const cards = useProjectCards(rule?.scope.projectId ?? '', { page: 1, pageSize: 100 })
  const orgRole = activeOrgRole(me.data?.memberships ?? [], orgId ?? me.data?.activeOrg?.id ?? null)
  const allowed =
    me.isPending || permissions.isPending || holdsControlEdit(orgRole, permissions.data?.projects)

  if (isNewRuleId(id)) {
    return <ErrorState message="Save the rule before opening simulation." />
  }

  if (listQuery.isPending) {
    return <LoadingState />
  }

  if (listQuery.error) {
    return (
      <ErrorState
        message={isApiError(listQuery.error) ? listQuery.error.message : 'Unable to load rules'}
      />
    )
  }

  if (rule === undefined) {
    return <ErrorState message={ruleNotFoundMessage()} />
  }

  const loaded = rule
  const nickNames = new Map((cards.data?.items ?? []).map((card) => [card.id, card.nickName]))
  const emptyCopy = noSimulateChangesEmpty()
  const options = attributeOptions(attributes.data?.items ?? [])

  function onRun() {
    setAlertMessage(null)
    const attributeOverrides: AttributeOverride[] = overrides
      .filter((row) => row.key.length > 0 && row.subjectId.length > 0)
      .map((row) => ({
        key: row.key,
        subjectType: row.subjectType,
        subjectId: row.subjectId,
        value: parseConditionValue(row.valueRaw),
      }))
    simulate.mutate(
      {
        ruleIds: [id],
        projectId: loaded.scope.projectId,
        attributeOverrides: attributeOverrides.length > 0 ? attributeOverrides : undefined,
      },
      {
        onSuccess: (output) => setResult(output),
        onError: (error) => {
          setAlertMessage(isApiError(error) ? error.message : 'Unable to run simulation')
        },
      },
    )
  }

  return (
    <PageFlow>
      <Link
        href={ruleBuilderHref(id)}
        className={cn(buttonVariants({ variant: 'outline' }), 'w-fit')}
      >
        Back
      </Link>
      <Alert>
        <AlertDescription>{simulationHypotheticalMessage()}</AlertDescription>
      </Alert>
      {alertMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{alertMessage}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex min-w-0 flex-col gap-3">
        <p className="text-sm text-muted-foreground">These overrides are temporary.</p>
        {overrides.map((row, index) => (
          <div key={index} className="flex min-w-0 flex-col gap-2">
            <Combobox
              options={options}
              value={row.key || null}
              onChange={(key) =>
                setOverrides((prev) =>
                  prev.map((item, i) => (i === index ? { ...item, key: key ?? '' } : item)),
                )
              }
              placeholder="Attribute"
            />
            <Select
              value={row.subjectType}
              onValueChange={(value) =>
                setOverrides((prev) =>
                  prev.map((item, i) =>
                    i === index ? { ...item, subjectType: value as AttributeSubjectType } : item,
                  ),
                )
              }
            >
              <SelectTrigger aria-label="Subject type" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(AttributeSubjectType).map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={row.subjectId}
              onChange={(event) =>
                setOverrides((prev) =>
                  prev.map((item, i) =>
                    i === index ? { ...item, subjectId: event.target.value } : item,
                  ),
                )
              }
              placeholder="Subject id"
            />
            <Input
              value={row.valueRaw}
              onChange={(event) =>
                setOverrides((prev) =>
                  prev.map((item, i) =>
                    i === index ? { ...item, valueRaw: event.target.value } : item,
                  ),
                )
              }
              placeholder="Value"
            />
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => setOverrides((prev) => [...prev, EMPTY_OVERRIDE])}
        >
          Add override
        </Button>
      </div>
      <PermissionGateView allowed={allowed} denialMessage={editControlsDenialMessage()}>
        <Button
          type="button"
          className="w-fit"
          disabled={!allowed}
          loading={simulate.isPending}
          onClick={onRun}
        >
          Run simulation
        </Button>
      </PermissionGateView>
      {result ? (
        <SimulateResults result={result} nickNames={nickNames} emptyCopy={emptyCopy} />
      ) : null}
    </PageFlow>
  )
}

function SimulateResults({
  result,
  nickNames,
  emptyCopy,
}: {
  result: SimulateRulesOutput
  nickNames: Map<string, string>
  emptyCopy: { title: string; description: string }
}) {
  return (
    <PageFlow>
      {result.conflicts.length > 0 ? (
        <Alert variant="destructive">
          <AlertDescription>
            <p>{partialRunHeading()}</p>
            {result.conflicts.map((conflict) => (
              <p key={conflict.message}>{conflict.message}</p>
            ))}
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {result.runs.map((run) => (
          <div key={run.id} className="min-w-0">
            <StatusBadge kind="ruleRun" status={run.status} />
            <p className="text-sm">matched: {run.matched ? 'Yes' : 'No'}</p>
            <p className="text-sm">{run.durationMs} ms</p>
          </div>
        ))}
      </div>
      {result.cardDiffs.length === 0 ? (
        <EmptyState title={emptyCopy.title} description={emptyCopy.description} />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {result.cardDiffs.map((diff) => (
            <CardDiffSection
              key={diff.cardId}
              diff={diff}
              label={nickNames.get(diff.cardId) ?? diff.cardId}
            />
          ))}
        </div>
      )}
    </PageFlow>
  )
}

function CardDiffSection({ diff, label }: { diff: CardControlsDiff; label: string }) {
  const view = cardDiffToDiffView(diff)
  return (
    <section className="min-w-0">
      <h2 className="text-sm font-medium">{label}</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="min-w-0">
          <h3 className="text-sm text-muted-foreground">Current</h3>
          <DiffView before={view.before} after={null} />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm text-muted-foreground">Simulated</h3>
          <DiffView before={null} after={view.after} />
        </div>
      </div>
    </section>
  )
}
