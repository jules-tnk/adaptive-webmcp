import { JsonTypes, type JsonValue } from 'webmcp-capability-forge-core'

import { PanelSection } from '../sidepanel/state/panel-contracts'
import { JsonCodec } from './json-codec'
import type { StorageArea } from './storage-area'

enum StorageKey {
  PanelViews = 'webmcp-capability-forge:panel-views:v1',
}

export interface PanelViewState {
  readonly tabId: number
  readonly section: PanelSection
  readonly goal: string
}

export class PanelViewRepository {
  private readonly storage: StorageArea

  constructor(storage: StorageArea) {
    this.storage = storage
  }

  async save(view: PanelViewState): Promise<void> {
    const views = (await this.read()).filter((candidate) => candidate.tabId !== view.tabId)
    views.push(structuredClone(view))
    await this.write(views)
  }

  async get(tabId: number): Promise<PanelViewState | null> {
    const view = (await this.read()).find((candidate) => candidate.tabId === tabId)
    return view ? structuredClone(view) : null
  }

  async remove(tabId: number): Promise<void> {
    await this.write((await this.read()).filter((candidate) => candidate.tabId !== tabId))
  }

  private async read(): Promise<PanelViewState[]> {
    const stored = await this.storage.get(StorageKey.PanelViews)
    const value = stored[StorageKey.PanelViews]
    if (!Array.isArray(value)) return []
    return value.flatMap((item) => {
      const view = PanelViewRepository.parse(item)
      return view ? [view] : []
    })
  }

  private async write(views: readonly PanelViewState[]): Promise<void> {
    await this.storage.set(JsonCodec.object({ [StorageKey.PanelViews]: views }))
  }

  private static parse(value: JsonValue): PanelViewState | null {
    if (
      !JsonTypes.isObject(value) || typeof value.tabId !== 'number' ||
      typeof value.section !== 'string' ||
      !Object.values(PanelSection).includes(value.section as PanelSection) ||
      typeof value.goal !== 'string'
    ) return null
    return { tabId: value.tabId, section: value.section as PanelSection, goal: value.goal }
  }
}
