import { describe, expect, it } from 'vitest'

import { VerificationStatus, type JsonObject } from 'webmcp-capability-forge-core'

import { ProposalRepository, ProposalStatus } from './proposal-repository'
import { RepositoryTestFixtures } from './repository-test-fixtures'
import type { StorageArea } from './storage-area'

class MemoryStorageArea implements StorageArea {
  private values: JsonObject = {}
  async get(): Promise<JsonObject> { return structuredClone(this.values) }
  async set(values: JsonObject): Promise<void> { this.values = { ...this.values, ...structuredClone(values) } }
}

describe('ProposalRepository', () => {
  it('persists pending proposals and their resolution across repository instances', async () => {
    const storage = new MemoryStorageArea()
    const definition = RepositoryTestFixtures.capability('https://shop.example', 1, VerificationStatus.Proposed)
    await new ProposalRepository(storage).save({
      requestId: 'request-1', sessionId: 'session-1', status: ProposalStatus.Pending,
      definition, createdAt: 1000, expiresAt: 121000,
    })

    const restored = new ProposalRepository(storage)
    expect((await restored.listPending('https://shop.example')).map((record) => record.requestId)).toEqual(['request-1'])
    await restored.resolve('request-1', ProposalStatus.Approved)

    expect(await new ProposalRepository(storage).listPending('https://shop.example')).toEqual([])
  })
})
