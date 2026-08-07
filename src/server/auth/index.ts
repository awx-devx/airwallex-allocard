import NextAuth from 'next-auth'
import { createAuthConfig } from '@/server/auth/config'
import '@/server/auth/types'

const nextAuth = NextAuth(createAuthConfig())

export const { handlers, auth, signIn, signOut } = nextAuth
