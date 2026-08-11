import { afterEach, describe, expect, it, vi } from 'vitest'
import { call } from '@/client/api/client'
import { ApiError } from '@/client/api/errors'
import { authContracts } from '@/shared/contracts/auth'
import { defineContract } from '@/shared/contracts/types'
import { ErrorCode } from '@/shared/enums/errors'
import { z } from 'zod'

const listStub = defineContract({
  method: 'GET',
  path: '/api/projects',
  input: z.object({
    status: z.string().optional(),
    page: z.number().optional(),
  }),
  output: z.object({ items: z.array(z.string()) }),
})

const createStub = defineContract({
  method: 'POST',
  path: '/api/projects',
  input: z.object({ name: z.string() }),
  output: z.object({ id: z.string(), name: z.string() }),
})

const voidOut = defineContract({
  method: 'DELETE',
  path: '/api/things/:id',
  input: z.void(),
  output: z.void(),
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('call', () => {
  it('GETs with credentials, query, and x-org-id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ items: ['a'] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await call(listStub, {
      input: { status: 'ACTIVE', page: 1 },
      orgId: 'org_1',
    })

    expect(result).toEqual({ items: ['a'] })
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/projects?status=ACTIVE&page=1')
    expect(init.method).toBe('GET')
    expect(init.credentials).toBe('include')
    expect(init.headers['x-org-id']).toBe('org_1')
  })

  it('POSTs JSON body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 'p1', name: 'Launch' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await call(createStub, { input: { name: 'Launch' } })
    const [, init] = fetchMock.mock.calls[0]!
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(init.body).toBe(JSON.stringify({ name: 'Launch' }))
  })

  it('throws ApiError on envelope error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          error: { code: ErrorCode.UNAUTHENTICATED, message: 'Unauthenticated' },
        }),
      }),
    )

    await expect(call(authContracts.me)).rejects.toBeInstanceOf(ApiError)
    await expect(call(authContracts.me)).rejects.toMatchObject({
      code: ErrorCode.UNAUTHENTICATED,
      status: 401,
    })
  })

  it('returns undefined for void output / 204', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        json: async () => {
          throw new Error('no body')
        },
      }),
    )
    await expect(call(voidOut, { params: { id: 't1' } })).resolves.toBeUndefined()
  })

  it('throws loudly on output mismatch in development', async () => {
    expect(process.env.NODE_ENV).not.toBe('production')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ wrong: true }),
      }),
    )
    await expect(call(listStub, { input: {} })).rejects.toThrow(/Contract output mismatch/)
  })

  it('builds me URL without params', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        user: {
          id: 'u1',
          email: 'a@b.com',
          name: 'A',
          createdAt: '2020-01-01T00:00:00.000Z',
        },
        memberships: [],
        onboarded: false,
      }),
    })
    vi.stubGlobal('fetch', fetchMock)
    await call(authContracts.me, { orgId: 'org_1' })
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/me')
    expect(fetchMock.mock.calls[0]![1].headers['x-org-id']).toBe('org_1')
  })
})
