import { describe, expect, it } from 'vitest'

import { ExecutionStatus, FailureCode, type ExecutionCheckpoint, type ExecutionOutcome, type JsonObject, type PageReadyEvent } from 'webmcp-capability-forge-core'

import { ExecutionCoordinator, type ExecutionResumePlatform } from './execution-coordinator'
import { ContinuationRepository } from '../storage/continuation-repository'
import type { StorageArea } from '../storage/storage-area'

class MemoryStorageArea implements StorageArea {
  private values: JsonObject = {}
  async get(): Promise<JsonObject> { return structuredClone(this.values) }
  async set(values: JsonObject): Promise<void> { this.values = { ...this.values, ...structuredClone(values) } }
}

class ResumePlatform implements ExecutionResumePlatform {
  async resume(checkpoint: ExecutionCheckpoint, _event: PageReadyEvent): Promise<ExecutionOutcome> {
    return { executionId: checkpoint.executionId, status: ExecutionStatus.Completed, completedSteps: 4, outputs: {} }
  }
}

describe('ExecutionCoordinator', () => {
  it('resumes a matching same-origin checkpoint and stores its outcome', async () => {
    const repository = new ContinuationRepository(new MemoryStorageArea())
    const coordinator = new ExecutionCoordinator(repository, new ResumePlatform())
    const checkpoint: ExecutionCheckpoint = {
      executionId: 'execution-1', tabId: 10, origin: 'https://shop.example', expectedPath: '/results',
      capabilityName: 'find_item', capabilityRevision: 1, nextStep: 2, input: {}, expiresAt: 5000,
    }
    await coordinator.checkpoint(checkpoint)

    const outcome = await coordinator.resume({ tabId: 10, origin: 'https://shop.example', path: '/results', timestamp: 2000 })

    expect(outcome.status).toBe(ExecutionStatus.Completed)
    expect(await coordinator.recentOutcome(10)).toEqual(outcome)
  })

  it('rejects a continuation on another origin', async () => {
    const repository = new ContinuationRepository(new MemoryStorageArea())
    const coordinator = new ExecutionCoordinator(repository, new ResumePlatform())
    await coordinator.checkpoint({ executionId: 'execution-2', tabId: 10, origin: 'https://shop.example', expectedPath: '/results', capabilityName: 'find_item', capabilityRevision: 1, nextStep: 2, input: {}, expiresAt: 5000 })

    const outcome = await coordinator.resume({ tabId: 10, origin: 'https://other.example', path: '/results', timestamp: 2000 })

    expect(outcome.status).toBe(ExecutionStatus.Failed)
    expect(outcome.failure?.code).toBe(FailureCode.RouteMismatch)
  })
})
