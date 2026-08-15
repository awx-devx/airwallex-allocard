import { redirect } from 'next/navigation'
import { requireApp } from '@/app/_lib/guards'
import { AppShellFrame } from '@/client/shell/AppShellFrame'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const result = await requireApp()
  if (!result.ok) {
    redirect(result.redirectTo)
  }

  return <AppShellFrame>{children}</AppShellFrame>
}
