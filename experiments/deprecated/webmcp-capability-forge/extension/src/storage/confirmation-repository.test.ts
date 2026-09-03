import { describe, expect, it } from 'vitest'

import {
  InteractionEffect,
  WorkflowAction,
  type JsonObject,
} from 'webmcp-capability-forge-core'

import {
  ConfirmationRepository,
  ConfirmationStatus,
  type ConfirmationRecord,
} from './confirmation-repository'
import type { StorageArea } from './storage-area'

class MemoryStorageArea implements StorageArea {
  private values: JsonObject = {}
  async get(): Promise<JsonObject> { return structuredClone(this.values) }
  async set(values: JsonObject): Promise<void> {
    this.values = { ...this.values, ...structuredClone(values) }
  }
}

class ConfirmationFixtures {
  static record(): ConfirmationRecord {
    return {
      requestId: 'confirmation-1',
      tabId: 4,
      origin: 'https://shop.example',
      path: '/catalog',
      action: WorkflowAction.Click,
      effect: InteractionEffect.Navigation,
      target: 'Search',
      status: ConfirmationStatus.Pending,
      createdAt: 10,
      expiresAt: 100,
    }
  }
}

describe('ConfirmationRepository', () => {
  it('survives a new repository instance and excludes resolved requests from pending', async () => {
    const storage = new MemoryStorageArea()
    await new ConfirmationRepository(storage).save(ConfirmationFixtures.record())

    const restored = new ConfirmationRepository(storage)
    expect(await restored.listPending('https://shop.example')).toHaveLength(1)
    await restored.resolve('confirmation-1', ConfirmationStatus.Approved)

    expect(await restored.listPending('https://shop.example')).toHaveLength(0)
    expect((await restored.get('confirmation-1'))?.status).toBe(ConfirmationStatus.Approved)
  })
})
