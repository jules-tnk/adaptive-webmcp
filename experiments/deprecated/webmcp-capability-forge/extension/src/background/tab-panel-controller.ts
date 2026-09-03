export enum SidePanelDocument {
  Main = 'sidepanel.html',
}

export interface TabPanelPlatform {
  setActionBehavior(openOnClick: boolean): Promise<void>
  setGlobalEnabled(enabled: boolean): Promise<void>
  enableTab(tabId: number, path: SidePanelDocument): Promise<void>
  openTab(tabId: number): Promise<void>
}

export class TabPanelController {
  private readonly platform: TabPanelPlatform

  constructor(platform: TabPanelPlatform) {
    this.platform = platform
  }

  async initialize(): Promise<void> {
    await this.platform.setActionBehavior(false)
    await this.platform.setGlobalEnabled(false)
  }

  async open(tabId: number): Promise<void> {
    const configuring = this.platform.enableTab(tabId, SidePanelDocument.Main)
    const opening = this.platform.openTab(tabId)
    await Promise.all([configuring, opening])
  }
}
