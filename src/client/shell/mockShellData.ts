import { OrgRole } from '@/shared/enums/orgRole'
import type { ShellMembership } from '@/client/shell/OrgSwitcher'

export const mockShellData = {
  memberships: [
    { orgId: 'org_seed', name: 'Seed Org', slug: 'seed-org', orgRole: OrgRole.OWNER },
    { orgId: 'org_demo', name: 'Demo Org', slug: 'demo-org', orgRole: OrgRole.ADMIN },
  ],
  activeOrgId: 'org_seed',
  user: {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
  },
  approvalsCount: 3,
  project: {
    id: 'proj_1',
    name: 'APAC Launch',
    code: 'APAC',
    status: 'ACTIVE',
  },
} as {
  memberships: ShellMembership[]
  activeOrgId: string | null
  user: { name: string; email: string; image?: string }
  approvalsCount: number
  project: { id: string; name: string; code: string; status: string }
}
