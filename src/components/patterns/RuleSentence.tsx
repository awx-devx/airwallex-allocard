import { ruleToSentence } from '@/lib/rules/sentence'
import type { RuleSentenceProps } from '@/components/patterns/types'

export function RuleSentence({ rule }: RuleSentenceProps) {
  return (
    <div className="space-y-1">
      {rule.name ? <h4 className="font-medium">{rule.name}</h4> : null}
      <p className="text-sm">{ruleToSentence(rule)}</p>
    </div>
  )
}
