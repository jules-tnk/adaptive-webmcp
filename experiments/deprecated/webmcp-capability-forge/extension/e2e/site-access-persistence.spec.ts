import { expect, test } from '@playwright/test'

import { ExtensionContextHarness } from './support/extension-context'
import { FakeModelContextInstaller } from './support/fake-model-context'

test('keeps site access enabled after the side panel is closed and reopened', async ({}, testInfo) => {
  const harness = await ExtensionContextHarness.launch(testInfo)
  try {
    await FakeModelContextInstaller.install(harness.context)
    const website = await harness.context.newPage()
    await website.goto('http://127.0.0.1:4181/lab/workflow')

    const firstPanel = await harness.context.newPage()
    await firstPanel.goto(`chrome-extension://${harness.extensionId}/sidepanel.html#site`)
    await expect(firstPanel.getByText('Enabled', { exact: true })).toBeVisible()
    await firstPanel.close()

    const reopenedPanel = await harness.context.newPage()
    await reopenedPanel.goto(`chrome-extension://${harness.extensionId}/sidepanel.html#site`)
    await expect(reopenedPanel.getByText('Enabled', { exact: true })).toBeVisible()
    await reopenedPanel.getByRole('button', { name: 'session', exact: true }).click()
    await reopenedPanel.getByLabel('Workflow goal').fill('Find and shortlist a notebook')
    await expect(reopenedPanel.getByRole('button', { name: 'Teach a workflow' })).toBeEnabled()
    await expect(reopenedPanel.getByRole('button', { name: 'Let the agent explore' })).toHaveCount(0)
    await expect(reopenedPanel.getByRole('button', { name: 'Build together' })).toHaveCount(0)
  } finally {
    await harness.context.close()
  }
})
