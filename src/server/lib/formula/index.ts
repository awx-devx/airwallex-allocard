export {
  EVAL_TIMEOUT_MS,
  FormulaError,
  MAX_EXPRESSION_LENGTH,
  MAX_NODES,
  countNodes,
  parse,
  type AstNode,
  type FormulaErrorCode,
} from '@/server/lib/formula/parse'
export { evaluate, truncInt } from '@/server/lib/formula/evaluate'

import { evaluate } from '@/server/lib/formula/evaluate'
import { parse } from '@/server/lib/formula/parse'

/** Parse + evaluate in one step. */
export function evaluateFormula(expression: string, context: Record<string, number> = {}): number {
  return evaluate(parse(expression), context)
}
