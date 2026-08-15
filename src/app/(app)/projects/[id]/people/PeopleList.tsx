'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { isApiError } from '@/client/api/errors'
import { useCardholders, useProjectCards } from '@/client/hooks/useCards'
import { useAccessHistory, useProjectMembers } from '@/client/hooks/useMembers'
import { useCan } from '@/client/lib/permissions/useCan'
import {
  addMemberDenialMessage,
  addMemberHref,
  memberAccessState,
  memberHasCards,
  SCOPE_LEVEL_LABELS,
  toAccessHistoryTimelineItem,
} from '@/client/lib/access'
import { DataTable } from '@/components/patterns/DataTable'
import { ErrorState } from '@/components/patterns/ErrorState'
import { PermissionGateView } from '@/components/patterns/PermissionGate'
import { Timeline } from '@/components/patterns/Timeline'
import type { DataTableColumn } from '@/components/patterns/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Permission } from '@/shared/enums/permissions'
import type { ProjectMemberDetail } from '@/shared/types/projectMember'

function AddMemberControl({ projectId }: { projectId: string }) {
  const { can } = useCan(projectId)
  const allowed = can(Permission.MEMBER_MANAGE)
  return (
    <PermissionGateView allowed={allowed} denialMessage={addMemberDenialMessage()}>
      {allowed ? (
        <Button asChild>
          <Link href={addMemberHref(projectId)}>Add member</Link>
        </Button>
      ) : (
        <Button type="button" disabled>
          Add member
        </Button>
      )}
    </PermissionGateView>
  )
}

export function PeopleList() {
  const raw = useParams().id
  const id = typeof raw === 'string' ? raw : Array.isArray(raw) ? (raw[0] ?? '') : ''
  const router = useRouter()
  const members = useProjectMembers(id)
  const cards = useProjectCards(id, { page: 1, pageSize: 100 })
  const cardholders = useCardholders({ page: 1, pageSize: 100 })
  const history = useAccessHistory(id)
  const { can } = useCan(id)
  const now = new Date()

  if (!id) {
    return <ErrorState message="This project is not available." />
  }

  const canManage = can(Permission.MEMBER_MANAGE)
  const cardItems = cards.data?.items ?? []
  const holderItems = cardholders.data?.items ?? []
  const historyItems = (history.data ?? []).map(toAccessHistoryTimelineItem)

  const columns: DataTableColumn<ProjectMemberDetail>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: (row) => (
        <div className="flex min-w-0 flex-col">
          <span className="min-w-0 break-all">{row.user.name}</span>
          <span className="text-sm text-muted-foreground">{row.user.email}</span>
        </div>
      ),
    },
    {
      id: 'role',
      header: 'Role',
      cell: (row) => (
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <span>{row.role.name}</span>
          {row.role.isTemplate ? <Badge>Template</Badge> : null}
        </span>
      ),
    },
    {
      id: 'scope',
      header: 'Scope',
      cell: (row) => SCOPE_LEVEL_LABELS[row.scope.level],
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => {
        const state = memberAccessState(row, now)
        if (state.kind === 'active') {
          return 'Active'
        }
        return (
          <span className="text-muted-foreground">
            Inactive{state.reason ? ` — ${state.reason}` : ''}
          </span>
        )
      },
    },
    {
      id: 'cards',
      header: 'Cards',
      cell: (row) =>
        memberHasCards(row.userId, cardItems, holderItems) ? (
          ''
        ) : (
          <Link href={`/projects/${id}/cards`} className="hover:underline">
            No cards yet
          </Link>
        ),
    },
    // TODO(A3.5): Edit / Remove actions
  ]

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <AddMemberControl projectId={id} />
      </div>
      <DataTable
        columns={columns}
        rows={members.data ?? []}
        getRowId={(row) => row.id}
        pagination={{
          mode: 'page',
          page: 1,
          pageSize: Math.max(members.data?.length ?? 0, 1),
          total: members.data?.length ?? 0,
          onPageChange: () => undefined,
        }}
        loading={members.isPending}
        error={
          members.error
            ? {
                message: isApiError(members.error)
                  ? members.error.message
                  : 'Unable to load members',
                onRetry: () => void members.refetch(),
              }
            : undefined
        }
        empty={{
          title: 'No members yet',
          description: 'Add someone with a role and scope.',
          action: canManage
            ? { label: 'Add member', onClick: () => router.push(addMemberHref(id)) }
            : undefined,
        }}
      />
      <div className="flex min-w-0 flex-col gap-2">
        <h2 className="text-sm font-medium">Access history</h2>
        {history.isPending ? (
          <Timeline items={[]} loading />
        ) : historyItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No access changes yet.</p>
        ) : (
          <Timeline items={historyItems} />
        )}
      </div>
    </div>
  )
}
