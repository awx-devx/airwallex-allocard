import { FormulaError, evaluateFormula } from '@/server/lib/formula'
import type { ValidateFormulaInput, ValidateFormulaOutput } from '@/shared/types/budget'

/**
 * Dry-run parse + evaluate for inline UI validation.
 * Never throws — returns `{ ok: false, error }` on formula failures.
 */
export function validateBudgetFormula(input: ValidateFormulaInput): ValidateFormulaOutput {
  try {
    const value = evaluateFormula(input.expression, input.context ?? {})
    return { ok: true, value }
  } catch (error) {
    const message = error instanceof FormulaError ? error.message : 'Invalid formula'
    return { ok: false, error: message }
  }
}
