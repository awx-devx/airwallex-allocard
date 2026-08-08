/**
 * Sandboxed budget formula parser (B4; B6 extends attribute resolution later).
 *
 * Limits (adversarial / DoS caps):
 * - MAX_EXPRESSION_LENGTH = 500
 * - MAX_NODES = 64
 * - EVAL_TIMEOUT_MS = 25 (enforced in evaluate.ts)
 *
 * Integer rule: every arithmetic op and function result is truncated toward
 * zero with Math.trunc so stored amounts never become IEEE floats.
 *
 * No eval, no Function, no property access (`.` / `[]`), no assignment.
 */

export const MAX_EXPRESSION_LENGTH = 500
export const MAX_NODES = 64
export const EVAL_TIMEOUT_MS = 25

export type FormulaErrorCode =
  | 'DIVISION_BY_ZERO'
  | 'UNKNOWN_IDENTIFIER'
  | 'UNKNOWN_FUNCTION'
  | 'OVERSIZED'
  | 'PROPERTY_ACCESS'
  | 'FORBIDDEN'
  | 'INVALID_SYNTAX'
  | 'TIMEOUT'
  | 'ARITY'

export class FormulaError extends Error {
  readonly code: FormulaErrorCode

  constructor(code: FormulaErrorCode, message: string) {
    super(message)
    this.name = 'FormulaError'
    this.code = code
  }
}

export type AstNode =
  | { kind: 'number'; value: number }
  | { kind: 'identifier'; name: string }
  | { kind: 'unary'; op: '-'; arg: AstNode }
  | { kind: 'binary'; op: '+' | '-' | '*' | '/'; left: AstNode; right: AstNode }
  | { kind: 'call'; name: string; args: AstNode[] }

type Token =
  | { type: 'number'; value: number }
  | { type: 'identifier'; value: string }
  | { type: 'op'; value: '+' | '-' | '*' | '/' | '(' | ')' | ',' }
  | { type: 'eof' }

const ALLOWED_FUNCTIONS = new Set(['min', 'max', 'round', 'floor', 'ceil', 'clamp', 'pct'])

const FORBIDDEN_IDENTIFIERS = new Set(['eval', 'Function', 'function', 'constructor'])

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < input.length) {
    const ch = input[i]!

    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i += 1
      continue
    }

    if (ch === '.' || ch === '[' || ch === ']') {
      throw new FormulaError('PROPERTY_ACCESS', `Property access is not allowed (saw '${ch}')`)
    }

    if (ch === '=' || ch === '!' || ch === '<' || ch === '>' || ch === '&' || ch === '|') {
      throw new FormulaError('FORBIDDEN', `Operator '${ch}' is not allowed`)
    }

    if (
      ch === '+' ||
      ch === '-' ||
      ch === '*' ||
      ch === '/' ||
      ch === '(' ||
      ch === ')' ||
      ch === ','
    ) {
      tokens.push({ type: 'op', value: ch })
      i += 1
      continue
    }

    if (ch >= '0' && ch <= '9') {
      let j = i
      while (j < input.length && input[j]! >= '0' && input[j]! <= '9') {
        j += 1
      }
      if (j < input.length && input[j] === '.') {
        throw new FormulaError('FORBIDDEN', 'Floating-point literals are not allowed')
      }
      tokens.push({ type: 'number', value: Number.parseInt(input.slice(i, j), 10) })
      i = j
      continue
    }

    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_') {
      let j = i + 1
      while (
        j < input.length &&
        ((input[j]! >= 'a' && input[j]! <= 'z') ||
          (input[j]! >= 'A' && input[j]! <= 'Z') ||
          (input[j]! >= '0' && input[j]! <= '9') ||
          input[j] === '_')
      ) {
        j += 1
      }
      const name = input.slice(i, j)
      if (FORBIDDEN_IDENTIFIERS.has(name)) {
        throw new FormulaError('FORBIDDEN', `Identifier '${name}' is not allowed`)
      }
      tokens.push({ type: 'identifier', value: name })
      i = j
      continue
    }

    throw new FormulaError('INVALID_SYNTAX', `Unexpected character '${ch}'`)
  }

  tokens.push({ type: 'eof' })
  return tokens
}

export function countNodes(node: AstNode): number {
  switch (node.kind) {
    case 'number':
    case 'identifier':
      return 1
    case 'unary':
      return 1 + countNodes(node.arg)
    case 'binary':
      return 1 + countNodes(node.left) + countNodes(node.right)
    case 'call':
      return 1 + node.args.reduce((sum, arg) => sum + countNodes(arg), 0)
  }
}

/** Parse an expression into an AST. Throws FormulaError on invalid input. */
export function parse(expression: string): AstNode {
  if (expression.length > MAX_EXPRESSION_LENGTH) {
    throw new FormulaError(
      'OVERSIZED',
      `Expression length ${expression.length} exceeds max ${MAX_EXPRESSION_LENGTH}`,
    )
  }

  const tokens = tokenize(expression)
  let pos = 0

  const peek = (): Token => tokens[pos]!
  const advance = (): Token => {
    const token = tokens[pos]!
    pos += 1
    return token
  }

  const isOp = (token: Token, value: string): boolean =>
    token.type === 'op' && token.value === value

  function parseExpr(): AstNode {
    let left = parseTerm()
    while (true) {
      const token = peek()
      if (token.type === 'op' && (token.value === '+' || token.value === '-')) {
        advance()
        left = { kind: 'binary', op: token.value, left, right: parseTerm() }
        continue
      }
      break
    }
    return left
  }

  function parseTerm(): AstNode {
    let left = parseUnary()
    while (true) {
      const token = peek()
      if (token.type === 'op' && (token.value === '*' || token.value === '/')) {
        advance()
        left = { kind: 'binary', op: token.value, left, right: parseUnary() }
        continue
      }
      break
    }
    return left
  }

  function parseUnary(): AstNode {
    const token = peek()
    if (isOp(token, '-')) {
      advance()
      return { kind: 'unary', op: '-', arg: parseUnary() }
    }
    return parsePrimary()
  }

  function parsePrimary(): AstNode {
    const token = peek()

    if (token.type === 'number') {
      advance()
      return { kind: 'number', value: token.value }
    }

    if (token.type === 'identifier') {
      advance()
      if (isOp(peek(), '(')) {
        advance()
        const args: AstNode[] = []
        if (!isOp(peek(), ')')) {
          args.push(parseExpr())
          while (isOp(peek(), ',')) {
            advance()
            args.push(parseExpr())
          }
        }
        const close = advance()
        if (!isOp(close, ')')) {
          throw new FormulaError('INVALID_SYNTAX', "Expected ')'")
        }
        if (!ALLOWED_FUNCTIONS.has(token.value)) {
          throw new FormulaError('UNKNOWN_FUNCTION', `Unknown function '${token.value}'`)
        }
        return { kind: 'call', name: token.value, args }
      }
      return { kind: 'identifier', name: token.value }
    }

    if (isOp(token, '(')) {
      advance()
      const inner = parseExpr()
      const close = advance()
      if (!isOp(close, ')')) {
        throw new FormulaError('INVALID_SYNTAX', "Expected ')'")
      }
      return inner
    }

    throw new FormulaError('INVALID_SYNTAX', 'Expected number, identifier, or "("')
  }

  const ast = parseExpr()
  if (peek().type !== 'eof') {
    throw new FormulaError('INVALID_SYNTAX', 'Unexpected trailing input')
  }

  const nodes = countNodes(ast)
  if (nodes > MAX_NODES) {
    throw new FormulaError('OVERSIZED', `Expression has ${nodes} nodes; max is ${MAX_NODES}`)
  }

  return ast
}
