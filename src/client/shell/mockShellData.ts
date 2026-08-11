export const mockShellData = {
  memberships: [
    { orgId: 'org_seed', name: 'Seed Org', slug: 'seed-org' },
    { orgId: 'org_demo', name: 'Demo Org', slug: 'demo-org' },
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
  memberships: { orgId: string; name: string; slug: string }[]
  activeOrgId: string | null
  user: { name: string; email: string; image?: string }
  approvalsCount: number
  project: { id: string; name: string; code: string; status: string }
}
