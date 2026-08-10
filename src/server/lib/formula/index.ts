export {
  EVAL_TIMEOUT_MS,
  FormulaError,
  MAX_EXPRESSION_LENGTH,
  MAX_NODES,
  collectIdentifiers,
  countNodes,
  parse,
  type AstNode,
  type FormulaErrorCode,
  type ParseOptions,
} from '@/server/lib/formula/parse'
export {
  MS_PER_DAY,
  evaluate,
  truncInt,
  type EvaluateOptions,
  type FormulaContext,
} from '@/server/lib/formula/evaluate'
export {
  RULE_FORMULA_OPTIONS,
  RULE_FUNCTIONS,
  buildRuleFormulaContext,
  evaluateMoneyFormula,
  evaluateRuleFormula,
  parseRuleFormula,
  ruleFormulaIdentifiers,
} from '@/server/lib/formula/rules'

import { evaluate } from '@/server/lib/formula/evaluate'
import { parse } from '@/server/lib/formula/parse'

/** Parse + evaluate in one step. */
export function evaluateFormula(expression: string, context: Record<string, number> = {}): number {
  return evaluate(parse(expression), context)
}
