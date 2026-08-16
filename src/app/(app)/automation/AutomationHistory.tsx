'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { isApiError } from '@/client/api/errors'
import { useProjects } from '@/client/hooks/useProjects'
import { useRuleRun, useRuleRuns, useRules } from '@/client/hooks/useRules'
import {
  automationListHref,
  cardDiffToDiffView,
  flattenRunPages,
  isProminentRunStatus,
  parseRuleRunSearchParams,
  ruleBuilderHref,
} from '@/client/lib/rules'
import { AttributeValue } from '@/components/patterns/AttributeValue'
import { DataTable } from '@/components/patterns/DataTable'
import { DiffView } from '@/components/patterns/DiffView'
import { ErrorState } from '@/components/patterns/ErrorState'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import type { DataTableColumn } from '@/components/patterns/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatDate } from '@/lib/dates'
import { RuleRunStatus } from '@/shared/enums/ruleRunStatus'
import type { RuleRun } from '@/shared/types/ruleRun'

const ALL = '__all__'

export function AutomationHistory() {
  const router = useRouter()
  const params = useSearchParams()
  const filter = parseRuleRunSearchParams({
    ruleId: params.get('ruleId') ?? undefined,
    cardId: params.get('cardId') ?? undefined,
    projectId: params.get('projectId') ?? undefined,
    status: params.get('status') ?? undefined,
    page: params.get('page') ?? undefined,
    pageSize: params.get('pageSize') ?? undefined,
  })
  const query = useRuleRuns(filter)
  const rules = useRules({ page: 1, pageSize: 100, enabled: undefined })
  const projects = useProjects({ page: 1, pageSize: 100 })
  const [openId, setOpenId] = useState<string | null>(null)
  const rows = flattenRunPages(query.data?.pages) as RuleRun[]
  const ruleNames = new Map((rules.data?.items ?? []).map((row) => [row.id, row.name]))

  function pushFilter(next: typeof filter) {
    router.push(automationListHref(next))
  }

  if (query.error) {
    return (
      <ErrorState
        message={isApiError(query.error) ? query.error.message : 'Unable to load rule runs'}
      />
    )
  }

  const columns: DataTableColumn<RuleRun>[] = [
    {
      id: 'startedAt',
      header: 'Started',
      cell: (row) => (
        <Button
          type="button"
          variant="link"
          className="h-auto p-0"
          onClick={() => setOpenId(row.id)}
        >
          {formatDate(row.startedAt)}
        </Button>
      ),
    },
    {
      id: 'rule',
      header: 'Rule',
      cell: (row) => (
        <Link href={ruleBuilderHref(row.ruleId)} className="hover:underline">
          {ruleNames.get(row.ruleId) ?? row.ruleId}
        </Link>
      ),
    },
    {
      id: 'triggerEvent',
      header: 'Trigger',
      cell: (row) => row.triggerEvent,
    },
    {
      id: 'matched',
      header: 'Matched',
      cell: (row) => (row.matched ? 'Yes' : 'No'),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <StatusBadge kind="ruleRun" status={row.status} />,
    },
    {
      id: 'durationMs',
      header: 'Duration',
      cell: (row) => `${row.durationMs} ms`,
    },
    {
      id: 'conflicts',
      header: 'Conflicts',
      cell: (row) => {
        if (!isProminentRunStatus(row.status)) return ''
        const message = row.failureReason ?? row.skipReason ?? row.conflicts[0]?.message ?? ''
        return (
          <span title={message} className="min-w-0 break-all">
            {message}
          </span>
        )
      },
    },
  ]

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Rule</Label>
          <Select
            value={filter.ruleId ?? ALL}
            onValueChange={(value) =>
              pushFilter({ ...filter, ruleId: value === ALL ? undefined : value, page: 1 })
            }
          >
            <SelectTrigger aria-label="Rule" size="sm">
              <SelectValue placeholder="All rules" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              {(rules.data?.items ?? []).map((rule) => (
                <SelectItem key={rule.id} value={rule.id}>
                  {rule.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Project</Label>
          <Select
            value={filter.projectId ?? ALL}
            onValueChange={(value) =>
              pushFilter({ ...filter, projectId: value === ALL ? undefined : value, page: 1 })
            }
          >
            <SelectTrigger aria-label="Project" size="sm">
              <SelectValue placeholder="All projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              {(projects.data?.items ?? []).map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <Label htmlFor="automation-card" className="text-xs text-muted-foreground">
            Card
          </Label>
          <Input
            id="automation-card"
            value={filter.cardId ?? ''}
            onChange={(event) =>
              pushFilter({
                ...filter,
                cardId: event.target.value.length > 0 ? event.target.value : undefined,
                page: 1,
              })
            }
            placeholder="Card id"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select
            value={filter.status ?? ALL}
            onValueChange={(value) =>
              pushFilter({
                ...filter,
                status: value === ALL ? undefined : (value as RuleRunStatus),
                page: 1,
              })
            }
          >
            <SelectTrigger aria-label="Status" size="sm">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              {Object.values(RuleRunStatus).map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        pagination={{
          mode: 'cursor',
          nextCursor: query.hasNextPage ? 'next' : null,
          onLoadMore: () => {
            void query.fetchNextPage()
          },
          isFetchingMore: query.isFetchingNextPage,
        }}
        loading={query.isPending}
        empty={{
          title: 'No rule runs yet',
          description: 'When a rule evaluates, the run appears here.',
        }}
      />
      <RunDetailSheet id={openId} onOpenChange={(open) => !open && setOpenId(null)} />
    </div>
  )
}

function RunDetailSheet({
  id,
  onOpenChange,
}: {
  id: string | null
  onOpenChange: (open: boolean) => void
}) {
  const detail = useRuleRun(id ?? '')
  const run = detail.data

  return (
    <Sheet open={id !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="min-w-0 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Rule run</SheetTitle>
        </SheetHeader>
        <div className="flex min-w-0 flex-col gap-4">
          {run && isProminentRunStatus(run.status) ? (
            <Alert variant="destructive">
              <AlertDescription>
                {run.failureReason ?? run.skipReason ?? run.conflicts[0]?.message ?? run.status}
              </AlertDescription>
            </Alert>
          ) : null}
          {run ? (
            <>
              <p className="text-sm">matched: {run.matched ? 'Yes' : 'No'}</p>
              {run.skipReason ? <p className="text-sm">{run.skipReason}</p> : null}
              {run.failureReason ? <p className="text-sm">{run.failureReason}</p> : null}
              {run.inputs.map((input) => (
                <AttributeValue
                  key={`${input.key}-${input.subjectId}`}
                  value={input.value}
                  observedAt={input.observedAt}
                  ttlSec={input.ttlSec}
                  label={`${input.subjectType} ${input.subjectId}`}
                />
              ))}
              {run.diff.cards.map((diff) => (
                <DiffView key={diff.cardId} {...cardDiffToDiffView(diff)} />
              ))}
              {run.actions.map((action, index) => (
                <p key={`${action.action}-${index}`} className="text-sm">
                  {action.action} {action.status}
                  {action.message ? ` — ${action.message}` : ''}
                </p>
              ))}
              {run.conflicts.map((conflict) => (
                <p key={conflict.message} className="text-sm">
                  {conflict.message}
                </p>
              ))}
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
