import { describe, expect, it } from 'vitest'

import { SessionStatus, type JsonObject } from 'webmcp-capability-forge-core'

import { RepositoryTestFixtures } from './repository-test-fixtures'
import { SessionRepository } from './session-repository'
import type { StorageArea } from './storage-area'

class MemoryStorageArea implements StorageArea {
  private values: JsonObject = {}

  async get(): Promise<JsonObject> {
    return structuredClone(this.values)
  }

  async set(values: JsonObject): Promise<void> {
    this.values = { ...this.values, ...structuredClone(values) }
  }
}

describe('SessionRepository', () => {
  it('keeps one isolated session per tab and clones reads', async () => {
    const repository = new SessionRepository(new MemoryStorageArea())
    await repository.save(10, RepositoryTestFixtures.session('session-1', 'https://one.example'))
    await repository.save(11, RepositoryTestFixtures.session('session-2', 'https://two.example'))

    const first = await repository.get(10)
    const firstAgain = await repository.get(10)
    const second = await repository.get(11)

    expect(first?.id).toBe('session-1')
    expect(second?.id).toBe('session-2')
    expect(first).not.toBe(firstAgain)
  })

  it('applies session expiry on read and scheduled sweeps', async () => {
    const storage = new MemoryStorageArea()
    const repository = new SessionRepository(storage, { now: () => 700_000 })
    await repository.save(10, RepositoryTestFixtures.session('session-1', 'https://one.example'))

    expect((await repository.get(10))?.status).toBe(SessionStatus.Paused)
    expect(await repository.expireAll()).toBe(0)
  })
})
