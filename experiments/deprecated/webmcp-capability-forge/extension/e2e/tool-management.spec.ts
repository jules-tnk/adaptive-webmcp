import { expect, test } from '@playwright/test'

import {
  BootstrapOperation,
  ForgeToolName,
  JsonTypes,
  WorkflowAction,
} from 'webmcp-capability-forge-core'

import { FakeAgent } from './support/fake-agent'
import { TestScenario } from './support/test-scenario'

test('disables, enables, exports, deletes, and reviews an imported tool', async ({}, testInfo) => {
  const scenario = await TestScenario.open(testInfo)
  try {
    const learnedTool = 'manage_search_box'
    await FakeAgent.invoke(scenario.website, ForgeToolName.Bootstrap, {
      operation: BootstrapOperation.BeginSession,
      goal: 'Manage search box',
    })
    await expect.poll(() => FakeAgent.names(scenario.website)).toContain(ForgeToolName.InspectPage)
    const inspection = await FakeAgent.invoke(scenario.website, ForgeToolName.InspectPage, {})
    if (!JsonTypes.isObject(inspection) || !Array.isArray(inspection.targets)) {
      throw new Error('Page inspection did not return targets.')
    }
    const search = inspection.targets.find(
      (candidate) => JsonTypes.isObject(candidate) && candidate.name === 'Search catalog',
    )
    if (!JsonTypes.isObject(search) || !JsonTypes.isObject(search.handle)) {
      throw new Error('Search target is missing.')
    }
    await FakeAgent.invoke(scenario.website, ForgeToolName.Interact, {
      action: WorkflowAction.Fill, handle: search.handle, value: 'notebook',
    })
    await FakeAgent.invoke(scenario.website, ForgeToolName.ProposeWorkflow, {})
    await scenario.sidePanel.approvePending()
    await expect.poll(() => FakeAgent.names(scenario.website)).toContain(learnedTool)

    const toolSummary = scenario.sidePanel.page.locator('summary').filter({ hasText: 'Manage search box' })
    await expect(toolSummary).toBeVisible()
    await toolSummary.click()
    await expect(scenario.sidePanel.page.getByRole('heading', { name: 'Workflow steps' })).toBeVisible()
    await expect(scenario.sidePanel.page.getByText(/"schemaVersion"/)).toHaveCount(0)
    await expect(scenario.sidePanel.page.locator('.tool-expanded > .tool-actions + .tool-lifecycle')).toHaveCount(1)
    const actionHeight = await scenario.sidePanel.page.getByRole('button', { name: 'Disable', exact: true }).evaluate(
      (element) => getComputedStyle(element).minHeight,
    )
    expect(actionHeight).toBe('30px')

    await scenario.sidePanel.page.getByRole('button', { name: 'Disable', exact: true }).click()
    await expect(scenario.sidePanel.page.getByText('Disabled', { exact: true })).toBeVisible()
    await expect.poll(() => FakeAgent.names(scenario.website)).not.toContain(learnedTool)
    await scenario.sidePanel.page.getByRole('button', { name: 'Enable', exact: true }).click()
    await expect(scenario.sidePanel.page.getByText('Active', { exact: true })).toBeVisible()
    await expect.poll(() => FakeAgent.names(scenario.website)).toContain(learnedTool)

    await scenario.context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await scenario.sidePanel.page.getByRole('button', { name: 'Copy export' }).click()
    const exported = await scenario.sidePanel.page.evaluate(() => navigator.clipboard.readText())
    expect(exported).toContain('webmcp-capability-forge-toolpack')

    scenario.sidePanel.page.once('dialog', (dialog) => dialog.accept())
    await scenario.sidePanel.page.getByRole('button', { name: 'Remove tool…' }).click()
    await expect(scenario.sidePanel.page.getByText('No learned tools')).toBeVisible()
    await expect.poll(() => FakeAgent.names(scenario.website)).not.toContain(learnedTool)

    scenario.sidePanel.page.once('dialog', (dialog) => dialog.accept(exported))
    await scenario.sidePanel.page.getByRole('button', { name: 'Import reviewed tool pack' }).click()
    await expect(scenario.sidePanel.page.getByRole('heading', { name: 'Review capability' })).toBeVisible()
    await scenario.sidePanel.approvePending()
    await expect(scenario.sidePanel.page.getByText('Active', { exact: true })).toBeVisible()
    await expect.poll(() => FakeAgent.names(scenario.website)).toContain(learnedTool)
  } finally {
    await scenario.context.close()
  }
})
