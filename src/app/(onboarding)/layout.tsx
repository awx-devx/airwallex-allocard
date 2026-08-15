import { redirect } from 'next/navigation'
import { requireOnboarding } from '@/app/_lib/guards'

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const result = await requireOnboarding()
  if (!result.ok) {
    redirect(result.redirectTo)
  }
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md px-4">{children}</div>
    </div>
  )
}
