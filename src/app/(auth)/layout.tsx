import { redirect } from 'next/navigation'
import { requireAnonymous } from '@/app/_lib/guards'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const result = await requireAnonymous()
  if (!result.ok) {
    redirect(result.redirectTo)
  }
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md px-4">{children}</div>
    </div>
  )
}
