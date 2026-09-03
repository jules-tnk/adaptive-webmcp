import { describe, expect, it } from 'vitest'

import type { JsonObject } from 'webmcp-capability-forge-core'

import { PanelSection } from '../sidepanel/state/panel-contracts'
import { PanelViewRepository } from './panel-view-repository'
import type { StorageArea } from './storage-area'

class MemoryStorageArea implements StorageArea {
  private values: JsonObject = {}

  async get(): Promise<JsonObject> {
    return structuredClone(this.values)
  }

  async set(values: JsonObject): Promise<void> {
    this.values = { ...this.values, ...structuredClone(values) }
  }
}

describe('PanelViewRepository', () => {
  it('isolates and restores the selected section and goal by tab', async () => {
    const repository = new PanelViewRepository(new MemoryStorageArea())
    await repository.save({ tabId: 10, section: PanelSection.Evidence, goal: 'Goal for A' })
    await repository.save({ tabId: 11, section: PanelSection.Tools, goal: 'Goal for B' })

    expect(await repository.get(10)).toEqual({
      tabId: 10,
      section: PanelSection.Evidence,
      goal: 'Goal for A',
    })
    expect(await repository.get(11)).toEqual({
      tabId: 11,
      section: PanelSection.Tools,
      goal: 'Goal for B',
    })
  })

  it('removes view state when its tab closes', async () => {
    const repository = new PanelViewRepository(new MemoryStorageArea())
    await repository.save({ tabId: 10, section: PanelSection.Review, goal: 'Review A' })

    await repository.remove(10)

    expect(await repository.get(10)).toBeNull()
  })
})
