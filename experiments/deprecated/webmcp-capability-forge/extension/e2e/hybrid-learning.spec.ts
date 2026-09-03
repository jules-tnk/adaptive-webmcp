import { expect, test } from '@playwright/test'

import {
  BootstrapOperation,
  ForgeToolName,
  JsonTypes,
  LearningMode,
  WorkflowAction,
} from 'webmcp-capability-forge-core'

import { FakeAgent } from './support/fake-agent'
import { TestScenario } from './support/test-scenario'

test('combines Manual recording with Automatic exploration availability', async ({}, testInfo) => {
  const scenario = await TestScenario.open(testInfo)
  try {
    await scenario.sidePanel.start(LearningMode.Manual, 'Build a catalog workflow together')
    await scenario.website.getByLabel('Search catalog').fill('notebook')
    const protocol = await FakeAgent.invoke(scenario.website, ForgeToolName.Bootstrap, {
      operation: BootstrapOperation.Inspect,
    })
    if (!JsonTypes.isObject(protocol) || !JsonTypes.isObject(protocol.session) || typeof protocol.session.id !== 'string') {
      throw new Error('Active Manual session was not visible to the agent.')
    }
    await FakeAgent.invoke(scenario.website, ForgeToolName.Bootstrap, {
      operation: BootstrapOperation.JoinSession,
      sessionId: protocol.session.id,
    })
    await expect.poll(() => FakeAgent.names(scenario.website)).toContain(ForgeToolName.InspectPage)
    const inspection = await FakeAgent.invoke(scenario.website, ForgeToolName.InspectPage, {})
    if (!JsonTypes.isObject(inspection) || !Array.isArray(inspection.targets)) {
      throw new Error('Agent inspection was unavailable.')
    }
    const search = inspection.targets.find((target) => JsonTypes.isObject(target) && target.name === 'Search catalog')
    if (!JsonTypes.isObject(search) || !JsonTypes.isObject(search.handle)) {
      throw new Error('Search target was unavailable.')
    }
    await FakeAgent.invoke(scenario.website, ForgeToolName.Interact, {
      action: WorkflowAction.Fill,
      handle: search.handle,
      value: 'notebook',
    })
    await FakeAgent.invoke(scenario.website, ForgeToolName.ProposeWorkflow, {})
    await expect(scenario.sidePanel.page.getByRole('heading', { name: 'Review capability' })).toBeVisible()
    await expect(scenario.sidePanel.page.getByText(/Human · [1-9]\d* events?/)).toBeVisible()
    await expect(scenario.sidePanel.page.getByText('Agent · 1 event', { exact: true })).toBeVisible()
    await expect(scenario.sidePanel.page.getByText('Trace mode · hybrid', { exact: true })).toBeVisible()
  } finally {
    await scenario.context.close()
  }
})
