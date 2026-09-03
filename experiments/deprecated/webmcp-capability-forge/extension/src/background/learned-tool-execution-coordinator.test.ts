import { describe, expect, it } from 'vitest'

import {
  ExecutionStatus,
  FailureCode,
  VerificationStatus,
  type CapabilityDefinition,
  type ExecutionOutcome,
  type JsonObject,
} from 'webmcp-capability-forge-core'

import {
  CapabilityHealth,
  CapabilityRepository,
  CapabilityRevisionStatus,
} from '../storage/capability-repository'
import { ContinuationRepository } from '../storage/continuation-repository'
import { RepositoryTestFixtures } from '../storage/repository-test-fixtures'
import type { StorageArea } from '../storage/storage-area'
import {
  LearnedToolExecutionCoordinator,
  type LearnedToolExecutionPlatform,
} from './learned-tool-execution-coordinator'
import { RepairCoordinator } from './repair-coordinator'

class MemoryStorageArea implements StorageArea {
  private values: JsonObject = {}
  async get(): Promise<JsonObject> { return structuredClone(this.values) }
  async set(values: JsonObject): Promise<void> {
    this.values = { ...this.values, ...structuredClone(values) }
  }
}

class ExecutionPlatformFake implements LearnedToolExecutionPlatform {
  definition: CapabilityDefinition | null = null
  outcome: ExecutionOutcome = {
    executionId: 'execution-1', status: ExecutionStatus.Completed, completedSteps: 1, outputs: {},
  }
  async execute(
    _tabId: number,
    definition: CapabilityDefinition,
    _input: JsonObject,
  ): Promise<ExecutionOutcome> {
    this.definition = definition
    return this.outcome
  }
}

describe('LearnedToolExecutionCoordinator', () => {
  it('loads the active trusted definition by name and stores the outcome', async () => {
    const storage = new MemoryStorageArea()
    const capabilities = new CapabilityRepository(storage)
    const continuations = new ContinuationRepository(storage)
    const definition = RepositoryTestFixtures.capability('https://shop.example', 1, VerificationStatus.ReplayVerified)
    await capabilities.save(definition, CapabilityRevisionStatus.Active)
    const platform = new ExecutionPlatformFake()
    const coordinator = new LearnedToolExecutionCoordinator(
      capabilities, continuations, new RepairCoordinator(capabilities), platform,
    )

    const outcome = await coordinator.execute({
      tabId: 8, origin: 'https://shop.example', path: '/catalog',
      toolName: definition.name, input: {},
    })

    expect(outcome.status).toBe(ExecutionStatus.Completed)
    expect(platform.definition?.revision).toBe(1)
    expect((await continuations.getRecentOutcome(8))?.executionId).toBe('execution-1')
  })

  it('marks the active revision stale after a missing target failure', async () => {
    const storage = new MemoryStorageArea()
    const capabilities = new CapabilityRepository(storage)
    const continuations = new ContinuationRepository(storage)
    const definition = RepositoryTestFixtures.capability('https://shop.example', 1, VerificationStatus.ReplayVerified)
    await capabilities.save(definition, CapabilityRevisionStatus.Active)
    const platform = new ExecutionPlatformFake()
    platform.outcome = {
      executionId: 'execution-2', status: ExecutionStatus.Failed, completedSteps: 0,
      outputs: {}, failure: { code: FailureCode.TargetMissing, message: 'Target missing.', failedStep: 0 },
    }
    const coordinator = new LearnedToolExecutionCoordinator(
      capabilities, continuations, new RepairCoordinator(capabilities), platform,
    )

    await coordinator.execute({
      tabId: 8, origin: 'https://shop.example', path: '/catalog',
      toolName: definition.name, input: {},
    })

    expect((await capabilities.getRecord('https://shop.example', definition.name, 1))?.health).toBe(CapabilityHealth.Stale)
  })
})
