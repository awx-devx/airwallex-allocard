import { EVAL_TIMEOUT_MS, FormulaError, type AstNode } from '@/server/lib/formula/parse'

/** Truncate toward zero — keeps ledger amounts as integers. */
export function truncInt(value: number): number {
  return Math.trunc(value)
}

export const MS_PER_DAY = 86_400_000

/**
 * `integerOnly` (B4 budget dialect) truncates after every operation so a stored
 * amount can never become an IEEE float. The B6 rule dialect turns it off and
 * truncates once at the boundary instead — see `rules.ts`.
 */
export type EvaluateOptions = {
  integerOnly?: boolean
}

/** A context value may be absent-but-declared; only `coalesce` tolerates null. */
export type FormulaContext = Record<string, number | null>

function requireArity(name: string, count: number, min: number, max: number): void {
  if (count < min || count > max) {
    throw new FormulaError(
      'ARITY',
      `Function '${name}' expects ${min === max ? String(min) : `${min}-${max}`} args, got ${count}`,
    )
  }
}

function callFunction(name: string, args: number[], round: (value: number) => number): number {
  switch (name) {
    case 'min': {
      requireArity(name, args.length, 2, 8)
      return round(Math.min(...args))
    }
    case 'max': {
      requireArity(name, args.length, 2, 8)
      return round(Math.max(...args))
    }
    case 'round': {
      requireArity(name, args.length, 1, 1)
      return Math.round(args[0]!)
    }
    case 'floor': {
      requireArity(name, args.length, 1, 1)
      return Math.floor(args[0]!)
    }
    case 'ceil': {
      requireArity(name, args.length, 1, 1)
      return Math.ceil(args[0]!)
    }
    case 'abs': {
      requireArity(name, args.length, 1, 1)
      return round(Math.abs(args[0]!))
    }
    case 'clamp': {
      requireArity(name, args.length, 3, 3)
      const [x, lo, hi] = args as [number, number, number]
      return round(Math.min(Math.max(x, lo), hi))
    }
    case 'pct': {
      // pct(x, p) = x * p / 100 — percent of x.
      requireArity(name, args.length, 2, 2)
      const [x, p] = args as [number, number]
      return round((x * p) / 100)
    }
    case 'daysBetween': {
      // Both args are epoch milliseconds; dates enter the context already converted.
      requireArity(name, args.length, 2, 2)
      const [from, to] = args as [number, number]
      return truncInt((to - from) / MS_PER_DAY)
    }
    default:
      throw new FormulaError('UNKNOWN_FUNCTION', `Unknown function '${name}'`)
  }
}

/**
 * Evaluate a parsed AST against a context map.
 * Throws FormulaError for unknown ids, null values, div-by-zero, timeout, etc.
 */
export function evaluate(
  ast: AstNode,
  context: FormulaContext,
  options: EvaluateOptions = {},
): number {
  const integerOnly = options.integerOnly ?? true
  const round = integerOnly ? truncInt : (value: number): number => value
  const deadline = Date.now() + EVAL_TIMEOUT_MS

  const checkTimeout = (): void => {
    if (Date.now() > deadline) {
      throw new FormulaError('TIMEOUT', `Evaluation exceeded ${EVAL_TIMEOUT_MS}ms`)
    }
  }

  const evalNode = (node: AstNode): number => {
    checkTimeout()

    switch (node.kind) {
      case 'number':
        return round(node.value)

      case 'identifier': {
        if (!Object.prototype.hasOwnProperty.call(context, node.name)) {
          throw new FormulaError('UNKNOWN_IDENTIFIER', `Unknown identifier '${node.name}'`)
        }
        const value = context[node.name] ?? null
        if (value === null) {
          throw new FormulaError('NULL_VALUE', `Identifier '${node.name}' has no value`)
        }
        if (!Number.isFinite(value)) {
          throw new FormulaError('INVALID_SYNTAX', `Context '${node.name}' is not a finite number`)
        }
        return round(value)
      }

      case 'unary':
        return round(-evalNode(node.arg))

      case 'binary': {
        const left = evalNode(node.left)
        const right = evalNode(node.right)
        switch (node.op) {
          case '+':
            return round(left + right)
          case '-':
            return round(left - right)
          case '*':
            return round(left * right)
          case '/':
            if (right === 0) {
              throw new FormulaError('DIVISION_BY_ZERO', 'Division by zero')
            }
            return round(left / right)
        }
        break
      }

      case 'call': {
        if (node.name === 'coalesce') {
          return evalCoalesce(node.args)
        }
        return callFunction(node.name, node.args.map(evalNode), round)
      }
    }
  }

  /**
   * `coalesce` takes the first argument that holds a value. It rescues a
   * declared-but-null attribute; a *missing* attribute still fails the run, so
   * a typo can never quietly become a default.
   */
  const evalCoalesce = (args: AstNode[]): number => {
    requireArity('coalesce', args.length, 2, 8)
    for (const [index, arg] of args.entries()) {
      const isLast = index === args.length - 1
      try {
        return evalNode(arg)
      } catch (error) {
        if (isLast || !(error instanceof FormulaError) || error.code !== 'NULL_VALUE') {
          throw error
        }
      }
    }
    throw new FormulaError('NULL_VALUE', 'coalesce found no value')
  }

  return evalNode(ast)
}
