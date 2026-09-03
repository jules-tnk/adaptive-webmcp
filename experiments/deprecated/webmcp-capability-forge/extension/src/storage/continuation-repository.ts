import {
  ExecutionStatus,
  JsonTypes,
  type ExecutionCheckpoint,
  type ExecutionOutcome,
  type JsonObject,
  type JsonValue,
} from 'webmcp-capability-forge-core'

import { JsonCodec } from './json-codec'
import type { StorageArea } from './storage-area'

enum StorageKey {
  Continuations = 'webmcp-capability-forge:continuations:v1',
}

enum StateField {
  Checkpoints = 'checkpoints',
  Outcomes = 'outcomes',
}

export class ContinuationRepository {
  private readonly storage: StorageArea

  constructor(storage: StorageArea) {
    this.storage = storage
  }

  async saveCheckpoint(checkpoint: ExecutionCheckpoint): Promise<void> {
    const state = await this.state()
    const checkpoints = ContinuationRepository.field(state, StateField.Checkpoints)
    await this.write({ ...state, [StateField.Checkpoints]: { ...checkpoints, [checkpoint.tabId]: JsonCodec.value(checkpoint) } })
  }

  async getCheckpoint(tabId: number): Promise<ExecutionCheckpoint | null> {
    const state = await this.state()
    return ContinuationRepository.checkpoint(
      ContinuationRepository.field(state, StateField.Checkpoints)[String(tabId)],
    )
  }

  async removeCheckpoint(tabId: number): Promise<void> {
    const state = await this.state()
    const checkpoints = { ...ContinuationRepository.field(state, StateField.Checkpoints) }
    delete checkpoints[String(tabId)]
    await this.write({ ...state, [StateField.Checkpoints]: checkpoints })
  }

  async saveOutcome(tabId: number, outcome: ExecutionOutcome): Promise<void> {
    const state = await this.state()
    const outcomes = ContinuationRepository.field(state, StateField.Outcomes)
    await this.write({ ...state, [StateField.Outcomes]: { ...outcomes, [tabId]: JsonCodec.value(outcome) } })
  }

  async getRecentOutcome(tabId: number): Promise<ExecutionOutcome | null> {
    const state = await this.state()
    return ContinuationRepository.outcome(
      ContinuationRepository.field(state, StateField.Outcomes)[String(tabId)],
    )
  }

  private async state(): Promise<JsonObject> {
    const stored = await this.storage.get(StorageKey.Continuations)
    const value = stored[StorageKey.Continuations]
    return JsonTypes.isObject(value)
      ? value
      : { [StateField.Checkpoints]: {}, [StateField.Outcomes]: {} }
  }

  private async write(state: JsonObject): Promise<void> {
    await this.storage.set({ [StorageKey.Continuations]: state })
  }

  private static field(state: JsonObject, field: StateField): JsonObject {
    const value = state[field]
    return JsonTypes.isObject(value) ? value : {}
  }

  private static checkpoint(value: JsonValue | undefined): ExecutionCheckpoint | null {
    if (!JsonTypes.isObject(value)) return null
    if (
      typeof value.executionId !== 'string' || typeof value.tabId !== 'number' ||
      typeof value.origin !== 'string' || typeof value.expectedPath !== 'string' ||
      typeof value.capabilityName !== 'string' || typeof value.capabilityRevision !== 'number' ||
      typeof value.nextStep !== 'number' || !JsonTypes.isObject(value.input) ||
      typeof value.expiresAt !== 'number'
    ) return null
    return {
      executionId: value.executionId, tabId: value.tabId, origin: value.origin,
      expectedPath: value.expectedPath, capabilityName: value.capabilityName,
      capabilityRevision: value.capabilityRevision, nextStep: value.nextStep,
      input: value.input, expiresAt: value.expiresAt,
    }
  }

  private static outcome(value: JsonValue | undefined): ExecutionOutcome | null {
    if (!JsonTypes.isObject(value)) return null
    if (
      typeof value.executionId !== 'string' || typeof value.status !== 'string' ||
      !Object.values(ExecutionStatus).includes(value.status as ExecutionStatus) ||
      typeof value.completedSteps !== 'number' || !JsonTypes.isObject(value.outputs)
    ) return null
    return {
      executionId: value.executionId,
      status: value.status as ExecutionStatus,
      completedSteps: value.completedSteps,
      outputs: value.outputs,
      ...(JsonTypes.isObject(value.failure)
        ? { failure: {
            code: value.failure.code as import('webmcp-capability-forge-core').FailureCode,
            message: String(value.failure.message ?? ''),
            ...(typeof value.failure.failedStep === 'number' ? { failedStep: value.failure.failedStep } : {}),
          } }
        : {}),
    }
  }
}
