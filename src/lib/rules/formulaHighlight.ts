/** Display-only formula tokenizer — does not evaluate expressions. */
export type FormulaTokenType = 'number' | 'ident' | 'op' | 'punct' | 'ws' | 'unknown'

export type FormulaToken = {
  type: FormulaTokenType
  value: string
}

const TOKEN_PATTERN = /(\s+|\d+(?:\.\d+)?|[a-zA-Z_][a-zA-Z0-9_.]*|[+\-*/()]|,|.)/g

function classifyToken(raw: string): FormulaTokenType {
  if (/^\s+$/.test(raw)) {
    return 'ws'
  }
  if (/^\d+(?:\.\d+)?$/.test(raw)) {
    return 'number'
  }
  if (/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(raw)) {
    return 'ident'
  }
  if (/^[+\-*/]$/.test(raw)) {
    return 'op'
  }
  if (/^[(),]$/.test(raw)) {
    return 'punct'
  }
  return 'unknown'
}

export function highlightFormula(expression: string): FormulaToken[] {
  const tokens: FormulaToken[] = []
  let match: RegExpExecArray | null
  TOKEN_PATTERN.lastIndex = 0
  let lastIndex = 0
  while ((match = TOKEN_PATTERN.exec(expression)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'unknown', value: expression.slice(lastIndex, match.index) })
    }
    const value = match[0]
    tokens.push({ type: classifyToken(value), value })
    lastIndex = match.index + value.length
  }
  if (lastIndex < expression.length) {
    tokens.push({ type: 'unknown', value: expression.slice(lastIndex) })
  }
  return tokens
}
