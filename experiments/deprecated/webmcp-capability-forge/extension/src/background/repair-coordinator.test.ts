import { describe, expect, it } from 'vitest'

import { FailureCode, VerificationStatus, type JsonObject } from 'webmcp-capability-forge-core'

import { RepairCoordinator } from './repair-coordinator'
import { CapabilityRevisionStatus, CapabilityRepository, CapabilityHealth } from '../storage/capability-repository'
import { RepositoryTestFixtures } from '../storage/repository-test-fixtures'
import type { StorageArea } from '../storage/storage-area'

class MemoryStorageArea implements StorageArea {
  private values: JsonObject = {}
  async get(): Promise<JsonObject> { return structuredClone(this.values) }
  async set(values: JsonObject): Promise<void> { this.values = { ...this.values, ...structuredClone(values) } }
}

describe('RepairCoordinator', () => {
  it('records stale health and preserves the active revision when replacement fails', async () => {
    const repository = new CapabilityRepository(new MemoryStorageArea())
    const first = RepositoryTestFixtures.capability('https://shop.example', 1, VerificationStatus.ReplayVerified)
    const replacement = RepositoryTestFixtures.capability('https://shop.example', 2, VerificationStatus.Failed)
    await repository.save(first, CapabilityRevisionStatus.Active)
    const coordinator = new RepairCoordinator(repository)

    await coordinator.recordFailure({ origin: first.scope.origin, name: first.name, revision: 1, code: FailureCode.StaleRevision, message: 'Target missing.', failedStep: 0 })
    await coordinator.saveFailedReplacement(replacement)

    expect((await repository.getRecord(first.scope.origin, first.name, 1))?.health).toBe(CapabilityHealth.Stale)
    expect((await repository.getActive(first.scope.origin, first.name))?.revision).toBe(1)
  })
})
