'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { CheckIcon, XIcon } from 'lucide-react'
import { isApiError } from '@/client/api/errors'
import {
  useBudget,
  useBudgetChangeRequests,
  useCreateChangeRequest,
  useDecideChangeRequest,
} from '@/client/hooks/useBudget'
import { useProjectCards } from '@/client/hooks/useCards'
import { useProject } from '@/client/hooks/useProjects'
import { permissionGateAllowed } from '@/client/lib/access'
import {
  budgetHref,
  diffCardTransactionLimits,
  editBudgetDenialMessage,
  hasBudgetRecord,
  requestBudgetDenialMessage,
  snapshotCardTransactionLimits,
  type CardTransactionLimitDiff,
} from '@/client/lib/budget'
import { useCan } from '@/client/lib/permissions/useCan'
import { isProjectArchived } from '@/client/lib/reports'
import { qk } from '@/client/queryKeys'
import { CardLimitMoves } from '@/app/(app)/projects/[id]/budget/CardLimitMoves'
import { CreateChangeRequestDialog } from '@/app/(app)/projects/[id]/budget/requests/CreateChangeRequestDialog'
import { ConfirmDialog } from '@/components/patterns/ConfirmDialog'
import { DataTable } from '@/components/patterns/DataTable'
import { EmptyState } from '@/components/patterns/EmptyState'
import { ErrorState } from '@/components/patterns/ErrorState'
import { LoadingState } from '@/components/patterns/LoadingState'
import { MoneyDisplay } from '@/components/patterns/MoneyDisplay'
import { PermissionGateView } from '@/components/patterns/PermissionGate'
import type { DataTableColumn } from '@/components/patterns/types'
import { PageFill } from '@/components/patterns/PageBody'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { formatDate } from '@/lib/dates'
import { BudgetChangeRequestStatus } from '@/shared/enums/budgetChangeRequestStatus'
import { ErrorCode } from '@/shared/enums/errors'
import { Permission } from '@/shared/enums/permissions'
import type { BudgetChangeRequest } from '@/shared/types/budget'
import type { CardList } from '@/shared/types/card'

const CARD_PAGE = { page: 1, pageSize: 100 } as const

export function ChangeRequestList() {
  const raw = useParams().id
  const id = typeof raw === 'string' ? raw : Array.isArray(raw) ? (raw[0] ?? '') : ''
  const queryClient = useQueryClient()
  const budgetQuery = useBudget(id)
  const project = useProject(id)
  const requests = useBudgetChangeRequests(id)
  const cards = useProjectCards(id, CARD_PAGE)
  const createRequest = useCreateChangeRequest()
  const decide = useDecideChangeRequest()
  const { can, isLoading } = useCan(id)
  const [createOpen, setCreateOpen] = useState(false)
  const [decideDialog, setDecideDialog] = useState<{
    id: string
    decision: 'APPROVE' | 'REJECT'
  } | null>(null)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const [limitMoves, setLimitMoves] = useState<{
    diffs: CardTransactionLimitDiff[]
    cardTotal: number
  } | null>(null)

  const archived = isProjectArchived(project.data?.status ?? '')
  const canRequest = permissionGateAllowed(can(Permission.BUDGET_REQUEST), isLoading) && !archived
  const canEdit = permissionGateAllowed(can(Permission.BUDGET_EDIT), isLoading) && !archived

  async function runApprove(changeRequestId: string): Promise<void> {
    const before = snapshotCardTransactionLimits(cards.data?.items ?? [])
    const data = await decide.mutateAsync({
      id: changeRequestId,
      input: { decision: 'APPROVE' },
    })
    await queryClient.invalidateQueries({ queryKey: qk.budgetHistory(data.projectId) })
    await queryClient.refetchQueries({ queryKey: qk.cardsForProject(id) })
    const afterList = queryClient.getQueryData<CardList>(qk.cardsForProject(id, CARD_PAGE))
    const afterItems = afterList?.items ?? cards.data?.items ?? []
    const diffs = diffCardTransactionLimits(before, snapshotCardTransactionLimits(afterItems))
    setLimitMoves({ diffs, cardTotal: afterList?.total ?? cards.data?.total ?? 0 })
  }

  if (!id) {
    return <ErrorState message="This project is not available." />
  }

  if (budgetQuery.isPending) {
    return <LoadingState />
  }

  if (budgetQuery.error) {
    if (isApiError(budgetQuery.error) && budgetQuery.error.code === ErrorCode.NOT_FOUND) {
      return <ErrorState message="This project is not available." />
    }
    return (
      <ErrorState
        message={
          isApiError(budgetQuery.error) ? budgetQuery.error.message : 'Unable to load budget'
        }
      />
    )
  }

  const detail = budgetQuery.data
  if (!detail || !hasBudgetRecord(detail.budget) || detail.budget === null) {
    return (
      <PageFill>
        <EmptyState
          title="No budget set yet"
          description="Set an approved amount. Categories and formulas come next."
        />
        {archived ? null : (
          <Link href={budgetHref(id)} className={buttonVariants()}>
            Set budget
          </Link>
        )}
      </PageFill>
    )
  }

  const currency = detail.budget.currency
  const rows = requests.data ?? []

  const columns: DataTableColumn<BudgetChangeRequest>[] = [
    {
      id: 'deltaAmount',
      header: 'Delta',
      cell: (row) => <MoneyDisplay money={{ amount: row.deltaAmount, currency }} />,
    },
    {
      id: 'reason',
      header: 'Reason',
      cell: (row) => (
        <span className="min-w-0 break-all" title={row.reason}>
          {row.reason}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <Badge>{row.status}</Badge>,
    },
    {
      id: 'createdAt',
      header: 'Created',
      cell: (row) => formatDate(row.createdAt),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (row) =>
        row.status === BudgetChangeRequestStatus.PENDING ? (
          <div className="flex flex-wrap items-center gap-2">
            <PermissionGateView allowed={canEdit} denialMessage={editBudgetDenialMessage()}>
              <Button
                type="button"
                size="sm"
                disabled={!canEdit}
                onClick={() => setDecideDialog({ id: row.id, decision: 'APPROVE' })}
              >
                <CheckIcon className="size-4 shrink-0" aria-hidden />
                Approve
              </Button>
            </PermissionGateView>
            <PermissionGateView allowed={canEdit} denialMessage={editBudgetDenialMessage()}>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!canEdit}
                onClick={() => setDecideDialog({ id: row.id, decision: 'REJECT' })}
              >
                <XIcon className="size-4 shrink-0" aria-hidden />
                Reject
              </Button>
            </PermissionGateView>
          </div>
        ) : null,
    },
  ]

  return (
    <PageFill>
      {alertMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{alertMessage}</AlertDescription>
        </Alert>
      ) : null}
      {limitMoves ? (
        <CardLimitMoves diffs={limitMoves.diffs} cardTotal={limitMoves.cardTotal} projectId={id} />
      ) : null}
      <div className="flex flex-wrap gap-2">
        <PermissionGateView allowed={canRequest} denialMessage={requestBudgetDenialMessage()}>
          <Button type="button" disabled={!canRequest} onClick={() => setCreateOpen(true)}>
            Request change
          </Button>
        </PermissionGateView>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        pagination={{
          mode: 'page',
          page: 1,
          pageSize: Math.max(rows.length, 1),
          total: rows.length,
          onPageChange: () => undefined,
        }}
        loading={requests.isPending}
        error={
          requests.error
            ? {
                message: isApiError(requests.error)
                  ? requests.error.message
                  : 'Unable to load change requests',
                onRetry: () => void requests.refetch(),
              }
            : undefined
        }
        empty={{
          title: 'No change requests',
          description: 'Request a change when you cannot edit the budget directly.',
          action: canRequest
            ? { label: 'Request change', onClick: () => setCreateOpen(true) }
            : undefined,
        }}
      />
      <CreateChangeRequestDialog
        key={createOpen ? 'create-open' : 'create-closed'}
        open={createOpen}
        onOpenChange={setCreateOpen}
        currency={currency}
        loading={createRequest.isPending}
        onSave={async (input) => {
          await createRequest.mutateAsync({ id, input })
          await queryClient.invalidateQueries({ queryKey: qk.budgetHistory(id) })
        }}
      />
      <ConfirmDialog
        open={decideDialog !== null}
        onOpenChange={(open) => {
          if (!open) setDecideDialog(null)
        }}
        title={
          decideDialog?.decision === 'REJECT'
            ? 'Reject this budget change?'
            : 'Approve this budget change?'
        }
        description=""
        confirmLabel={decideDialog?.decision === 'REJECT' ? 'Reject' : 'Approve'}
        variant={decideDialog?.decision === 'REJECT' ? 'destructive' : 'default'}
        loading={decide.isPending}
        onConfirm={() => {
          const current = decideDialog
          if (!current) return
          setDecideDialog(null)
          setAlertMessage(null)
          void (async () => {
            try {
              if (current.decision === 'APPROVE') {
                await runApprove(current.id)
              } else {
                await decide.mutateAsync({ id: current.id, input: { decision: 'REJECT' } })
              }
            } catch (error) {
              setAlertMessage(isApiError(error) ? error.message : 'Unable to decide change request')
            }
          })()
        }}
      />
    </PageFill>
  )
}
