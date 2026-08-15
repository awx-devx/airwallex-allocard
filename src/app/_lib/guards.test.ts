import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Session } from 'next-auth'

const authMock = vi.fn<() => Promise<Session | null>>()

vi.mock('@/server/auth', () => ({
  auth: (...args: unknown[]) => authMock(...(args as [])),
}))

import { requireAnonymous, requireApp, requireOnboarding } from '@/app/_lib/guards'

function session(partial: { userId: string; onboarded: boolean }): Session {
  return {
    userId: partial.userId,
    orgId: null,
    orgRole: null,
    onboarded: partial.onboarded,
    expires: '2099-01-01T00:00:00.000Z',
    user: { id: partial.userId, email: 'a@b.com', name: 'A' },
  }
}

afterEach(() => {
  authMock.mockReset()
})

describe('requireAnonymous', () => {
  it('allows no session', async () => {
    authMock.mockResolvedValue(null)
    await expect(requireAnonymous()).resolves.toEqual({ ok: true, session: null })
  })

  it('redirects onboarded session to dashboard', async () => {
    authMock.mockResolvedValue(session({ userId: 'u1', onboarded: true }))
    await expect(requireAnonymous()).resolves.toEqual({ ok: false, redirectTo: '/dashboard' })
  })

  it('redirects not-onboarded session to onboarding', async () => {
    authMock.mockResolvedValue(session({ userId: 'u1', onboarded: false }))
    await expect(requireAnonymous()).resolves.toEqual({ ok: false, redirectTo: '/onboarding' })
  })
})

describe('requireOnboarding', () => {
  it('redirects anonymous to sign-in', async () => {
    authMock.mockResolvedValue(null)
    await expect(requireOnboarding()).resolves.toEqual({ ok: false, redirectTo: '/sign-in' })
  })

  it('allows authenticated not onboarded', async () => {
    const s = session({ userId: 'u1', onboarded: false })
    authMock.mockResolvedValue(s)
    await expect(requireOnboarding()).resolves.toEqual({ ok: true, session: s })
  })

  it('redirects onboarded to dashboard', async () => {
    authMock.mockResolvedValue(session({ userId: 'u1', onboarded: true }))
    await expect(requireOnboarding()).resolves.toEqual({ ok: false, redirectTo: '/dashboard' })
  })
})

describe('requireApp', () => {
  it('redirects anonymous to sign-in', async () => {
    authMock.mockResolvedValue(null)
    await expect(requireApp()).resolves.toEqual({ ok: false, redirectTo: '/sign-in' })
  })

  it('preserves safe return path', async () => {
    authMock.mockResolvedValue(null)
    await expect(requireApp('/projects')).resolves.toEqual({
      ok: false,
      redirectTo: '/sign-in?returnTo=%2Fprojects',
    })
  })

  it('drops unsafe return path', async () => {
    authMock.mockResolvedValue(null)
    await expect(requireApp('//evil.com')).resolves.toEqual({ ok: false, redirectTo: '/sign-in' })
  })

  it('redirects not-onboarded to onboarding', async () => {
    authMock.mockResolvedValue(session({ userId: 'u1', onboarded: false }))
    await expect(requireApp()).resolves.toEqual({ ok: false, redirectTo: '/onboarding' })
  })

  it('allows onboarded', async () => {
    const s = session({ userId: 'u1', onboarded: true })
    authMock.mockResolvedValue(s)
    await expect(requireApp()).resolves.toEqual({ ok: true, session: s })
  })
})

describe('app layout gate', () => {
  it('still calls requireApp so the product is unreachable without an organisation', () => {
    const src = readFileSync(join(process.cwd(), 'src/app/(app)/layout.tsx'), 'utf8')
    expect(src).toContain('requireApp()')
    expect(src).not.toMatch(/collapse/)
  })
})
