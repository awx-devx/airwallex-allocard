import { redirect } from 'next/navigation'
import { requireApp } from '@/app/_lib/guards'
import { AppShell } from '@/client/shell/AppShell'
import { mockShellData } from '@/client/shell/mockShellData'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const result = await requireApp()
  if (!result.ok) {
    redirect(result.redirectTo)
  }

  return (
    <AppShell
      memberships={mockShellData.memberships}
      activeOrgId={mockShellData.activeOrgId}
      user={mockShellData.user}
      approvalsCount={mockShellData.approvalsCount}
    >
      {children}
    </AppShell>
  )
}
