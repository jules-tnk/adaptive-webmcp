import { test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

import { LearningMode } from 'webmcp-capability-forge-core'

import { TestScenario } from './support/test-scenario'

test('captures the current teaching side-panel experience for the Store', async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Store screenshot is generated once at 1280x800.')
  const scenario = await TestScenario.open(testInfo)
  try {
    await scenario.sidePanel.start(LearningMode.Manual, 'Find and shortlist a notebook')
    await scenario.website.getByLabel('Search catalog').fill('notebook')
    const output = resolve('..', 'store-assets', 'screenshots')
    await mkdir(output, { recursive: true })
    await scenario.sidePanel.page.setViewportSize({ width: 1280, height: 800 })
    await scenario.sidePanel.page.screenshot({
      path: resolve(output, '01-teaching-session.png'),
      fullPage: false,
    })
  } finally {
    await scenario.context.close()
  }
})
