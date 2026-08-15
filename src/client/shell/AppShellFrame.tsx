'use client'

import { signOut } from 'next-auth/react'
import type { ReactNode } from 'react'
import { useApprovalCount } from '@/client/hooks/useRequests'
import { useMe } from '@/client/hooks/useSession'
import { useActiveOrg } from '@/client/providers/ActiveOrgProvider'
import { AppShell } from '@/client/shell/AppShell'

export function AppShellFrame({ children }: { children: ReactNode }) {
  const me = useMe()
  const { orgId } = useActiveOrg()
  const approvalCount = useApprovalCount()

  const memberships =
    me.data?.memberships.map((m) => ({
      orgId: m.orgId,
      name: m.org.name,
      slug: m.org.slug,
    })) ?? []

  const user = me.data?.user
    ? {
        name: me.data.user.name,
        email: me.data.user.email,
        ...(me.data.user.image !== undefined ? { image: me.data.user.image } : {}),
      }
    : { name: '', email: '' }

  return (
    <AppShell
      memberships={memberships}
      activeOrgId={orgId}
      user={user}
      approvalsCount={approvalCount.data?.count ?? 0}
      project={null}
      onSignOut={() => {
        void signOut({ callbackUrl: '/sign-in' })
      }}
    >
      {children}
    </AppShell>
  )
}
