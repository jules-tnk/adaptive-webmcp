import { expect, type BrowserContext, type Page, type TestInfo } from '@playwright/test'

import { ForgeToolName } from 'webmcp-capability-forge-core'

import { ExtensionContextHarness } from './extension-context'
import { FakeAgent } from './fake-agent'
import { FakeModelContextInstaller } from './fake-model-context'
import { LabPage } from './lab-page'
import { SidePanelPage } from './side-panel-page'

export interface ScenarioPages {
  readonly context: BrowserContext
  readonly website: Page
  readonly lab: LabPage
  readonly sidePanel: SidePanelPage
}

export class TestScenario {
  static async open(testInfo: TestInfo): Promise<ScenarioPages> {
    const harness = await ExtensionContextHarness.launch(testInfo)
    await FakeModelContextInstaller.install(harness.context)
    const website = await harness.context.newPage()
    await website.goto('http://127.0.0.1:4181/lab/workflow')
    const sidePanelPage = await harness.context.newPage()
    await sidePanelPage.goto(`chrome-extension://${harness.extensionId}/sidepanel.html`)
    const sidePanel = new SidePanelPage(sidePanelPage)
    await sidePanel.enableSite()
    await expect.poll(() => FakeAgent.names(website)).toContain(ForgeToolName.Bootstrap)
    await expect(sidePanelPage.getByRole('heading', { name: 'Build a capability' })).toBeVisible()
    return {
      context: harness.context,
      website,
      lab: new LabPage(website),
      sidePanel,
    }
  }
}
