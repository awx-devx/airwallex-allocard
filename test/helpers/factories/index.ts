import type { OrgRole } from '@/server/http/types'

let seq = 0
function nextId(prefix: string): string {
  seq += 1
  return `${prefix}_${seq.toString().padStart(4, '0')}`
}

export type TestUser = {
  id: string
  email: string
  name: string
}

export type TestOrg = {
  id: string
  name: string
  slug: string
  baseCurrency: string
}

export type TestMember = {
  id: string
  orgId: string
  userId: string
  orgRole: OrgRole
  user: TestUser
  org: TestOrg
}

/** In-memory factory — B1 will persist when User/Org models exist. */
export async function makeUser(overrides: Partial<TestUser> = {}): Promise<TestUser> {
  const id = overrides.id ?? nextId('user')
  return {
    id,
    email: `${id}@example.com`,
    name: 'Test User',
    ...overrides,
  }
}

export async function makeOrg(overrides: Partial<TestOrg> = {}): Promise<TestOrg> {
  const id = overrides.id ?? nextId('org')
  return {
    id,
    name: 'Test Org',
    slug: id,
    baseCurrency: 'USD',
    ...overrides,
  }
}

export async function makeMember(
  org: TestOrg,
  overrides: {
    id?: string
    userId?: string
    orgRole?: OrgRole
    user?: Partial<TestUser>
  } = {},
): Promise<TestMember> {
  const user = await makeUser(overrides.user)
  return {
    id: overrides.id ?? nextId('member'),
    orgId: org.id,
    userId: overrides.userId ?? user.id,
    orgRole: overrides.orgRole ?? 'MEMBER',
    user,
    org,
  }
}

/** Default domain card controls (minor-unit limits). */
export function makeCardControls(
  overrides: Partial<{
    allowedTransactionCount: 'SINGLE' | 'MULTIPLE'
    monthlyAmount: number
    allowedCurrencies: string[] | null
  }> = {},
) {
  return {
    allowedTransactionCount: overrides.allowedTransactionCount ?? ('MULTIPLE' as const),
    transactionLimits: {
      currency: 'USD',
      limits: [{ interval: 'MONTHLY' as const, amount: overrides.monthlyAmount ?? 400_000 }],
    },
    activeFrom: null,
    activeTo: null,
    allowedCurrencies:
      overrides.allowedCurrencies === undefined ? null : overrides.allowedCurrencies,
    allowedMerchantCategories: null,
    allowedMerchantCountries: null,
    allowedMerchantBrands: null,
    blockedTransactionUsages: [] as { transactionScope: string; usageScope: string }[],
  }
}
