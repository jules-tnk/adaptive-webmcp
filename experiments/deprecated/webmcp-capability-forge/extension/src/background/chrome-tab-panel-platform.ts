import { type SidePanelDocument, type TabPanelPlatform } from './tab-panel-controller'

export class ChromeTabPanelPlatform implements TabPanelPlatform {
  setActionBehavior(openOnClick: boolean): Promise<void> {
    return chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: openOnClick })
  }

  setGlobalEnabled(enabled: boolean): Promise<void> {
    return chrome.sidePanel.setOptions({ enabled })
  }

  enableTab(tabId: number, path: SidePanelDocument): Promise<void> {
    return chrome.sidePanel.setOptions({ tabId, path, enabled: true })
  }

  openTab(tabId: number): Promise<void> {
    return chrome.sidePanel.open({ tabId })
  }
}
