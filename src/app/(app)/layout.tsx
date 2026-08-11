import { redirect } from 'next/navigation'
import { requireApp } from '@/app/_lib/guards'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const result = await requireApp()
  if (!result.ok) {
    redirect(result.redirectTo)
  }
  return children
}
