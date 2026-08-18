'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { PlusIcon } from 'lucide-react'
import { isApiError } from '@/client/api/errors'
import { useProjects } from '@/client/hooks/useProjects'
import { useEnableRule, useRules } from '@/client/hooks/useRules'
import { useMe, usePermissions } from '@/client/hooks/useSession'
import { activeOrgRole } from '@/client/lib/projects'
import {
  editControlsDenialMessage,
  holdsControlEdit,
  newRuleHref,
  noOrgRulesEmpty,
  parseRuleListSearchParams,
  RULE_TEMPLATES,
  ruleBuilderHref,
  ruleListHref,
  type RuleTemplateKey,
} from '@/client/lib/rules'
import { useActiveOrg } from '@/client/providers/ActiveOrgProvider'
import { DataTable } from '@/components/patterns/DataTable'
import { EmptyState } from '@/components/patterns/EmptyState'
import { ErrorState } from '@/components/patterns/ErrorState'
import { PermissionGateView } from '@/components/patterns/PermissionGate'
import { RuleSentence } from '@/components/patterns/RuleSentence'
import type { DataTableColumn } from '@/components/patterns/types'
import { Button, buttonVariants } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { RuleScopeLevel } from '@/shared/enums/ruleScopeLevel'
import type { Rule } from '@/shared/types/rule'

const ALL = '__all__'
const TEMPLATE_KEYS: RuleTemplateKey[] = ['A', 'B', 'C', 'D', 'E']

function enabledSelectValue(enabled: boolean | undefined): string {
  if (enabled === true) return 'true'
  if (enabled === false) return 'false'
  return ALL
}

export function OrgRuleList() {
  const router = useRouter()
  const params = useSearchParams()
  const { orgId } = useActiveOrg()
  const me = useMe()
  const permissions = usePermissions()
  const filter = parseRuleListSearchParams({
    projectId: params.get('projectId') ?? undefined,
    enabled: params.get('enabled') ?? undefined,
    page: params.get('page') ?? undefined,
    pageSize: params.get('pageSize') ?? undefined,
  })
  const query = useRules(filter)
  const projects = useProjects({ page: 1, pageSize: 100 })
  const enableRule = useEnableRule()
  const orgRole = activeOrgRole(me.data?.memberships ?? [], orgId ?? me.data?.activeOrg?.id ?? null)
  const allowed =
    me.isPending || permissions.isPending || holdsControlEdit(orgRole, permissions.data?.projects)

  function pushFilter(next: typeof filter) {
    router.push(ruleListHref(next))
  }

  if (query.error) {
    return (
      <ErrorState
        message={isApiError(query.error) ? query.error.message : 'Unable to load rules'}
      />
    )
  }

  const projectNames = new Map((projects.data?.items ?? []).map((row) => [row.id, row.name]))
  const emptyCopy = noOrgRulesEmpty()

  const columns: DataTableColumn<Rule>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: (row) => (
        <div className="min-w-0">
          <Link href={ruleBuilderHref(row.id)} className="hover:underline">
            {row.name}
          </Link>
          <RuleSentence rule={{ when: row.when, then: row.then, else: row.else }} />
        </div>
      ),
    },
    {
      id: 'scope',
      header: 'Scope',
      cell: (row) =>
        row.scope.level === RuleScopeLevel.ORG
          ? 'ORG'
          : (projectNames.get(row.scope.projectId ?? '') ?? row.scope.projectId ?? 'PROJECT'),
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
        <PermissionGateView allowed={allowed} denialMessage={editControlsDenialMessage()}>
          <Switch
            aria-label="Enabled"
            checked={row.enabled}
            disabled={!allowed}
            onCheckedChange={(enabled) => enableRule.mutate({ id: row.id, input: { enabled } })}
          />
        </PermissionGateView>
      ),
    },
  ]

  const templateLinks = (
    <div className="flex flex-wrap gap-2">
      {TEMPLATE_KEYS.map((key) => (
        <Link key={key} href={newRuleHref(key)} className={buttonVariants({ variant: 'outline' })}>
          Use template {key} {RULE_TEMPLATES[key].name}
        </Link>
      ))}
    </div>
  )

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Project</Label>
          <Select
            value={filter.projectId ?? ALL}
            onValueChange={(value) =>
              pushFilter({
                ...filter,
                projectId: value === ALL ? undefined : value,
                page: 1,
              })
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
          <Label className="text-xs text-muted-foreground">Enabled</Label>
          <Select
            value={enabledSelectValue(filter.enabled)}
            onValueChange={(value) =>
              pushFilter({
                ...filter,
                enabled: value === ALL ? undefined : value === 'true',
                page: 1,
              })
            }
          >
            <SelectTrigger aria-label="Enabled" size="sm">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              <SelectItem value="true">Enabled</SelectItem>
              <SelectItem value="false">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <PermissionGateView allowed={allowed} denialMessage={editControlsDenialMessage()}>
          {allowed ? (
            <Button asChild>
              <Link href={newRuleHref()}>
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
      </div>
      {!query.isPending && query.data?.total === 0 ? (
        <>
          <EmptyState title={emptyCopy.title} description={emptyCopy.description} />
          {templateLinks}
        </>
      ) : (
        <DataTable
          columns={columns}
          rows={query.data?.items ?? []}
          getRowId={(row) => row.id}
          pagination={{
            mode: 'page',
            page: query.data?.page ?? filter.page,
            pageSize: query.data?.pageSize ?? filter.pageSize,
            total: query.data?.total ?? 0,
            onPageChange: (page) => pushFilter({ ...filter, page }),
          }}
          loading={query.isPending}
          empty={emptyCopy}
        />
      )}
    </div>
  )
}
