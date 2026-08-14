import { describe, expect, it } from 'vitest'
import {
  buildAuthHref,
  inviteErrorCopy,
  invitePath,
  isInviteToken,
  isSafeCallbackUrl,
  parseAuthSearchParams,
  resolvePostAuthHref,
  signInFormSchema,
} from '@/client/lib/auth'
import { ErrorCode } from '@/shared/enums/errors'

const TOKEN = 'AbCdefGhIjkLmnOpQrsTuvWxyZ0123456789_-'

describe('isInviteToken', () => {
  it('accepts 16–128 base64url characters', () => {
    expect(isInviteToken(TOKEN)).toBe(true)
    expect(isInviteToken('a'.repeat(16))).toBe(true)
    expect(isInviteToken('a'.repeat(128))).toBe(true)
  })

  it('drops invalid tokens', () => {
    expect(isInviteToken('short')).toBe(false)
    expect(isInviteToken('a'.repeat(15))).toBe(false)
    expect(isInviteToken('a'.repeat(129))).toBe(false)
    expect(isInviteToken('has/slash1234567')).toBe(false)
    expect(isInviteToken('has.dot123456789')).toBe(false)
    expect(isInviteToken('has+plus12345678')).toBe(false)
  })
})

describe('invitePath', () => {
  it('returns /invite/{token} without encoding _ or -', () => {
    expect(invitePath(TOKEN)).toBe(`/invite/${TOKEN}`)
    expect(invitePath(TOKEN)).toContain('_')
    expect(invitePath(TOKEN)).toContain('-')
  })

  it('throws on invalid tokens', () => {
    expect(() => invitePath('nope')).toThrow()
  })
})

describe('parseAuthSearchParams', () => {
  it('keeps a valid invite and a safe returnTo', () => {
    expect(parseAuthSearchParams({ invite: TOKEN, returnTo: '/projects' })).toEqual({
      inviteToken: TOKEN,
      returnTo: '/projects',
    })
  })

  it('uses the first array element', () => {
    expect(
      parseAuthSearchParams({ invite: [TOKEN, 'other'], returnTo: ['/dashboard', '/x'] }),
    ).toEqual({ inviteToken: TOKEN, returnTo: '/dashboard' })
  })

  it('drops unsafe returnTo', () => {
    expect(parseAuthSearchParams({ returnTo: '//evil.com' }).returnTo).toBeNull()
    expect(parseAuthSearchParams({ returnTo: 'https://evil.com' }).returnTo).toBeNull()
    expect(parseAuthSearchParams({ returnTo: 'dashboard' }).returnTo).toBeNull()
  })

  it('drops invalid invite tokens', () => {
    expect(parseAuthSearchParams({ invite: 'short' }).inviteToken).toBeNull()
    expect(parseAuthSearchParams({ invite: 'has/slash1234567' }).inviteToken).toBeNull()
  })
})

describe('buildAuthHref', () => {
  it('invite wins over returnTo', () => {
    expect(buildAuthHref('sign-in', { inviteToken: TOKEN, returnTo: '/projects' })).toBe(
      `/sign-in?invite=${TOKEN}`,
    )
    expect(buildAuthHref('sign-up', { inviteToken: TOKEN, returnTo: '/projects' })).toBe(
      `/sign-up?invite=${TOKEN}`,
    )
  })

  it('encodes a safe returnTo when there is no invite', () => {
    expect(buildAuthHref('sign-in', { returnTo: '/projects' })).toBe(
      '/sign-in?returnTo=%2Fprojects',
    )
  })

  it('drops unsafe returnTo and invalid invite', () => {
    expect(buildAuthHref('sign-in', { inviteToken: 'nope', returnTo: '//evil.com' })).toBe(
      '/sign-in',
    )
    expect(buildAuthHref('sign-up', {})).toBe('/sign-up')
  })
})

describe('resolvePostAuthHref', () => {
  it('invite wins over returnTo', () => {
    expect(
      resolvePostAuthHref({ inviteToken: TOKEN, returnTo: '/projects', onboarded: true }),
    ).toBe(`/invite/${TOKEN}`)
  })

  it('uses safe returnTo when there is no invite', () => {
    expect(resolvePostAuthHref({ returnTo: '/projects', onboarded: true })).toBe('/projects')
  })

  it('drops unsafe returnTo and defaults by onboarded', () => {
    expect(resolvePostAuthHref({ returnTo: '//evil.com', onboarded: true })).toBe('/dashboard')
    expect(resolvePostAuthHref({ returnTo: 'https://evil.com', onboarded: false })).toBe(
      '/onboarding',
    )
    expect(resolvePostAuthHref({ returnTo: 'dashboard', onboarded: false })).toBe('/onboarding')
  })
})

describe('isSafeCallbackUrl', () => {
  it('allows the post-auth dest allowlist', () => {
    expect(isSafeCallbackUrl('/dashboard')).toBe(true)
    expect(isSafeCallbackUrl('/onboarding')).toBe(true)
    expect(isSafeCallbackUrl('/onboarding/create-organization')).toBe(true)
    expect(isSafeCallbackUrl(`/invite/${TOKEN}`)).toBe(true)
  })

  it('rejects open redirects and non-dest paths', () => {
    expect(isSafeCallbackUrl('//evil.com')).toBe(false)
    expect(isSafeCallbackUrl('https://evil.com')).toBe(false)
    expect(isSafeCallbackUrl('/invite/../../x')).toBe(false)
    expect(isSafeCallbackUrl('/sign-in?returnTo=https://evil.com')).toBe(false)
    expect(isSafeCallbackUrl('/sign-in')).toBe(false)
  })
})

describe('inviteErrorCopy', () => {
  it('maps every invite ErrorCode in A1 policy §6', () => {
    expect(inviteErrorCopy(ErrorCode.INVITE_EXPIRED)).toEqual({
      variant: 'warning',
      message: 'This invite has expired. Ask the organisation owner to send a new one.',
    })
    expect(inviteErrorCopy(ErrorCode.INVITE_REVOKED)).toEqual({
      variant: 'warning',
      message: 'This invite was revoked.',
    })
    expect(inviteErrorCopy(ErrorCode.INVITE_ALREADY_ACCEPTED)).toEqual({
      variant: 'info',
      message: 'This invite has already been accepted.',
    })
    expect(inviteErrorCopy(ErrorCode.NOT_FOUND)).toEqual({
      variant: 'warning',
      message: 'This invite is not available.',
    })
    expect(inviteErrorCopy(ErrorCode.PERMISSION_DENIED)).toEqual({
      variant: 'destructive',
      message:
        'This invite was sent to a different email address. Sign in as the invited account to accept it.',
    })
  })

  it('returns null for other codes', () => {
    expect(inviteErrorCopy(ErrorCode.CONFLICT)).toBeNull()
    expect(inviteErrorCopy(ErrorCode.RATE_LIMITED)).toBeNull()
    expect(inviteErrorCopy(ErrorCode.UNAUTHENTICATED)).toBeNull()
  })
})

describe('signInFormSchema', () => {
  it('accepts email + password (max 128)', () => {
    expect(signInFormSchema.parse({ email: 'a@b.co', password: 'x' })).toEqual({
      email: 'a@b.co',
      password: 'x',
    })
    expect(() => signInFormSchema.parse({ email: 'a@b.co', password: '' })).toThrow()
    expect(() => signInFormSchema.parse({ email: 'a@b.co', password: 'x'.repeat(129) })).toThrow()
  })
})
