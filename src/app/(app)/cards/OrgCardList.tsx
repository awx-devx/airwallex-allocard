'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { isApiError } from '@/client/api/errors'
import { useCardholders, useCards } from '@/client/hooks/useCards'
import { useProjects } from '@/client/hooks/useProjects'
import {
  cardHref,
  cardListHref,
  holderLabel,
  parseCardListSearchParams,
  projectCardsHref,
} from '@/client/lib/cards'
import { DataTable } from '@/components/patterns/DataTable'
import { ErrorState } from '@/components/patterns/ErrorState'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import type { DataTableColumn } from '@/components/patterns/types'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatMaskedCard } from '@/lib/format/cardNumber'
import { CardPurpose } from '@/shared/enums/cardPurpose'
import { CardStatus } from '@/shared/enums/cardStatus'
import type { Card } from '@/shared/types/card'

const ALL = '__all__'

export function OrgCardList() {
  const router = useRouter()
  const params = useSearchParams()
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

  const projectNames = new Map((projects.data?.items ?? []).map((row) => [row.id, row.name]))
  const holdersById = new Map((cardholders.data?.items ?? []).map((row) => [row.id, row]))

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
        return holderLabel(holder, undefined)
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
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap gap-2">
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
        <Select
          value={filter.status ?? ALL}
          onValueChange={(value) =>
            pushFilter({
              ...filter,
              status: value === ALL ? undefined : (value as CardStatus),
              page: 1,
            })
          }
        >
          <SelectTrigger aria-label="Status" size="sm">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All</SelectItem>
            {Object.values(CardStatus).map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filter.purpose ?? ALL}
          onValueChange={(value) =>
            pushFilter({
              ...filter,
              purpose: value === ALL ? undefined : (value as CardPurpose),
              page: 1,
            })
          }
        >
          <SelectTrigger aria-label="Purpose" size="sm">
            <SelectValue placeholder="All purposes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All</SelectItem>
            {Object.values(CardPurpose).map((purpose) => (
              <SelectItem key={purpose} value={purpose}>
                {purpose}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
    </div>
  )
}
