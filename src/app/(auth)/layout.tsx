import { redirect } from 'next/navigation'
import { requireAnonymous } from '@/app/_lib/guards'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const result = await requireAnonymous()
  if (!result.ok) {
    redirect(result.redirectTo)
  }
  return children
}
