'use client'

import { signOut } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { useProject } from '@/client/hooks/useProjects'
import { useApprovalCount } from '@/client/hooks/useRequests'
import { useMe } from '@/client/hooks/useSession'
import { useActiveOrg } from '@/client/providers/ActiveOrgProvider'
import { AppShell } from '@/client/shell/AppShell'
import { projectIdFromPathname } from '@/client/shell/navCrumbs'

export function AppShellFrame({ children }: { children: ReactNode }) {
  const me = useMe()
  const pathname = usePathname()
  const { orgId } = useActiveOrg()
  const approvalCount = useApprovalCount()
  const projectId = projectIdFromPathname(pathname) ?? ''
  const projectQuery = useProject(projectId)

  const memberships =
    me.data?.memberships.map((m) => ({
      orgId: m.orgId,
      name: m.org.name,
      slug: m.org.slug,
      orgRole: m.orgRole,
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
      project={
        projectQuery.data
          ? {
              id: projectQuery.data.id,
              name: projectQuery.data.name,
              code: projectQuery.data.code,
              status: projectQuery.data.status,
            }
          : null
      }
      onSignOut={() => {
        void signOut({ callbackUrl: '/sign-in' })
      }}
    >
      {children}
    </AppShell>
  )
}
