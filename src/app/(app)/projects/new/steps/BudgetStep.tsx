'use client'

/**
 * A4 may replace this step with categories and formulas. A2 only PUTs approvedAmount + currency.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { isApiError } from '@/client/api/errors'
import { useBudget, useSetBudget } from '@/client/hooks/useBudget'
import { useMe } from '@/client/hooks/useSession'
import { hasBudgetFrom } from '@/client/lib/projects'
import { BudgetBar } from '@/components/patterns/BudgetBar'
import { LoadingState } from '@/components/patterns/LoadingState'
import { MoneyDisplay } from '@/components/patterns/MoneyDisplay'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { currencyExponent } from '@/shared/constants/currency'
import { parseMoneyInput } from '@/lib/money'
import type { Project, ProjectDetail } from '@/shared/types/project'

export type BudgetStepHandle = {
  submit: () => Promise<boolean>
}

export type BudgetStepProps = {
  draftId: string
  project: Project | ProjectDetail | undefined
  onValidChange: (valid: boolean) => void
  onDirtyChange: (dirty: boolean) => void
}

function minorToInputString(amount: number, currency: string): string {
  const exp = currencyExponent(currency)
  if (exp === 0) {
    return String(amount)
  }
  const sign = amount < 0 ? '-' : ''
  const abs = Math.abs(amount)
  const factor = 10 ** exp
  const major = Math.trunc(abs / factor)
  const frac = abs % factor
  if (frac === 0) {
    return `${sign}${major}`
  }
  return `${sign}${major}.${String(frac).padStart(exp, '0')}`
}

function parsedAmountOrNull(raw: string, currency: string): number | null {
  try {
    const parsed = parseMoneyInput(raw, currency)
    return parsed.amount
  } catch {
    return null
  }
}

export const BudgetStep = forwardRef<BudgetStepHandle, BudgetStepProps>(function BudgetStep(
  { draftId, project, onValidChange, onDirtyChange },
  ref,
) {
  const me = useMe()
  const budgetQuery = useBudget(draftId)
  const setBudget = useSetBudget()
  const currency = me.data?.activeOrg?.baseCurrency ?? ''
  const [raw, setRaw] = useState('')
  const [amountError, setAmountError] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const hydrated = useRef<string | null>(null)

  const approved = budgetQuery.data?.budget?.approvedAmount ?? null
  const projection = budgetQuery.data?.projection
  const initial =
    approved !== null && currency.length === 3 ? minorToInputString(approved, currency) : ''

  useEffect(() => {
    if (hydrated.current === draftId) return
    if (approved === null || currency.length !== 3) return
    hydrated.current = draftId
    setRaw(minorToInputString(approved, currency))
  }, [approved, currency, draftId])

  const parsed = currency.length === 3 ? parsedAmountOrNull(raw, currency) : null
  const valid =
    (parsed !== null && parsed > 0) || (project !== undefined && hasBudgetFrom(project, approved))

  useEffect(() => {
    onValidChange(valid)
  }, [onValidChange, valid])

  useEffect(() => {
    onDirtyChange(raw !== initial)
  }, [initial, onDirtyChange, raw])

  async function submit(): Promise<boolean> {
    setAmountError(null)
    setErrorMessage(null)
    if (currency.length !== 3) {
      setErrorMessage('Unable to load organisation currency')
      return false
    }
    let amount: number
    try {
      amount = parseMoneyInput(raw, currency).amount
    } catch {
      setAmountError('Enter a valid amount.')
      return false
    }
    if (amount <= 0) {
      setAmountError('Enter a valid amount.')
      return false
    }
    try {
      await setBudget.mutateAsync({
        id: draftId,
        input: { currency, approvedAmount: amount },
      })
      return true
    } catch (error) {
      setErrorMessage(isApiError(error) ? error.message : 'Unable to save budget')
      return false
    }
  }

  useImperativeHandle(ref, () => ({ submit }))

  if (budgetQuery.isPending || me.isPending) {
    return <LoadingState label="Loading budget" />
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {errorMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}
      <Card className="laser-cap">
        <CardHeader>
          <CardTitle>Approved amount</CardTitle>
        </CardHeader>
        <CardContent className="flex min-w-0 flex-col gap-4 md:flex-row">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <p className="text-sm">
              Currency: {currency.length === 3 ? currency : '—'}
              {currency.length === 3 ? (
                <>
                  {' '}
                  <MoneyDisplay money={{ amount: 0, currency }} colorBySign={false} />
                </>
              ) : null}
            </p>
            {approved !== null && currency.length === 3 ? (
              <p className="text-sm">
                Current approved:{' '}
                <MoneyDisplay money={{ amount: approved, currency }} colorBySign={false} />
              </p>
            ) : null}
            <div className="flex flex-col gap-2">
              <Label htmlFor="approved-amount">Approved amount</Label>
              <Input
                id="approved-amount"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={raw}
                onChange={(event) => {
                  setRaw(event.target.value)
                  setAmountError(null)
                }}
              />
              {amountError ? <p className="text-sm text-destructive">{amountError}</p> : null}
            </div>
          </div>
          {projection && currency.length === 3 ? (
            <div className="min-w-0 flex-1">
              <BudgetBar
                currency={currency}
                approved={projection.approved}
                committed={projection.committed}
                actual={projection.actual}
                remaining={projection.remaining}
                utilisationPct={projection.utilisationPct}
                overCommitted={projection.overCommitted}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
})
