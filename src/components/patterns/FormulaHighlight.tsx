import { highlightFormula, type FormulaTokenType } from '@/lib/rules/formulaHighlight'
import type { FormulaHighlightProps } from '@/components/patterns/types'
import { cn } from '@/lib/utils'

const TOKEN_CLASS: Record<FormulaTokenType, string> = {
  ident: 'text-foreground',
  number: 'text-status-info',
  op: 'text-muted-foreground',
  punct: 'text-muted-foreground',
  ws: '',
  unknown: 'text-status-danger',
}

export function FormulaHighlight({ expression }: FormulaHighlightProps) {
  const tokens = highlightFormula(expression)
  return (
    <code className="font-mono text-sm">
      {tokens.map((token, i) => (
        <span
          key={`${i}-${token.type}`}
          data-token={token.type}
          className={cn(TOKEN_CLASS[token.type])}
        >
          {token.value}
        </span>
      ))}
    </code>
  )
}
