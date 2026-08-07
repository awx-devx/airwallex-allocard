import 'next-auth'
import 'next-auth/jwt'
import type { OrgRole } from '@/shared/enums/orgRole'

declare module 'next-auth' {
  interface Session {
    userId: string
    orgId: string | null
    orgRole: OrgRole | null
    onboarded: boolean
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }

  interface User {
    id: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string
    orgId?: string | null
    orgRole?: OrgRole | null
    onboarded?: boolean
  }
}
