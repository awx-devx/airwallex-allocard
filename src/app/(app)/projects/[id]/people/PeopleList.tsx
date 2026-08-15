'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { isApiError } from '@/client/api/errors'
import { useCardholders, useProjectCards } from '@/client/hooks/useCards'
import { useAccessHistory, useProjectMembers, useRemoveMember } from '@/client/hooks/useMembers'
import { useCan } from '@/client/lib/permissions/useCan'
import {
  addMemberDenialMessage,
  addMemberHref,
  isLastAccessManager,
  lastAccessManagerDenialMessage,
  memberAccessState,
  memberHasCards,
  permissionGateAllowed,
  SCOPE_LEVEL_LABELS,
  toAccessHistoryTimelineItem,
} from '@/client/lib/access'
import { EditMemberSheet } from '@/app/(app)/projects/[id]/people/EditMemberSheet'
import { ConfirmDialog } from '@/components/patterns/ConfirmDialog'
import { DataTable } from '@/components/patterns/DataTable'
import { ErrorState } from '@/components/patterns/ErrorState'
import { PermissionGateView } from '@/components/patterns/PermissionGate'
import { Timeline } from '@/components/patterns/Timeline'
import type { DataTableColumn } from '@/components/patterns/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Permission } from '@/shared/enums/permissions'
import type { ProjectMemberDetail } from '@/shared/types/projectMember'

function AddMemberControl({ projectId }: { projectId: string }) {
  const { can, isLoading } = useCan(projectId)
  const allowed = permissionGateAllowed(can(Permission.MEMBER_MANAGE), isLoading)
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
  const removeMember = useRemoveMember()
  const { can, isLoading } = useCan(id)
  const now = new Date()
  const [editing, setEditing] = useState<ProjectMemberDetail | null>(null)
  const [removeDialog, setRemoveDialog] = useState<{
    open: boolean
    member: ProjectMemberDetail | null
  }>({ open: false, member: null })
  const [actionError, setActionError] = useState<string | null>(null)

  if (!id) {
    return <ErrorState message="This project is not available." />
  }

  const canManage = permissionGateAllowed(can(Permission.MEMBER_MANAGE), isLoading)
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
    {
      id: 'actions',
      header: 'Actions',
      cell: (row) => {
        const lastManager = isLastAccessManager(members.data ?? [], row.userId, now)
        return (
          <div className="flex flex-wrap gap-2">
            <PermissionGateView allowed={canManage} denialMessage={addMemberDenialMessage()}>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!canManage}
                onClick={() => setEditing(row)}
              >
                Edit
              </Button>
            </PermissionGateView>
            {lastManager ? (
              <PermissionGateView allowed={false} denialMessage={lastAccessManagerDenialMessage()}>
                <Button type="button" size="sm" variant="outline" disabled>
                  Remove
                </Button>
              </PermissionGateView>
            ) : (
              <PermissionGateView allowed={canManage} denialMessage={addMemberDenialMessage()}>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!canManage}
                  onClick={() => setRemoveDialog({ open: true, member: row })}
                >
                  Remove
                </Button>
              </PermissionGateView>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {actionError ? (
        <Alert variant="destructive">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}
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
      <EditMemberSheet
        projectId={id}
        member={editing}
        members={members.data ?? []}
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      />
      <ConfirmDialog
        open={removeDialog.open}
        onOpenChange={(open) => setRemoveDialog((prev) => ({ ...prev, open }))}
        title={
          removeDialog.member
            ? `Remove ${removeDialog.member.user.name} from this project?`
            : 'Remove member?'
        }
        description="They will lose project access immediately."
        confirmLabel="Remove"
        variant="destructive"
        loading={removeMember.isPending}
        onConfirm={() => {
          const row = removeDialog.member
          if (row === null) return
          setRemoveDialog((prev) => ({ ...prev, open: false }))
          setActionError(null)
          void removeMember.mutateAsync({ id, userId: row.userId }).catch((error: unknown) => {
            setActionError(isApiError(error) ? error.message : 'Unable to remove member')
          })
        }}
      />
    </div>
  )
}
