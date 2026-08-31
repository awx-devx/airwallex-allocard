'use client'

import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { PlusIcon } from 'lucide-react'
import { isApiError } from '@/client/api/errors'
import { useProject } from '@/client/hooks/useProjects'
import { useEnableRule, useRules } from '@/client/hooks/useRules'
import { permissionGateAllowed } from '@/client/lib/access'
import { useCan } from '@/client/lib/permissions/useCan'
import { isProjectArchived } from '@/client/lib/reports'
import {
  editControlsDenialMessage,
  newProjectRuleHref,
  noProjectRulesEmpty,
  orgWideRules,
  parseOptionalIdParam,
  parseProjectControlsSearchParams,
  projectControlsHref,
  RULE_TEMPLATES,
  ruleBuilderHref,
  USABLE_TEMPLATE_KEYS,
} from '@/client/lib/rules'
import { ApprovalRuleEditor } from '@/app/(app)/projects/[id]/controls/ApprovalRuleEditor'
import { DataTable } from '@/components/patterns/DataTable'
import { EmptyState } from '@/components/patterns/EmptyState'
import { ErrorState } from '@/components/patterns/ErrorState'
import { FilterBar, FilterSelect } from '@/components/patterns/FilterSelect'
import { LoadingState } from '@/components/patterns/LoadingState'
import { PermissionGateView } from '@/components/patterns/PermissionGate'
import { RuleSentence } from '@/components/patterns/RuleSentence'
import type { DataTableColumn } from '@/components/patterns/types'
import { PageFill } from '@/components/patterns/PageBody'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { SelectItem } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ErrorCode } from '@/shared/enums/errors'
import { Permission } from '@/shared/enums/permissions'
import type { Rule } from '@/shared/types/rule'

const ALL = '__all__'

function enabledSelectValue(enabled: boolean | undefined): string {
  if (enabled === true) return 'true'
  if (enabled === false) return 'false'
  return ALL
}

export function ProjectControls() {
  const raw = useParams().id
  const id =
    parseOptionalIdParam(typeof raw === 'string' ? raw : Array.isArray(raw) ? raw : undefined) ?? ''
  const router = useRouter()
  const params = useSearchParams()
  const filter = parseProjectControlsSearchParams({
    enabled: params.get('enabled') ?? undefined,
    page: params.get('page') ?? undefined,
    pageSize: params.get('pageSize') ?? undefined,
    ruleId: params.get('ruleId') ?? undefined,
  })
  const { ruleId, ...listFilter } = filter
  const query = useRules({ ...listFilter, projectId: id })
  const orgQuery = useRules({ page: 1, pageSize: 100, enabled: undefined })
  const enableRule = useEnableRule()
  const project = useProject(id)
  const { can, isLoading } = useCan(id)
  const archived = isProjectArchived(project.data?.status ?? '')
  const canEdit = permissionGateAllowed(can(Permission.CONTROL_EDIT), isLoading)

  function pushFilter(next: {
    enabled?: boolean
    page?: number
    pageSize?: number
    ruleId?: string
  }) {
    router.push(projectControlsHref(id, next))
  }

  if (!id) {
    return <ErrorState message="This project is not available." />
  }

  if (query.isPending) {
    return <LoadingState />
  }

  if (query.error) {
    if (isApiError(query.error) && query.error.code === ErrorCode.NOT_FOUND) {
      return <ErrorState message="This project is not available." />
    }
    return (
      <ErrorState
        message={isApiError(query.error) ? query.error.message : 'Unable to load rules'}
      />
    )
  }

  const items = query.data.items
  const highlighted = ruleId !== undefined ? items.find((row) => row.id === ruleId) : undefined
  const orgItems = orgQuery.error ? [] : orgWideRules(orgQuery.data?.items ?? [])
  const emptyCopy = noProjectRulesEmpty()

  const columns: DataTableColumn<Rule>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: (row) => (
        <div
          data-rule-id={row.id}
          className={`min-w-0 ${ruleId === row.id ? 'rounded-sm ring-2 ring-ring' : ''}`}
        >
          <Link href={ruleBuilderHref(row.id)} className="hover:underline">
            {row.name}
          </Link>
          <RuleSentence rule={{ when: row.when, then: row.then, else: row.else }} />
        </div>
      ),
    },
    {
      id: 'priority',
      header: 'Priority',
      cell: (row) => String(row.priority),
    },
    {
      id: 'enabled',
      header: 'Enabled',
      cell: (row) => (
        <PermissionGateView allowed={canEdit} denialMessage={editControlsDenialMessage()}>
          <Switch
            aria-label="Enabled"
            checked={row.enabled}
            disabled={!canEdit || archived}
            onCheckedChange={(enabled) => enableRule.mutate({ id: row.id, input: { enabled } })}
          />
        </PermissionGateView>
      ),
    },
  ]

  const toolbar = (
    <FilterBar>
      <FilterSelect
        label="Enabled"
        value={enabledSelectValue(filter.enabled)}
        onValueChange={(value) =>
          pushFilter({
            enabled: value === ALL ? undefined : value === 'true',
            page: 1,
            pageSize: filter.pageSize,
            ruleId,
          })
        }
        allLabel="All states"
      >
        <SelectItem value="true">Enabled</SelectItem>
        <SelectItem value="false">Disabled</SelectItem>
      </FilterSelect>
      {archived ? null : (
        <PermissionGateView allowed={canEdit} denialMessage={editControlsDenialMessage()}>
          {canEdit ? (
            <Button asChild>
              <Link href={newProjectRuleHref(id)}>
                <PlusIcon className="size-4 shrink-0" aria-hidden />
                New
              </Link>
            </Button>
          ) : (
            <Button type="button" disabled>
              <PlusIcon className="size-4 shrink-0" aria-hidden />
              New
            </Button>
          )}
        </PermissionGateView>
      )}
    </FilterBar>
  )

  const templateLinks = (
    <div className="flex flex-wrap gap-2">
      {USABLE_TEMPLATE_KEYS.map((key) => (
        <Link
          key={key}
          href={newProjectRuleHref(id, key)}
          className={buttonVariants({ variant: 'outline' })}
        >
          Use template {key} {RULE_TEMPLATES[key].name}
        </Link>
      ))}
    </div>
  )

  const orgWideSection =
    orgItems.length > 0 ? (
      <section className="flex min-w-0 flex-col gap-2">
        <h2 className="text-sm font-medium">Org-wide rules that also apply</h2>
        <ul className="flex min-w-0 flex-col gap-1">
          {orgItems.map((row) => (
            <li key={row.id} className="min-w-0">
              <Link href={ruleBuilderHref(row.id)} className="hover:underline">
                {row.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    ) : null

  return (
    <PageFill>
      {highlighted ? (
        <Alert>
          <AlertDescription className="flex min-w-0 flex-wrap items-center gap-2">
            <span>This card was created by this rule.</span>
            {archived ? null : (
              <Link href={ruleBuilderHref(highlighted.id)} className="hover:underline">
                Edit in builder
              </Link>
            )}
          </AlertDescription>
        </Alert>
      ) : null}
      {toolbar}
      {query.data.total === 0 ? (
        <>
          <EmptyState title={emptyCopy.title} description={emptyCopy.description} />
          {archived ? null : templateLinks}
        </>
      ) : (
        <DataTable
          columns={columns}
          rows={items}
          getRowId={(row) => row.id}
          pagination={{
            mode: 'page',
            page: query.data.page,
            pageSize: query.data.pageSize,
            total: query.data.total,
            onPageChange: (page) =>
              pushFilter({
                enabled: filter.enabled,
                page,
                pageSize: filter.pageSize,
                ruleId,
              }),
          }}
          empty={emptyCopy}
        />
      )}
      {orgWideSection}
      <section className="flex min-w-0 flex-col gap-3">
        <h2 className="text-sm font-medium">Approval rules</h2>
        <ApprovalRuleEditor projectId={id} />
      </section>
    </PageFill>
  )
}
