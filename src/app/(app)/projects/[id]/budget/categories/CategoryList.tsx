'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { isApiError } from '@/client/api/errors'
import { useBudget, useBudgetCategories, useDeleteBudgetCategory } from '@/client/hooks/useBudget'
import { useProjectCards } from '@/client/hooks/useCards'
import { useWorkstreams } from '@/client/hooks/useProjects'
import { permissionGateAllowed } from '@/client/lib/access'
import {
  allocationsExceedApproved,
  allocationsSum,
  budgetHref,
  categoriesExceedMessage,
  diffCardTransactionLimits,
  editBudgetDenialMessage,
  hasBudgetRecord,
  snapshotCardTransactionLimits,
  type CardTransactionLimitDiff,
} from '@/client/lib/budget'
import { useCan } from '@/client/lib/permissions/useCan'
import { qk } from '@/client/queryKeys'
import { CardLimitMoves } from '@/app/(app)/projects/[id]/budget/CardLimitMoves'
import { CategorySheet } from '@/app/(app)/projects/[id]/budget/categories/CategorySheet'
import { ConfirmDialog } from '@/components/patterns/ConfirmDialog'
import { DataTable } from '@/components/patterns/DataTable'
import { EmptyState } from '@/components/patterns/EmptyState'
import { ErrorState } from '@/components/patterns/ErrorState'
import { FormulaHighlight } from '@/components/patterns/FormulaHighlight'
import { LoadingState } from '@/components/patterns/LoadingState'
import { MoneyDisplay } from '@/components/patterns/MoneyDisplay'
import { PermissionGateView } from '@/components/patterns/PermissionGate'
import type { DataTableColumn } from '@/components/patterns/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { ErrorCode } from '@/shared/enums/errors'
import { Permission } from '@/shared/enums/permissions'
import type { BudgetCategory } from '@/shared/types/budget'
import type { CardList } from '@/shared/types/card'

const CARD_PAGE = { page: 1, pageSize: 100 } as const

export function CategoryList() {
  const raw = useParams().id
  const id = typeof raw === 'string' ? raw : Array.isArray(raw) ? (raw[0] ?? '') : ''
  const queryClient = useQueryClient()
  const budgetQuery = useBudget(id)
  const categoriesQuery = useBudgetCategories(id)
  const workstreams = useWorkstreams(id)
  const cards = useProjectCards(id, CARD_PAGE)
  const deleteCategory = useDeleteBudgetCategory()
  const { can, isLoading } = useCan(id)
  const [sheet, setSheet] = useState<{ mode: 'create' | 'edit'; category: BudgetCategory | null }>({
    mode: 'create',
    category: null,
  })
  const [sheetOpen, setSheetOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<BudgetCategory | null>(null)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const [limitMoves, setLimitMoves] = useState<{
    diffs: CardTransactionLimitDiff[]
    cardTotal: number
  } | null>(null)

  async function runWithLimitDiff(mutate: () => Promise<void>): Promise<void> {
    const before = snapshotCardTransactionLimits(cards.data?.items ?? [])
    await mutate()
    await queryClient.invalidateQueries({ queryKey: qk.budgetHistory(id) })
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
      <div className="flex min-w-0 flex-col gap-4">
        <EmptyState
          title="No budget set yet"
          description="Set an approved amount. Categories and formulas come next."
        />
        <Link href={budgetHref(id)} className={buttonVariants()}>
          Set budget
        </Link>
      </div>
    )
  }

  const currency = detail.budget.currency
  const approvedAmount = detail.budget.approvedAmount
  const categories = categoriesQuery.data ?? []
  const canEdit = permissionGateAllowed(can(Permission.BUDGET_EDIT), isLoading)
  const exceed = allocationsExceedApproved(allocationsSum(categories), approvedAmount)

  const addButton = (
    <PermissionGateView allowed={canEdit} denialMessage={editBudgetDenialMessage()}>
      <Button
        type="button"
        disabled={!canEdit}
        onClick={() => {
          setSheet({ mode: 'create', category: null })
          setSheetOpen(true)
        }}
      >
        Add category
      </Button>
    </PermissionGateView>
  )

  const columns: DataTableColumn<BudgetCategory>[] = [
    { id: 'name', header: 'Name', cell: (row) => row.name },
    {
      id: 'workstream',
      header: 'Workstream',
      cell: (row) =>
        workstreams.data?.find((ws) => ws.id === row.workstreamId)?.name ?? row.workstreamId ?? '—',
    },
    {
      id: 'allocated',
      header: 'Allocated',
      cell: (row) => (
        <MoneyDisplay money={{ amount: row.allocated, currency }} colorBySign={false} />
      ),
    },
    {
      id: 'formula',
      header: 'Formula',
      cell: (row) => (row.formula ? <FormulaHighlight expression={row.formula} /> : '—'),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (row) => (
        <div className="flex flex-wrap gap-2">
          <PermissionGateView allowed={canEdit} denialMessage={editBudgetDenialMessage()}>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!canEdit}
              onClick={() => {
                setSheet({ mode: 'edit', category: row })
                setSheetOpen(true)
              }}
            >
              Edit
            </Button>
          </PermissionGateView>
          <PermissionGateView allowed={canEdit} denialMessage={editBudgetDenialMessage()}>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!canEdit}
              onClick={() => setDeleteTarget(row)}
            >
              Delete
            </Button>
          </PermissionGateView>
        </div>
      ),
    },
  ]

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {alertMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{alertMessage}</AlertDescription>
        </Alert>
      ) : null}
      {exceed ? (
        <Alert variant="destructive">
          <AlertDescription>{categoriesExceedMessage()}</AlertDescription>
        </Alert>
      ) : null}
      {limitMoves ? (
        <CardLimitMoves diffs={limitMoves.diffs} cardTotal={limitMoves.cardTotal} projectId={id} />
      ) : null}
      <div className="flex flex-wrap gap-2">{addButton}</div>
      <DataTable
        columns={columns}
        rows={categories}
        getRowId={(row) => row.id}
        pagination={{
          mode: 'page',
          page: 1,
          pageSize: Math.max(categories.length, 1),
          total: categories.length,
          onPageChange: () => undefined,
        }}
        loading={categoriesQuery.isPending}
        error={
          categoriesQuery.error
            ? {
                message: isApiError(categoriesQuery.error)
                  ? categoriesQuery.error.message
                  : 'Unable to load categories',
                onRetry: () => void categoriesQuery.refetch(),
              }
            : undefined
        }
        empty={{
          title: 'No categories yet',
          description: 'Split the approved amount into categories. An allocation may be a formula.',
          action: canEdit
            ? {
                label: 'Add category',
                onClick: () => {
                  setSheet({ mode: 'create', category: null })
                  setSheetOpen(true)
                },
              }
            : undefined,
        }}
      />
      <CategorySheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        mode={sheet.mode}
        category={sheet.category}
        projectId={id}
        currency={currency}
        approvedAmount={approvedAmount}
        categories={categories}
        workstreams={workstreams.data ?? []}
        onSaved={runWithLimitDiff}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title={deleteTarget ? `Delete ${deleteTarget.name}?` : 'Delete category?'}
        description="This is rejected if ledger entries reference it."
        confirmLabel="Delete"
        variant="destructive"
        loading={deleteCategory.isPending}
        onConfirm={() => {
          const target = deleteTarget
          if (!target) return
          setDeleteTarget(null)
          setAlertMessage(null)
          void runWithLimitDiff(async () => {
            try {
              await deleteCategory.mutateAsync({ id, catId: target.id })
            } catch (error) {
              setAlertMessage(isApiError(error) ? error.message : 'Unable to delete category')
              throw error
            }
          })
        }}
      />
    </div>
  )
}
