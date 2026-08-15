'use client'

import { useState } from 'react'
import { isApiError } from '@/client/api/errors'
import { useCreateBudgetCategory, useUpdateBudgetCategory } from '@/client/hooks/useBudget'
import {
  allocationsExceedApproved,
  allocationsSum,
  categoriesExceedMessage,
  minorToInputString,
} from '@/client/lib/budget'
import { FormulaEditor } from '@/app/(app)/projects/[id]/budget/FormulaEditor'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { parseMoneyInput } from '@/lib/money'
import { ErrorCode } from '@/shared/enums/errors'
import type { BudgetCategory } from '@/shared/types/budget'
import type { Workstream } from '@/shared/types/project'

const NONE = '__none__'

type AllocationMode = 'fixed' | 'formula'

export function CategorySheet({
  open,
  onOpenChange,
  mode,
  category,
  projectId,
  currency,
  approvedAmount,
  categories,
  workstreams,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  category: BudgetCategory | null
  projectId: string
  currency: string
  approvedAmount: number
  categories: BudgetCategory[]
  workstreams: Workstream[]
  onSaved: (mutate: () => Promise<void>) => Promise<void>
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="min-w-0 overflow-y-auto md:max-w-3xl">
        <SheetHeader>
          <SheetTitle>
            {mode === 'create' ? 'Add category' : `Edit ${category?.name ?? 'category'}`}
          </SheetTitle>
        </SheetHeader>
        {open ? (
          <CategorySheetBody
            key={category?.id ?? 'create'}
            mode={mode}
            category={category}
            projectId={projectId}
            currency={currency}
            approvedAmount={approvedAmount}
            categories={categories}
            workstreams={workstreams}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function CategorySheetBody({
  mode,
  category,
  projectId,
  currency,
  approvedAmount,
  categories,
  workstreams,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit'
  category: BudgetCategory | null
  projectId: string
  currency: string
  approvedAmount: number
  categories: BudgetCategory[]
  workstreams: Workstream[]
  onClose: () => void
  onSaved: (mutate: () => Promise<void>) => Promise<void>
}) {
  const createCategory = useCreateBudgetCategory()
  const updateCategory = useUpdateBudgetCategory()
  const [name, setName] = useState(category?.name ?? '')
  const [workstreamId, setWorkstreamId] = useState(category?.workstreamId ?? NONE)
  const [allocationMode, setAllocationMode] = useState<AllocationMode>(
    category?.formula ? 'formula' : 'fixed',
  )
  const [allocatedRaw, setAllocatedRaw] = useState(
    minorToInputString(category?.allocated ?? 0, currency),
  )
  const [expression, setExpression] = useState(category?.formula ?? '')
  const [formulaOk, setFormulaOk] = useState(() => !category?.formula)
  const [lastOkValue, setLastOkValue] = useState<number | null>(category?.allocated ?? null)
  const [allocatedError, setAllocatedError] = useState<string | null>(null)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)

  const others = categories.filter((row) => row.id !== category?.id)
  const trimmedName = name.trim()
  const nameOk = trimmedName.length >= 1 && trimmedName.length <= 120

  function parsedAllocated(): number | null {
    try {
      const amount = parseMoneyInput(allocatedRaw, currency).amount
      return amount < 0 ? null : amount
    } catch {
      return null
    }
  }

  const nextAllocated =
    allocationMode === 'formula' ? (lastOkValue ?? 0) : (parsedAllocated() ?? -1)
  const wouldExceed = allocationsExceedApproved(
    allocationsSum(others) + Math.max(nextAllocated, 0),
    approvedAmount,
  )
  const formulaValid = allocationMode !== 'formula' || formulaOk
  const fixedValid = allocationMode !== 'fixed' || parsedAllocated() !== null
  const canSave = nameOk && formulaValid && fixedValid && !wouldExceed
  const saving = createCategory.isPending || updateCategory.isPending

  async function onSave() {
    setAlertMessage(null)
    setAllocatedError(null)
    if (!canSave) return
    const resolvedWorkstream = workstreamId === NONE ? null : workstreamId
    let allocated: number
    if (allocationMode === 'formula') {
      allocated = lastOkValue ?? 0
    } else {
      const parsed = parsedAllocated()
      if (parsed === null) {
        setAllocatedError('Enter a valid amount.')
        return
      }
      allocated = parsed
    }
    if (allocationsExceedApproved(allocationsSum(others) + allocated, approvedAmount)) {
      return
    }
    try {
      await onSaved(async () => {
        if (mode === 'create') {
          await createCategory.mutateAsync({
            id: projectId,
            input:
              allocationMode === 'formula'
                ? {
                    name: trimmedName,
                    workstreamId: resolvedWorkstream,
                    allocated,
                    formula: expression,
                  }
                : { name: trimmedName, workstreamId: resolvedWorkstream, allocated },
          })
        } else if (category) {
          await updateCategory.mutateAsync({
            id: projectId,
            catId: category.id,
            input:
              allocationMode === 'formula'
                ? {
                    name: trimmedName,
                    workstreamId: resolvedWorkstream,
                    allocated,
                    formula: expression,
                  }
                : {
                    name: trimmedName,
                    workstreamId: resolvedWorkstream,
                    allocated,
                    formula: null,
                  },
          })
        }
      })
      onClose()
    } catch (error) {
      if (isApiError(error) && error.code === ErrorCode.VALIDATION_FAILED) {
        setAlertMessage(error.message)
        return
      }
      setAlertMessage(isApiError(error) ? error.message : 'Unable to save category')
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4 px-4 pb-4">
      {alertMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{alertMessage}</AlertDescription>
        </Alert>
      ) : null}
      {wouldExceed ? (
        <Alert variant="destructive">
          <AlertDescription>{categoriesExceedMessage()}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex min-w-0 flex-col gap-4 md:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="category-name">Name</Label>
            <Input
              id="category-name"
              value={name}
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="category-workstream">Workstream</Label>
            <Select value={workstreamId} onValueChange={setWorkstreamId}>
              <SelectTrigger id="category-workstream" className="w-full" aria-label="Workstream">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {workstreams.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <RadioGroup
            value={allocationMode}
            onValueChange={(value) => setAllocationMode(value as AllocationMode)}
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="fixed" id="alloc-fixed" />
              <Label htmlFor="alloc-fixed" className="font-normal">
                Fixed amount
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="formula" id="alloc-formula" />
              <Label htmlFor="alloc-formula" className="font-normal">
                Formula
              </Label>
            </div>
          </RadioGroup>
          {allocationMode === 'fixed' ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="category-allocated">Allocated</Label>
              <Input
                id="category-allocated"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={allocatedRaw}
                onChange={(event) => {
                  setAllocatedRaw(event.target.value)
                  setAllocatedError(null)
                }}
              />
              {allocatedError ? <p className="text-sm text-destructive">{allocatedError}</p> : null}
            </div>
          ) : null}
        </div>
        {allocationMode === 'formula' ? (
          <div className="min-w-0 flex-1">
            <FormulaEditor
              expression={expression}
              onChange={setExpression}
              approvedAmount={approvedAmount}
              currency={currency}
              projectId={projectId}
              onValidityChange={setFormulaOk}
              onValidatedValue={setLastOkValue}
            />
          </div>
        ) : null}
      </div>
      <Button type="button" disabled={!canSave} loading={saving} onClick={() => void onSave()}>
        Save
      </Button>
    </div>
  )
}
