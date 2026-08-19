'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { isApiError } from '@/client/api/errors'
import { useCardholders, useCards } from '@/client/hooks/useCards'
import { useOrgMembers } from '@/client/hooks/useOrganizations'
import { useProjects } from '@/client/hooks/useProjects'
import {
  cardHref,
  cardListHref,
  holderLabel,
  memberNameByUserId,
  parseCardListSearchParams,
  projectCardsHref,
} from '@/client/lib/cards'
import { useActiveOrg } from '@/client/providers/ActiveOrgProvider'
import { DataTable } from '@/components/patterns/DataTable'
import { ErrorState } from '@/components/patterns/ErrorState'
import { FilterSelect } from '@/components/patterns/FilterSelect'
import { PageFill } from '@/components/patterns/PageBody'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import type { DataTableColumn } from '@/components/patterns/types'
import { Badge } from '@/components/ui/badge'
import { SelectItem } from '@/components/ui/select'
import { formatMaskedCard } from '@/lib/format/cardNumber'
import { CardPurpose } from '@/shared/enums/cardPurpose'
import { CardStatus } from '@/shared/enums/cardStatus'
import type { Card } from '@/shared/types/card'

const ALL = '__all__'

export function OrgCardList() {
  const router = useRouter()
  const params = useSearchParams()
  const { orgId } = useActiveOrg()
  const filter = parseCardListSearchParams({
    projectId: params.get('projectId') ?? undefined,
    status: params.get('status') ?? undefined,
    purpose: params.get('purpose') ?? undefined,
    page: params.get('page') ?? undefined,
    pageSize: params.get('pageSize') ?? undefined,
  })
  const query = useCards(filter)
  const projects = useProjects({ page: 1, pageSize: 100 })
  const cardholders = useCardholders({ page: 1, pageSize: 100 })
  const members = useOrgMembers(orgId ?? '')

  const projectNames = new Map((projects.data?.items ?? []).map((row) => [row.id, row.name]))
  const holdersById = new Map((cardholders.data?.items ?? []).map((row) => [row.id, row]))
  const orgMembers = members.data ?? []

  function pushFilter(next: typeof filter) {
    router.push(cardListHref(next))
  }

  const columns: DataTableColumn<Card>[] = [
    {
      id: 'nickName',
      header: 'Nickname',
      cell: (row) => (
        <Link href={cardHref(row.id)} className="hover:underline">
          {row.nickName}
        </Link>
      ),
    },
    {
      id: 'maskedNumber',
      header: 'Number',
      cell: (row) => formatMaskedCard(row.maskedNumber),
    },
    {
      id: 'purpose',
      header: 'Purpose',
      cell: (row) => <Badge variant="outline">{row.purpose}</Badge>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <StatusBadge kind="card" status={row.status} />,
    },
    {
      id: 'project',
      header: 'Project',
      cell: (row) =>
        row.projectId ? (
          <Link href={projectCardsHref(row.projectId)} className="hover:underline">
            {projectNames.get(row.projectId) ?? row.projectId}
          </Link>
        ) : (
          '—'
        ),
    },
    {
      id: 'holder',
      header: 'Holder',
      cell: (row) => {
        const holder = holdersById.get(row.cardholderId)
        if (holder === undefined) {
          return row.cardholderId
        }
        return holderLabel(holder, memberNameByUserId(holder.userId, orgMembers))
      },
    },
    {
      id: 'source',
      header: 'Source',
      cell: (row) => (row.managedByRuleIds.length > 0 ? 'Created by rule' : '—'),
    },
  ]

  if (query.error) {
    return (
      <ErrorState
        message={isApiError(query.error) ? query.error.message : 'Unable to load cards'}
      />
    )
  }

  return (
    <PageFill>
      <div className="flex shrink-0 flex-wrap gap-3">
        <FilterSelect
          label="Project"
          value={filter.projectId ?? ALL}
          onValueChange={(value) =>
            pushFilter({
              ...filter,
              projectId: value === ALL ? undefined : value,
              page: 1,
            })
          }
          allLabel="All projects"
        >
          {(projects.data?.items ?? []).map((project) => (
            <SelectItem key={project.id} value={project.id}>
              {project.name}
            </SelectItem>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Status"
          value={filter.status ?? ALL}
          onValueChange={(value) =>
            pushFilter({
              ...filter,
              status: value === ALL ? undefined : (value as CardStatus),
              page: 1,
            })
          }
          allLabel="All statuses"
        >
          {Object.values(CardStatus).map((status) => (
            <SelectItem key={status} value={status}>
              {status}
            </SelectItem>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Purpose"
          value={filter.purpose ?? ALL}
          onValueChange={(value) =>
            pushFilter({
              ...filter,
              purpose: value === ALL ? undefined : (value as CardPurpose),
              page: 1,
            })
          }
          allLabel="All purposes"
        >
          {Object.values(CardPurpose).map((purpose) => (
            <SelectItem key={purpose} value={purpose}>
              {purpose}
            </SelectItem>
          ))}
        </FilterSelect>
      </div>
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
        empty={{
          title: 'No cards yet',
          description: 'Cards are issued by rules when a project launches.',
        }}
      />
    </PageFill>
  )
}
