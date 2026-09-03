import { describe, expect, it } from 'vitest'

import {
  InteractionEffect,
  WorkflowAction,
  type JsonObject,
} from 'webmcp-capability-forge-core'

import { ConfirmationRepository, ConfirmationStatus } from '../storage/confirmation-repository'
import type { StorageArea } from '../storage/storage-area'
import { ConfirmationCoordinator } from './confirmation-coordinator'

class MemoryStorageArea implements StorageArea {
  private values: JsonObject = {}
  async get(): Promise<JsonObject> { return structuredClone(this.values) }
  async set(values: JsonObject): Promise<void> { this.values = { ...this.values, ...structuredClone(values) } }
}

describe('ConfirmationCoordinator', () => {
  it('consumes only a matching extension-approved request once', async () => {
    const coordinator = new ConfirmationCoordinator(
      new ConfirmationRepository(new MemoryStorageArea()),
      { now: () => 10, createId: () => 'confirmation-1' },
    )
    const record = await coordinator.create({
      tabId: 4, origin: 'https://shop.example', path: '/catalog',
      action: WorkflowAction.Click, effect: InteractionEffect.Navigation, target: 'target-2',
    })

    expect(await coordinator.consume({ ...record, requestId: record.requestId })).toBe(false)
    await coordinator.resolve(record.requestId, true)
    expect(await coordinator.consume({ ...record, requestId: record.requestId })).toBe(true)
    expect(await coordinator.consume({ ...record, requestId: record.requestId })).toBe(false)
    expect((await coordinator.get(record.requestId))?.status).toBe(ConfirmationStatus.Consumed)
  })
})
