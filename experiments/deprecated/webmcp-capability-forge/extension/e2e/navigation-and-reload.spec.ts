import { expect, test } from '@playwright/test'

import { ForgeToolName, LearningMode } from 'webmcp-capability-forge-core'

import { FakeAgent } from './support/fake-agent'
import { TestScenario } from './support/test-scenario'

test('restores bootstrap registration after same-origin navigation and reload', async ({}, testInfo) => {
  const scenario = await TestScenario.open(testInfo)
  try {
    await scenario.website.getByRole('link', { name: 'Open with SPA navigation' }).click()
    await expect(scenario.website).toHaveURL(/\/lab\/results$/)
    await scenario.website.reload()
    await expect.poll(() => FakeAgent.names(scenario.website)).toContain(ForgeToolName.Bootstrap)
  } finally {
    await scenario.context.close()
  }
})

test('resumes a Manual session after full-document navigation and reaches Review', async ({}, testInfo) => {
  const scenario = await TestScenario.open(testInfo)
  try {
    await scenario.sidePanel.start(LearningMode.Manual, 'Open the lab results page')
    await scenario.website.getByRole('link', { name: 'Open with full-document navigation' }).click()
    await expect(scenario.website).toHaveURL(/\/lab\/results$/)
    await scenario.sidePanel.stop()

    await expect(scenario.sidePanel.page.getByRole('heading', { name: 'Review capability' })).toBeVisible()
    await expect(scenario.sidePanel.page.getByText('Wait for route', { exact: true })).toBeVisible()
  } finally {
    await scenario.context.close()
  }
})
