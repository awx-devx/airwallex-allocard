import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  getActiveOrgId,
  initActiveOrgId,
  reconcileActiveOrg,
  resetActiveOrgState,
  setActiveOrgId,
  syncActiveOrgForSession,
} from '@/client/providers/activeOrg'

const store = new Map<string, string>()

const localStorageMock = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => {
    store.set(key, value)
  },
  removeItem: (key: string) => {
    store.delete(key)
  },
}

describe('activeOrg', () => {
  beforeEach(() => {
    store.clear()
    resetActiveOrgState()
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      writable: true,
      value: { localStorage: localStorageMock },
    })
  })

  afterEach(() => {
    store.clear()
    resetActiveOrgState()
  })

  it('initActiveOrgId restores a stored org', () => {
    store.set('allocard:activeOrgId', 'org_seed')
    initActiveOrgId()
    expect(getActiveOrgId()).toBe('org_seed')
  })

  it('syncActiveOrgForSession drops a leftover org when not onboarded', () => {
    store.set('allocard:activeOrgId', 'org_seed')
    store.set('allocard:activeOrgUserId', 'user_old')
    initActiveOrgId()

    syncActiveOrgForSession({ userId: 'user_new', onboarded: false })

    expect(getActiveOrgId()).toBeNull()
    expect(store.get('allocard:activeOrgId')).toBeUndefined()
    expect(store.get('allocard:activeOrgUserId')).toBe('user_new')
  })

  it('syncActiveOrgForSession drops another account’s org even when onboarded', () => {
    store.set('allocard:activeOrgId', 'org_a')
    store.set('allocard:activeOrgUserId', 'user_a')
    initActiveOrgId()

    syncActiveOrgForSession({ userId: 'user_b', onboarded: true })

    expect(getActiveOrgId()).toBeNull()
    expect(store.get('allocard:activeOrgId')).toBeUndefined()
  })

  it('syncActiveOrgForSession signed-out clears the module ref but keeps storage', () => {
    store.set('allocard:activeOrgId', 'org_seed')
    store.set('allocard:activeOrgUserId', 'user_a')
    initActiveOrgId()

    syncActiveOrgForSession({ userId: null, onboarded: false })

    expect(getActiveOrgId()).toBeNull()
    expect(store.get('allocard:activeOrgId')).toBe('org_seed')
  })

  it('syncActiveOrgForSession restores storage for the same onboarded user', () => {
    store.set('allocard:activeOrgId', 'org_seed')
    store.set('allocard:activeOrgUserId', 'user_a')
    resetActiveOrgState()

    syncActiveOrgForSession({ userId: 'user_a', onboarded: true })

    expect(getActiveOrgId()).toBe('org_seed')
  })

  it('reconcileActiveOrg keeps a stored org the user belongs to', () => {
    setActiveOrgId('org_a')
    reconcileActiveOrg({ membershipOrgIds: ['org_a', 'org_b'], fallback: 'org_b' })
    expect(getActiveOrgId()).toBe('org_a')
  })

  it('reconcileActiveOrg falls back when the stored org is not a membership', () => {
    setActiveOrgId('org_stale')
    reconcileActiveOrg({ membershipOrgIds: ['org_b'], fallback: 'org_b' })
    expect(getActiveOrgId()).toBe('org_b')
  })

  it('reconcileActiveOrg clears when there is no usable membership', () => {
    setActiveOrgId('org_stale')
    reconcileActiveOrg({ membershipOrgIds: [], fallback: 'org_b' })
    expect(getActiveOrgId()).toBeNull()
  })
})
