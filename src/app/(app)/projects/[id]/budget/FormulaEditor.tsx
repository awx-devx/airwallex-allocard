'use client'

import { useEffect, useRef, useState } from 'react'
import { useValidateFormula } from '@/client/hooks/useBudget'
import { useAttributeValues } from '@/client/hooks/useRules'
import {
  FORMULA_DEBOUNCE_MS,
  attributeFormulaLandsInA6Message,
  attributeValueForIdent,
  formulaContextFromBudget,
  formulaExpressionTooLong,
  formulaIdentTokens,
  formulaTooLongMessage,
  isFormulaExpressionEmpty,
} from '@/client/lib/budget'
import { AttributeValue } from '@/components/patterns/AttributeValue'
import { FormulaHighlight } from '@/components/patterns/FormulaHighlight'
import { MoneyDisplay } from '@/components/patterns/MoneyDisplay'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AttributeSubjectType } from '@/shared/enums/attributeSubjectType'
import type { ValidateFormulaOutput } from '@/shared/types/budget'

export type FormulaEditorProps = {
  expression: string
  onChange: (next: string) => void
  approvedAmount: number
  currency: string
  projectId: string
  disabled?: boolean
  onValidityChange?: (ok: boolean) => void
}

type LastResult = {
  expression: string
  output: ValidateFormulaOutput
}

function isValidForExpression(expression: string, last: LastResult | null): boolean {
  if (formulaExpressionTooLong(expression)) return false
  if (isFormulaExpressionEmpty(expression)) return true
  return last !== null && last.expression === expression && last.output.ok === true
}

export function FormulaEditor({
  expression,
  onChange,
  approvedAmount,
  currency,
  projectId,
  disabled,
  onValidityChange,
}: FormulaEditorProps) {
  const validate = useValidateFormula()
  const attributes = useAttributeValues({
    subjectType: AttributeSubjectType.PROJECT,
    subjectId: projectId,
    page: 1,
    pageSize: 100,
  })
  const generation = useRef(0)
  const [lastResult, setLastResult] = useState<LastResult | null>(null)
  const [lastSuccess, setLastSuccess] = useState<number | null>(null)
  const lastError =
    lastResult?.output.ok === false
      ? { expression: lastResult.expression, error: lastResult.output.error }
      : null
  const tooLong = formulaExpressionTooLong(expression)
  const empty = isFormulaExpressionEmpty(expression)
  const ok = isValidForExpression(expression, lastResult)
  const idents = formulaIdentTokens(expression).filter((ident) => ident !== 'approvedAmount')

  useEffect(() => {
    onValidityChange?.(ok)
  }, [ok, onValidityChange])

  useEffect(() => {
    if (empty || tooLong) {
      generation.current += 1
      return
    }
    const gen = ++generation.current
    const timer = window.setTimeout(() => {
      validate.mutate(
        { expression, context: formulaContextFromBudget(approvedAmount) },
        {
          onSuccess: (output) => {
            if (gen !== generation.current) return
            setLastResult({ expression, output })
            if (output.ok) setLastSuccess(output.value)
          },
        },
      )
    }, FORMULA_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [approvedAmount, empty, expression, tooLong, validate])

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="budget-formula">Formula</Label>
        <Textarea
          id="budget-formula"
          value={expression}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
        {tooLong ? <p className="text-sm text-destructive">{formulaTooLongMessage()}</p> : null}
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-sm text-muted-foreground">Preview</p>
        {empty ? (
          <p className="text-sm text-muted-foreground">Enter a formula to preview.</p>
        ) : (
          <FormulaHighlight expression={expression} />
        )}
        {!empty && lastSuccess !== null ? (
          <MoneyDisplay money={{ amount: lastSuccess, currency }} colorBySign={false} />
        ) : null}
        {!empty && lastError && lastError.expression === expression ? (
          <p className="text-sm text-destructive">{lastError.error}</p>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">approvedAmount</span>
        <MoneyDisplay money={{ amount: approvedAmount, currency }} colorBySign={false} />
      </div>
      {idents.map((ident) => {
        const hit = attributeValueForIdent(ident, attributes.data?.items ?? [])
        if (hit) {
          return (
            <AttributeValue
              key={ident}
              value={hit.value}
              observedAt={hit.observedAt}
              ttlSec={hit.ttlSec}
              label={hit.key}
            />
          )
        }
        return (
          <p key={ident} className="text-sm text-muted-foreground">
            {ident}: {attributeFormulaLandsInA6Message()}
          </p>
        )
      })}
    </div>
  )
}
