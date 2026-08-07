import { afterEach, describe, expect, it, vi } from 'vitest'
import mongoose from 'mongoose'
import { connectDb, disconnectDb } from '@/server/db/connect'

describe('connectDb', () => {
  afterEach(async () => {
    await disconnectDb()
    vi.restoreAllMocks()
  })

  it('calling twice yields one connection', async () => {
    const connectSpy = vi.spyOn(mongoose, 'connect').mockResolvedValue(mongoose)

    const first = await connectDb({ uri: 'mongodb://127.0.0.1:27017', dbName: 'allocard-test' })
    const second = await connectDb({ uri: 'mongodb://127.0.0.1:27017', dbName: 'allocard-test' })

    expect(first).toBe(second)
    expect(first).toBe(mongoose)
    expect(connectSpy).toHaveBeenCalledTimes(1)
    expect(connectSpy).toHaveBeenCalledWith('mongodb://127.0.0.1:27017', {
      dbName: 'allocard-test',
    })
  })

  it('concurrent callers share one connection promise', async () => {
    let resolveConnect!: (value: typeof mongoose) => void
    const connectSpy = vi.spyOn(mongoose, 'connect').mockImplementation(
      () =>
        new Promise<typeof mongoose>((resolve) => {
          resolveConnect = resolve
        }),
    )

    const pending = Promise.all([
      connectDb({ uri: 'mongodb://127.0.0.1:27017', dbName: 'allocard-test' }),
      connectDb({ uri: 'mongodb://127.0.0.1:27017', dbName: 'allocard-test' }),
      connectDb({ uri: 'mongodb://127.0.0.1:27017', dbName: 'allocard-test' }),
    ])

    expect(connectSpy).toHaveBeenCalledTimes(1)

    resolveConnect(mongoose)
    const [a, b, c] = await pending

    expect(a).toBe(b)
    expect(b).toBe(c)
    expect(connectSpy).toHaveBeenCalledTimes(1)
  })
})
