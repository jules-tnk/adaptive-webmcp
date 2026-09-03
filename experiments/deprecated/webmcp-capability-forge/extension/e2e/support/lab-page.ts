import { expect, type Page } from '@playwright/test'

import { CatalogCategory } from 'webmcp-capability-forge-core'

export class LabPage {
  readonly page: Page
  constructor(page: Page) { this.page = page }

  async completeCatalogWorkflow(): Promise<void> {
    await this.page.getByLabel('Search catalog').fill('notebook')
    await this.page.getByLabel('Category').selectOption(CatalogCategory.Office)
    await this.page.getByRole('button', { name: 'Search', exact: true }).click()
    await expect(this.page.getByText('Field Notebook')).toBeVisible()
    await this.page.getByRole('button', { name: 'Shortlist' }).click()
  }
}
