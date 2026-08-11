import { redirect } from 'next/navigation'
import { requireOnboarding } from '@/app/_lib/guards'

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const result = await requireOnboarding()
  if (!result.ok) {
    redirect(result.redirectTo)
  }
  return children
}
