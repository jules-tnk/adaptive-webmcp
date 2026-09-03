import { expect, test } from '@playwright/test'

import { ExtensionContextHarness } from './support/extension-context'

test('restores the selected section and workflow goal when a panel is recreated', async ({}, testInfo) => {
  const harness = await ExtensionContextHarness.launch(testInfo)
  try {
    const website = await harness.context.newPage()
    await website.goto('http://127.0.0.1:4181/lab/workflow')

    const firstPanel = await harness.context.newPage()
    await firstPanel.goto(`chrome-extension://${harness.extensionId}/sidepanel.html`)
    await firstPanel.getByRole('button', { name: 'site', exact: true }).click()
    await expect(firstPanel.getByText('Enabled', { exact: true })).toBeVisible()
    await firstPanel.getByRole('button', { name: 'session', exact: true }).click()
    await firstPanel.getByLabel('Workflow goal').fill('Preserve this exact goal')
    await firstPanel.getByRole('button', { name: 'evidence', exact: true }).click()
    await firstPanel.close()

    const reopenedPanel = await harness.context.newPage()
    await reopenedPanel.goto(`chrome-extension://${harness.extensionId}/sidepanel.html`)
    await expect(reopenedPanel.getByRole('button', { name: 'evidence', exact: true })).toHaveClass(/active/)
    await reopenedPanel.getByRole('button', { name: 'session', exact: true }).click()
    await expect(reopenedPanel.getByLabel('Workflow goal')).toHaveValue('Preserve this exact goal')
  } finally {
    await harness.context.close()
  }
})
