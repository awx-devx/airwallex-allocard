import { BudgetChrome } from '@/app/(app)/projects/[id]/budget/BudgetChrome'

export default function BudgetLayout({ children }: { children: React.ReactNode }) {
  return <BudgetChrome>{children}</BudgetChrome>
}
