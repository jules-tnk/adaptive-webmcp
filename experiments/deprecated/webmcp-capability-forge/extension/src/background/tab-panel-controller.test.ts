import { describe, expect, it } from 'vitest'

import { SidePanelDocument, TabPanelController, type TabPanelPlatform } from './tab-panel-controller'

class FakeTabPanelPlatform implements TabPanelPlatform {
  actionBehaviors: boolean[] = []
  globalEnabled: boolean[] = []
  enabledTabs: number[] = []
  openedTabs: number[] = []
  blockEnable = false
  private releaseEnable: (() => void) | null = null

  async setActionBehavior(openOnClick: boolean): Promise<void> {
    this.actionBehaviors.push(openOnClick)
  }

  async setGlobalEnabled(enabled: boolean): Promise<void> {
    this.globalEnabled.push(enabled)
  }

  async enableTab(tabId: number, path: SidePanelDocument): Promise<void> {
    expect(path).toBe(SidePanelDocument.Main)
    this.enabledTabs.push(tabId)
    if (this.blockEnable) {
      await new Promise<void>((resolve) => {
        this.releaseEnable = resolve
      })
    }
  }

  async openTab(tabId: number): Promise<void> {
    this.openedTabs.push(tabId)
  }

  finishEnable(): void {
    this.releaseEnable?.()
  }
}

describe('TabPanelController', () => {
  it('disables global action behavior and global panel availability', async () => {
    const platform = new FakeTabPanelPlatform()
    const controller = new TabPanelController(platform)

    await controller.initialize()

    expect(platform.actionBehaviors).toEqual([false])
    expect(platform.globalEnabled).toEqual([false])
  })

  it('enables and opens one tab-specific panel from an action click', async () => {
    const platform = new FakeTabPanelPlatform()
    const controller = new TabPanelController(platform)

    await controller.open(42)

    expect(platform.enabledTabs).toEqual([42])
    expect(platform.openedTabs).toEqual([42])
  })

  it('starts opening before tab configuration settles so the user gesture is preserved', async () => {
    const platform = new FakeTabPanelPlatform()
    platform.blockEnable = true
    const controller = new TabPanelController(platform)

    const opening = controller.open(42)
    await Promise.resolve()

    expect(platform.openedTabs).toEqual([42])
    platform.finishEnable()
    await opening
  })
})
