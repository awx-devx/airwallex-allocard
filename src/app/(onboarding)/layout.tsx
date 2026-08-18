import { redirect } from 'next/navigation'
import { requireOnboarding } from '@/app/_lib/guards'
import { CenteredBrandFrame } from '@/client/shell/CenteredBrandFrame'

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const result = await requireOnboarding()
  if (!result.ok) {
    redirect(result.redirectTo)
  }
  return <CenteredBrandFrame>{children}</CenteredBrandFrame>
}
