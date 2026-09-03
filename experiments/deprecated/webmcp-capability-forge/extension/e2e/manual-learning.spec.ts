import { expect, test } from '@playwright/test'

import { LearningMode } from 'webmcp-capability-forge-core'

import { TestScenario } from './support/test-scenario'

test('records and saves a Manual workflow trace', async ({}, testInfo) => {
  const scenario = await TestScenario.open(testInfo)
  try {
    await scenario.sidePanel.start(LearningMode.Manual, 'Find and shortlist a notebook')
    await scenario.lab.completeCatalogWorkflow()
    await scenario.sidePanel.stop()
    await expect(scenario.sidePanel.page.getByRole('heading', { name: 'Review capability' })).toBeVisible()
    await expect(scenario.sidePanel.page.getByRole('heading', { name: 'Workflow steps' })).toBeVisible()
    await expect(scenario.sidePanel.page.getByText(/Human · [1-9]\d* events/)).toBeVisible()
    await expect(scenario.sidePanel.page.getByText(/"schemaVersion"/)).toHaveCount(0)
    await scenario.sidePanel.approvePending()
    await expect(scenario.sidePanel.page.getByRole('heading', { name: 'Saved tools' })).toBeVisible()
    await expect(scenario.sidePanel.page.getByText('Active', { exact: true })).toBeVisible()
    await expect(scenario.sidePanel.page.getByText('Rev. 1', { exact: true })).toBeVisible()
  } finally {
    await scenario.context.close()
  }
})

test('shows an actionable error when Stop cannot compile the trace', async ({}, testInfo) => {
  const scenario = await TestScenario.open(testInfo)
  try {
    await scenario.sidePanel.start(LearningMode.Manual, 'Empty workflow')
    await scenario.sidePanel.stop()

    await expect(scenario.sidePanel.page.getByRole('alert')).toContainText('recorded trace')
    await expect(scenario.sidePanel.page.getByText('collecting', { exact: true })).toBeVisible()
  } finally {
    await scenario.context.close()
  }
})

test('preserves raw typing evidence while reviewing a compacted workflow', async ({}, testInfo) => {
  const scenario = await TestScenario.open(testInfo)
  try {
    await scenario.website.getByLabel('Search catalog').evaluate((element) => {
      element.setAttribute('role', 'combobox')
    })
    await scenario.sidePanel.start(LearningMode.Manual, 'Search with a long typed query')
    await scenario.website.getByLabel('Search catalog').pressSequentially('notebook-notebook-notebook')
    await scenario.website.getByRole('button', { name: 'Search', exact: true }).click()
    await scenario.sidePanel.stop()

    await expect(scenario.sidePanel.page.getByRole('heading', { name: 'Review capability' })).toBeVisible()
    await expect(scenario.sidePanel.page.getByText(/\d+ raw events → \d+ compiled steps/)).toBeVisible()
  } finally {
    await scenario.context.close()
  }
})
