import { describe, expect, it } from 'vitest'
import { loadPublicEnv, loadServerEnv } from '@/server/env'

const validServerEnv: Record<string, string | undefined> = {
  MONGODB_URI: 'mongodb://127.0.0.1:27017/allocard',
  AUTH_SECRET: 'test-secret-at-least-one-char',
  AIRWALLEX_CLIENT_ID: 'client-id',
  AIRWALLEX_API_KEY: 'api-key',
  AIRWALLEX_WEBHOOK_SECRET: 'webhook-secret',
}

describe('loadServerEnv', () => {
  it('parses a valid environment', () => {
    const env = loadServerEnv(validServerEnv)

    expect(env.MONGODB_URI).toBe(validServerEnv.MONGODB_URI)
    expect(env.MONGODB_DB).toBe('allocard')
    expect(env.AUTH_URL).toBe('http://localhost:3000')
    expect(env.REMOTE_AUTH_MODE).toBe('simulate')
    expect(env.WORKER_SCHEDULER_ENABLED).toBe(true)
    expect(env.REDIS_URL).toBeUndefined()
  })

  it('throws naming a missing required variable', () => {
    expect(() => loadServerEnv({})).toThrow(/MONGODB_URI/)
    expect(() =>
      loadServerEnv({
        ...validServerEnv,
        AUTH_SECRET: undefined,
      }),
    ).toThrow(/AUTH_SECRET/)
    expect(() =>
      loadServerEnv({
        ...validServerEnv,
        AIRWALLEX_API_KEY: '',
      }),
    ).toThrow(/AIRWALLEX_API_KEY/)
  })
})

describe('loadPublicEnv', () => {
  it('parses an empty public env', () => {
    expect(loadPublicEnv({})).toEqual({})
  })
})
