import { describe, expect, it } from 'vitest'

import {
  CapabilityClassification,
  ExecutionStatus,
  VerificationStatus,
  type CapabilityDefinition,
  type ExecutionOutcome,
  type JsonObject,
} from 'webmcp-capability-forge-core'

import { VerificationCoordinator, type VerificationPlatform } from './verification-coordinator'
import { CapabilityRepository } from '../storage/capability-repository'
import { RepositoryTestFixtures } from '../storage/repository-test-fixtures'
import type { StorageArea } from '../storage/storage-area'

class MemoryStorageArea implements StorageArea {
  private values: JsonObject = {}
  async get(): Promise<JsonObject> { return structuredClone(this.values) }
  async set(values: JsonObject): Promise<void> { this.values = { ...this.values, ...structuredClone(values) } }
}

class VerificationPlatformFake implements VerificationPlatform {
  replayCalls = 0
  replayInput: JsonObject = {}
  async preflight(): Promise<{ readonly ready: boolean; readonly input: JsonObject }> {
    return { ready: true, input: { fixture: 'value' } }
  }
  async replay(definition: CapabilityDefinition, input: JsonObject): Promise<ExecutionOutcome> {
    this.replayCalls += 1
    this.replayInput = input
    return { executionId: 'verify-1', status: ExecutionStatus.Completed, completedSteps: definition.steps.length, outputs: {} }
  }
}

describe('VerificationCoordinator', () => {
  it('replay-verifies and activates a safe capability', async () => {
    const repository = new CapabilityRepository(new MemoryStorageArea())
    const platform = new VerificationPlatformFake()
    const coordinator = new VerificationCoordinator(repository, platform)
    const definition = RepositoryTestFixtures.capability('https://shop.example', 1, VerificationStatus.Proposed)

    const result = await coordinator.verify({ definition })

    expect(result.status).toBe(VerificationStatus.ReplayVerified)
    expect(result.attempts).toHaveLength(1)
    expect(platform.replayInput).toEqual({ fixture: 'value' })
    expect((await repository.getActive(definition.scope.origin, definition.name))?.revision).toBe(1)
  })

  it('structurally verifies external-write tools without replaying them', async () => {
    const repository = new CapabilityRepository(new MemoryStorageArea())
    const platform = new VerificationPlatformFake()
    const coordinator = new VerificationCoordinator(repository, platform)
    const definition: CapabilityDefinition = {
      ...RepositoryTestFixtures.capability('https://shop.example', 1, VerificationStatus.Proposed),
      classification: CapabilityClassification.ExternalWrite,
    }

    const result = await coordinator.verify({ definition })

    expect(result.status).toBe(VerificationStatus.ReviewedNotReplayVerified)
    expect(platform.replayCalls).toBe(0)
  })
})
