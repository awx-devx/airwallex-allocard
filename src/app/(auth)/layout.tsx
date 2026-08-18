import { redirect } from 'next/navigation'
import { requireAnonymous } from '@/app/_lib/guards'
import { CenteredBrandFrame } from '@/client/shell/CenteredBrandFrame'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const result = await requireAnonymous()
  if (!result.ok) {
    redirect(result.redirectTo)
  }
  return (
    <CenteredBrandFrame priority size="lg">
      {children}
    </CenteredBrandFrame>
  )
}
