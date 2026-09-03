import { expect, test } from '@playwright/test'

import { ExtensionContextHarness } from './support/extension-context'

test('opens the side panel from the toolbar action without a popup', async ({}, testInfo) => {
  const harness = await ExtensionContextHarness.launch(testInfo)
  try {
    const worker = harness.context.serviceWorkers()[0]
    expect(worker).toBeDefined()
    const popup = await worker?.evaluate(() => chrome.runtime.getManifest().action?.default_popup)
    expect(popup).toBeUndefined()
    const permissions = await worker?.evaluate(() => chrome.runtime.getManifest().permissions ?? [])
    expect(permissions).not.toContain('activeTab')
    await expect.poll(() => worker?.evaluate(async () => (
      await chrome.sidePanel.getPanelBehavior()
    ).openPanelOnActionClick)).toBe(false)
    await expect.poll(() => worker?.evaluate(async () => (
      await chrome.sidePanel.getOptions({})
    ).enabled)).toBe(false)
  } finally {
    await harness.context.close()
  }
})
