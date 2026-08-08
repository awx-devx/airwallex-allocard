import { EVAL_TIMEOUT_MS, FormulaError, type AstNode } from '@/server/lib/formula/parse'

/** Truncate toward zero — keeps ledger amounts as integers. */
export function truncInt(value: number): number {
  return Math.trunc(value)
}

function requireArity(name: string, args: number[], min: number, max: number): void {
  if (args.length < min || args.length > max) {
    throw new FormulaError(
      'ARITY',
      `Function '${name}' expects ${min === max ? String(min) : `${min}-${max}`} args, got ${args.length}`,
    )
  }
}

function callFunction(name: string, args: number[]): number {
  switch (name) {
    case 'min': {
      requireArity(name, args, 2, 8)
      return truncInt(Math.min(...args))
    }
    case 'max': {
      requireArity(name, args, 2, 8)
      return truncInt(Math.max(...args))
    }
    case 'round': {
      requireArity(name, args, 1, 1)
      return truncInt(Math.round(args[0]!))
    }
    case 'floor': {
      requireArity(name, args, 1, 1)
      return truncInt(Math.floor(args[0]!))
    }
    case 'ceil': {
      requireArity(name, args, 1, 1)
      return truncInt(Math.ceil(args[0]!))
    }
    case 'clamp': {
      requireArity(name, args, 3, 3)
      const [x, lo, hi] = args as [number, number, number]
      return truncInt(Math.min(Math.max(x, lo), hi))
    }
    case 'pct': {
      // pct(x, p) = trunc(x * p / 100) — percent of x.
      requireArity(name, args, 2, 2)
      const [x, p] = args as [number, number]
      return truncInt((x * p) / 100)
    }
    default:
      throw new FormulaError('UNKNOWN_FUNCTION', `Unknown function '${name}'`)
  }
}

/**
 * Evaluate a parsed AST against an integer context map.
 * Throws FormulaError for unknown ids, div-by-zero, timeout, etc.
 */
export function evaluate(ast: AstNode, context: Record<string, number>): number {
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
        return truncInt(node.value)

      case 'identifier': {
        if (!Object.prototype.hasOwnProperty.call(context, node.name)) {
          throw new FormulaError('UNKNOWN_IDENTIFIER', `Unknown identifier '${node.name}'`)
        }
        const value = context[node.name]!
        if (!Number.isFinite(value)) {
          throw new FormulaError('INVALID_SYNTAX', `Context '${node.name}' is not a finite number`)
        }
        return truncInt(value)
      }

      case 'unary':
        return truncInt(-evalNode(node.arg))

      case 'binary': {
        const left = evalNode(node.left)
        const right = evalNode(node.right)
        switch (node.op) {
          case '+':
            return truncInt(left + right)
          case '-':
            return truncInt(left - right)
          case '*':
            return truncInt(left * right)
          case '/':
            if (right === 0) {
              throw new FormulaError('DIVISION_BY_ZERO', 'Division by zero')
            }
            return truncInt(left / right)
        }
        break
      }

      case 'call': {
        const args = node.args.map(evalNode)
        return callFunction(node.name, args)
      }
    }
  }

  return evalNode(ast)
}
