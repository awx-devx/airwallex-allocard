import { describe, expect, it } from 'vitest'
import { buildUrl } from '@/client/api/path'

describe('buildUrl', () => {
  it('returns paths with no params unchanged', () => {
    expect(buildUrl('/api/me')).toBe('/api/me')
  })

  it('substitutes multiple params', () => {
    expect(buildUrl('/api/projects/:id/members/:userId', { id: 'p1', userId: 'u1' })).toBe(
      '/api/projects/p1/members/u1',
    )
  })

  it('encodes param values', () => {
    expect(buildUrl('/api/invites/preview/:token', { token: 'a/b c' })).toBe(
      '/api/invites/preview/a%2Fb%20c',
    )
  })

  it('throws when a param is missing', () => {
    expect(() => buildUrl('/api/projects/:id', {})).toThrow(/Missing path param :id/)
  })

  it('throws on unused keys', () => {
    expect(() => buildUrl('/api/projects/:id', { id: 'p1', extra: 'x' })).toThrow(
      /Unused path param "extra"/,
    )
  })
})
