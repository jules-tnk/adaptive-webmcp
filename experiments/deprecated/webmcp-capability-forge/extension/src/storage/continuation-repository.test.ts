import { describe, expect, it } from 'vitest'

import { ExecutionStatus, type ExecutionCheckpoint, type ExecutionOutcome, type JsonObject } from 'webmcp-capability-forge-core'

import { ContinuationRepository } from './continuation-repository'
import type { StorageArea } from './storage-area'

class MemoryStorageArea implements StorageArea {
  private values: JsonObject = {}
  async get(): Promise<JsonObject> { return structuredClone(this.values) }
  async set(values: JsonObject): Promise<void> { this.values = { ...this.values, ...structuredClone(values) } }
}

describe('ContinuationRepository', () => {
  it('stores a checkpoint and exposes the recent outcome after navigation', async () => {
    const repository = new ContinuationRepository(new MemoryStorageArea())
    const checkpoint: ExecutionCheckpoint = {
      executionId: 'execution-1', tabId: 10, origin: 'https://shop.example', expectedPath: '/results',
      capabilityName: 'find_item', capabilityRevision: 1, nextStep: 2, input: {}, expiresAt: 5000,
    }
    const outcome: ExecutionOutcome = {
      executionId: 'execution-1', status: ExecutionStatus.Completed, completedSteps: 3, outputs: {},
    }

    await repository.saveCheckpoint(checkpoint)
    expect(await repository.getCheckpoint(10)).toEqual(checkpoint)
    await repository.saveOutcome(10, outcome)
    expect(await repository.getRecentOutcome(10)).toEqual(outcome)
  })
})
