import { Suspense } from 'react'
import { OrgRuleList } from '@/app/(app)/settings/rules/OrgRuleList'
import { LoadingState } from '@/components/patterns/LoadingState'

export default function OrgRulesPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <OrgRuleList />
    </Suspense>
  )
}
