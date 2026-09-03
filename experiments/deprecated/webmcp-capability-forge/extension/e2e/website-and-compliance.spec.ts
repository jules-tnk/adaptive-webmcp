import { expect, test } from '@playwright/test'

test('publishes official product, install, privacy, terms, support, and lab routes', async ({ page }) => {
  const routes = [
    ['/', 'Turn browser work into reviewed WebMCP tools.'],
    ['/install', 'Chrome Web Store release in progress.'],
    ['/privacy', 'Local workflow processing, described plainly.'],
    ['/terms', 'Use Capability Forge with review and responsibility.'],
    ['/support', 'Describe the page, goal, and failed step.'],
    ['/lab/guide', 'Use the lab to test Capability Forge before using it on a live website.'],
  ] as const
  for (const [route, heading] of routes) {
    await page.goto(`http://127.0.0.1:4181${route}`)
    await expect(page.getByRole('heading', { name: heading })).toBeVisible()
    await expect(
      page.getByRole('contentinfo').getByRole('link', { name: 'Privacy', exact: true }),
    ).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
})
