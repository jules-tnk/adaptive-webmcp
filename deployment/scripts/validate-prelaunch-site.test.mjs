import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { PrelaunchSiteValidator } from './validate-prelaunch-site.mjs'

const homeCanonical = 'https://webmcp-forge.jules-tnk.com/'
const privacyCanonical = 'https://webmcp-forge.jules-tnk.com/privacy'
const supportCanonical = 'https://webmcp-forge.jules-tnk.com/support'

class SiteFixture {
  static async create(overrides = {}) {
    const root = await mkdtemp(join(tmpdir(), 'webmcp-forge-site-'))
    await mkdir(join(root, 'privacy'), { recursive: true })
    await mkdir(join(root, 'support'), { recursive: true })

    const defaults = {
      home: `<!doctype html><html><head><link rel="canonical" href="${homeCanonical}"></head><body><p>WebMCP Capability Forge is in development.</p><a href="/privacy">Privacy</a><a href="/support">Support</a></body></html>`,
      privacy: `<!doctype html><html><head><link rel="canonical" href="${privacyCanonical}"></head><body><h1>Privacy</h1><p>Chrome Web Store Limited Use requirements apply.</p><a href="/">Home</a><a href="/support">Support</a></body></html>`,
      support: `<!doctype html><html><head><link rel="canonical" href="${supportCanonical}"></head><body><h1>Support</h1><a href="/">Home</a><a href="/privacy">Privacy</a></body></html>`,
    }
    const pages = { ...defaults, ...overrides }

    await writeFile(join(root, 'index.html'), pages.home, 'utf8')
    await writeFile(join(root, 'privacy', 'index.html'), pages.privacy, 'utf8')
    await writeFile(join(root, 'support', 'index.html'), pages.support, 'utf8')
    return root
  }
}

test('accepts a complete static prelaunch site', async () => {
  const root = await SiteFixture.create()
  assert.deepEqual(await PrelaunchSiteValidator.validate(root), [])
})

test('rejects a site that claims the extension is available', async () => {
  const root = await SiteFixture.create({
    home: `<!doctype html><html><head><link rel="canonical" href="${homeCanonical}"></head><body><p>Install now from the Chrome Web Store.</p><a href="/privacy">Privacy</a><a href="/support">Support</a></body></html>`,
  })
  const issues = await PrelaunchSiteValidator.validate(root)
  assert.ok(
    issues.includes('The homepage must state that the extension is in development.'),
  )
})

test('rejects executable, form, tracking, and unfinished content', async () => {
  const root = await SiteFixture.create({
    home: `<!doctype html><html><head><link rel="canonical" href="${homeCanonical}"></head><body><p>WebMCP Capability Forge is in development.</p><form></form><script src="https://www.googletagmanager.com/gtag/js"></script><p>TODO</p><a href="/privacy">Privacy</a><a href="/support">Support</a></body></html>`,
  })
  const issues = await PrelaunchSiteValidator.validate(root)
  assert.ok(issues.includes('Static pages must not contain scripts.'))
  assert.ok(issues.includes('Static pages must not contain forms.'))
  assert.ok(issues.includes('Static pages must not contain tracking services.'))
  assert.ok(issues.includes('Static pages must not contain unfinished-work markers.'))
})

test('requires canonical URLs and the Limited Use disclosure', async () => {
  const root = await SiteFixture.create({
    privacy: '<!doctype html><html><body><h1>Privacy</h1></body></html>',
  })
  const issues = await PrelaunchSiteValidator.validate(root)
  assert.ok(issues.includes(`Missing canonical URL: ${privacyCanonical}`))
  assert.ok(issues.includes('The privacy page must mention Limited Use.'))
})
