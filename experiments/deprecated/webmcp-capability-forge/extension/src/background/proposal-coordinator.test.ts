import { describe, expect, it } from 'vitest'

import { VerificationStatus, type JsonObject } from 'webmcp-capability-forge-core'

import { ProposalCoordinator, ProposalStatus } from './proposal-coordinator'
import { CapabilityRepository } from '../storage/capability-repository'
import { ProposalRepository } from '../storage/proposal-repository'
import { RepositoryTestFixtures } from '../storage/repository-test-fixtures'
import type { StorageArea } from '../storage/storage-area'

class MemoryStorageArea implements StorageArea {
  private values: JsonObject = {}
  async get(): Promise<JsonObject> { return structuredClone(this.values) }
  async set(values: JsonObject): Promise<void> { this.values = { ...this.values, ...structuredClone(values) } }
}

describe('ProposalCoordinator', () => {
  it('keeps a valid proposal inactive until a direct approval resolution', async () => {
    const storage = new MemoryStorageArea()
    const repository = new CapabilityRepository(storage)
    const proposals = new ProposalRepository(storage)
    const coordinator = new ProposalCoordinator(repository, proposals, { now: () => 1000 })
    const definition = RepositoryTestFixtures.capability('https://shop.example', 1, VerificationStatus.Proposed)

    const pending = await coordinator.propose({ requestId: 'request-1', sessionId: 'session-1', definition, scope: { origin: 'https://shop.example', path: '/catalog' } })
    expect(pending.status).toBe(ProposalStatus.Pending)
    expect(await repository.getActive(definition.scope.origin, definition.name)).toBeNull()
    expect((await new ProposalCoordinator(repository, new ProposalRepository(storage), { now: () => 1001 }).listPending('https://shop.example')).map((record) => record.requestId)).toEqual(['request-1'])

    const approved = await coordinator.resolve({ requestId: 'request-1', approved: true })
    expect(approved.status).toBe(ProposalStatus.Approved)
    expect(await repository.getActive(definition.scope.origin, definition.name)).toBeNull()
  })
})
