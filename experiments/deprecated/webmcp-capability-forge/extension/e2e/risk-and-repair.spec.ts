import { expect, test } from '@playwright/test'

import {
  BootstrapOperation,
  FailureCode,
  ForgeToolName,
  InteractionEffect,
  JsonTypes,
  WorkflowAction,
  type JsonValue,
} from 'webmcp-capability-forge-core'

import { FakeAgent } from './support/fake-agent'
import { TestScenario, type ScenarioPages } from './support/test-scenario'

class RepairJourney {
  static async begin(scenario: ScenarioPages, goal: string): Promise<void> {
    await expect.poll(() => FakeAgent.names(scenario.website)).toContain(ForgeToolName.Bootstrap)
    await FakeAgent.invoke(scenario.website, ForgeToolName.Bootstrap, {
      operation: BootstrapOperation.BeginSession,
      goal,
    })
    await expect.poll(() => FakeAgent.names(scenario.website)).toContain(ForgeToolName.InspectPage)
  }

  static async fillSearch(scenario: ScenarioPages, value: string): Promise<void> {
    const inspection = await FakeAgent.invoke(scenario.website, ForgeToolName.InspectPage, {})
    if (!JsonTypes.isObject(inspection) || !Array.isArray(inspection.targets)) {
      throw new Error('Page inspection did not return targets.')
    }
    const target = inspection.targets.find(
      (candidate) => JsonTypes.isObject(candidate) && candidate.name === 'Search catalog',
    )
    if (!JsonTypes.isObject(target) || !JsonTypes.isObject(target.handle)) {
      throw new Error('Search target handle is missing.')
    }
    await FakeAgent.invoke(scenario.website, ForgeToolName.Interact, {
      action: WorkflowAction.Fill,
      handle: target.handle,
      value,
    })
  }

  static failureCode(value: JsonValue): FailureCode | null {
    return JsonTypes.isObject(value) && JsonTypes.isObject(value.failure) &&
      typeof value.failure.code === 'string' && Object.values(FailureCode).includes(value.failure.code as FailureCode)
      ? value.failure.code as FailureCode
      : null
  }
}

test('blocks sensitive inspection and reports a stale exploration handle', async ({}, testInfo) => {
  const scenario = await TestScenario.open(testInfo)
  try {
    await RepairJourney.begin(scenario, 'Inspect safe controls')
    await scenario.website.evaluate(() => {
      const password = document.createElement('input')
      password.type = 'password'
      password.setAttribute('aria-label', 'Private password')
      document.body.append(password)
    })
    const first = await FakeAgent.invoke(scenario.website, ForgeToolName.InspectPage, {})
    expect(JSON.stringify(first)).not.toContain('Private password')
    if (!JsonTypes.isObject(first) || !Array.isArray(first.targets) || !JsonTypes.isObject(first.targets[0]) || !JsonTypes.isObject(first.targets[0].handle)) {
      throw new Error('Safe target handle missing.')
    }
    await FakeAgent.invoke(scenario.website, ForgeToolName.InspectPage, {})
    const stale = await FakeAgent.invoke(scenario.website, ForgeToolName.Interact, {
      action: WorkflowAction.Click,
      handle: first.targets[0].handle,
      confirmed: true,
    })
    expect(RepairJourney.failureCode(stale)).toBe(FailureCode.StaleRevision)
  } finally {
    await scenario.context.close()
  }
})

test('ignores agent confirmation flags and resumes only after side-panel approval', async ({}, testInfo) => {
  const scenario = await TestScenario.open(testInfo)
  try {
    await RepairJourney.begin(scenario, 'Run the catalog search')
    await scenario.website.getByLabel('Search catalog').fill('notebook')
    await scenario.website.getByLabel('Category').selectOption('office')
    const inspection = await FakeAgent.invoke(scenario.website, ForgeToolName.InspectPage, {})
    if (!JsonTypes.isObject(inspection) || !Array.isArray(inspection.targets)) {
      throw new Error('Page inspection did not return targets.')
    }
    const search = inspection.targets.find(
      (candidate) => JsonTypes.isObject(candidate) && candidate.name === 'Search',
    )
    if (!JsonTypes.isObject(search) || !JsonTypes.isObject(search.handle)) {
      throw new Error('Search action target is missing.')
    }
    const blocked = await FakeAgent.invoke(scenario.website, ForgeToolName.Interact, {
      action: WorkflowAction.Click,
      effect: InteractionEffect.Navigation,
      handle: search.handle,
      confirmed: true,
    })
    expect(RepairJourney.failureCode(blocked)).toBe(FailureCode.RiskConfirmationRequired)
    if (!JsonTypes.isObject(blocked) || typeof blocked.confirmationRequestId !== 'string') {
      throw new Error('Extension-owned confirmation request was not returned.')
    }
    await expect(scenario.website.getByText('Field Notebook')).toHaveCount(0)
    await expect(scenario.sidePanel.page.getByText('Action confirmation required')).toBeVisible()
    await scenario.sidePanel.page.getByRole('button', { name: 'Allow this action' }).click()

    await FakeAgent.invoke(scenario.website, ForgeToolName.Interact, {
      action: WorkflowAction.Click,
      effect: InteractionEffect.Navigation,
      handle: search.handle,
      confirmationRequestId: blocked.confirmationRequestId,
    })
    await expect(scenario.website.getByText('Field Notebook')).toBeVisible()
  } finally {
    await scenario.context.close()
  }
})

test('fails on Changed DOM and activates a reviewed repair learned from a new trace', async ({}, testInfo) => {
  const scenario = await TestScenario.open(testInfo)
  try {
    const learnedTool = 'read_search_box'
    await RepairJourney.begin(scenario, 'Read search box')
    await RepairJourney.fillSearch(scenario, 'baseline')
    await FakeAgent.invoke(scenario.website, ForgeToolName.ProposeWorkflow, {})
    await scenario.sidePanel.approvePending()
    await expect.poll(() => FakeAgent.names(scenario.website)).toContain(learnedTool)

    await scenario.website.getByRole('button', { name: 'Changed DOM' }).click()
    const failure = await FakeAgent.invoke(scenario.website, learnedTool, { input_1: 'broken' })
    if (RepairJourney.failureCode(failure) === null) {
      throw new Error(`Learned tool did not return a structured failure: ${JSON.stringify(failure)}`)
    }
    expect(RepairJourney.failureCode(failure)).toBe(FailureCode.TargetMissing)
    await expect.poll(() => FakeAgent.names(scenario.website)).not.toContain(learnedTool)

    const protocol = await FakeAgent.invoke(scenario.website, ForgeToolName.Bootstrap, {
      operation: BootstrapOperation.Inspect,
    })
    expect(JSON.stringify(protocol)).toContain(FailureCode.TargetMissing)
    await FakeAgent.invoke(scenario.website, ForgeToolName.Bootstrap, {
      operation: BootstrapOperation.RequestRepair,
      toolName: learnedTool,
    })
    await expect.poll(() => FakeAgent.names(scenario.website)).toContain(ForgeToolName.InspectPage)
    await RepairJourney.fillSearch(scenario, 'repaired')
    await FakeAgent.invoke(scenario.website, ForgeToolName.ProposeWorkflow, {})
    await expect(scenario.sidePanel.page.getByRole('heading', { name: 'Review capability' })).toBeVisible()
    await scenario.sidePanel.approvePending()
    await expect(scenario.sidePanel.page.getByText('Rev. 2', { exact: true })).toBeVisible()
    await expect.poll(() => FakeAgent.names(scenario.website)).toContain(learnedTool)
    await scenario.website.getByLabel('Search catalog').fill('')
    await FakeAgent.invoke(scenario.website, learnedTool, { input_1: 'works again' })
    await expect(scenario.website.getByLabel('Search catalog')).toHaveValue('works again')
    await scenario.sidePanel.page.reload()
    await scenario.sidePanel.page.getByRole('button', { name: 'evidence', exact: true }).click()
    await expect(scenario.sidePanel.page.getByText('Replay verified').first()).toBeVisible()
    await expect(scenario.sidePanel.page.getByText(/approved ·/).first()).toBeVisible()
    await expect(scenario.sidePanel.page.getByText(/TARGET_MISSING/)).toBeVisible()
    await expect(scenario.sidePanel.page.getByText(/"status": "completed"/)).toBeVisible()
  } finally {
    await scenario.context.close()
  }
})
