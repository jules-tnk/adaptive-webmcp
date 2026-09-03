import { expect, type Page } from '@playwright/test'

import { LearningMode } from 'webmcp-capability-forge-core'

export class SidePanelPage {
  readonly page: Page
  constructor(page: Page) { this.page = page }

  async enableSite(): Promise<void> {
    await this.page.getByRole('button', { name: 'site', exact: true }).click()
    const enabled = this.page.getByText('Enabled', { exact: true })
    const disabled = this.page.getByText('Disabled', { exact: true })
    await expect(enabled.or(disabled)).toBeVisible()
    if (await disabled.isVisible()) {
      await this.page.getByRole('button', { name: 'Enable on this site' }).click()
    }
    await expect(enabled).toBeVisible()
    await expect(this.page.getByRole('button', { name: 'Disable on this site' })).toBeVisible()
    await this.page.getByRole('button', { name: 'session', exact: true }).click()
  }

  async start(mode: LearningMode, goal: string): Promise<void> {
    await this.page.getByLabel('Workflow goal').fill(goal)
    const label = mode === LearningMode.Manual
      ? 'Teach a workflow'
      : mode === LearningMode.Automatic
        ? 'Let the agent explore'
        : 'Build together'
    await this.page.getByRole('button', { name: label }).click()
    await expect(this.page.getByText('collecting')).toBeVisible()
  }

  async stop(): Promise<void> {
    await this.page.getByRole('button', { name: 'Stop and save trace' }).click()
  }

  async approvePending(): Promise<void> {
    await this.page.getByRole('button', { name: 'review', exact: true }).click()
    await this.page.getByRole('button', { name: 'Approve and verify' }).click()
  }

  async openTools(): Promise<void> {
    await this.page.getByRole('button', { name: 'tools', exact: true }).click()
  }
}
