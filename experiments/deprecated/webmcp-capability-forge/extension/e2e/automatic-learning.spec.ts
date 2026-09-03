import { expect, test } from '@playwright/test'

import {
  ForgeToolName,
  BootstrapOperation,
  JsonTypes,
  WorkflowAction,
} from 'webmcp-capability-forge-core'

import { FakeAgent } from './support/fake-agent'
import { TestScenario } from './support/test-scenario'

test('exposes bounded inspection and interaction tools during Automatic learning', async ({}, testInfo) => {
  const scenario = await TestScenario.open(testInfo)
  try {
    await expect.poll(() => FakeAgent.names(scenario.website)).toContain(ForgeToolName.Bootstrap)
    await FakeAgent.invoke(scenario.website, ForgeToolName.Bootstrap, {
      operation: BootstrapOperation.BeginSession,
      goal: 'Fill the catalog search',
    })
    await expect.poll(() => FakeAgent.names(scenario.website)).toContain(ForgeToolName.InspectPage)
    const inspection = await FakeAgent.invoke(scenario.website, ForgeToolName.InspectPage, {})
    expect(JSON.stringify(inspection)).toContain('Search catalog')
    if (!JsonTypes.isObject(inspection) || !Array.isArray(inspection.targets)) {
      throw new Error('Page inspection did not return targets.')
    }
    const queryTarget = inspection.targets.find(
      (candidate) => JsonTypes.isObject(candidate) && candidate.name === 'Search catalog',
    )
    if (!JsonTypes.isObject(queryTarget) || !JsonTypes.isObject(queryTarget.handle)) {
      throw new Error('Search target handle is missing.')
    }
    await FakeAgent.invoke(scenario.website, ForgeToolName.Interact, {
      action: WorkflowAction.Fill,
      handle: queryTarget.handle,
      value: 'notebook',
      confirmed: false,
    })
    await expect(scenario.website.getByLabel('Search catalog')).toHaveValue('notebook')
    await FakeAgent.invoke(scenario.website, ForgeToolName.ProposeWorkflow, {})
    await expect(scenario.sidePanel.page.getByRole('heading', { name: 'Review capability' })).toBeVisible()
    await expect(scenario.sidePanel.page.getByText('Agent · 1 event', { exact: true })).toBeVisible()
    await scenario.sidePanel.approvePending()
    await expect(scenario.sidePanel.page.getByText('Active', { exact: true })).toBeVisible()
    const learnedTool = 'fill_the_catalog_search'
    await expect.poll(() => FakeAgent.names(scenario.website)).toContain(learnedTool)
    await scenario.website.getByLabel('Search catalog').fill('')
    await FakeAgent.invoke(scenario.website, learnedTool, { input_1: 'notebook' })
    await expect(scenario.website.getByLabel('Search catalog')).toHaveValue('notebook')
    await scenario.website.reload()
    await expect.poll(() => FakeAgent.names(scenario.website)).toContain(learnedTool)
    await scenario.website.getByLabel('Search catalog').fill('')
    await FakeAgent.invoke(scenario.website, learnedTool, { input_1: 'restored' })
    await expect(scenario.website.getByLabel('Search catalog')).toHaveValue('restored')
  } finally {
    await scenario.context.close()
  }
})
