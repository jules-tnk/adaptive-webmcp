import { chromium, type BrowserContext, type TestInfo } from '@playwright/test'
import { cp, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import type { JsonObject } from 'webmcp-capability-forge-core'

export interface ExtensionHarness {
  readonly context: BrowserContext
  readonly extensionId: string
}

export class ExtensionContextHarness {
  static async launch(testInfo: TestInfo): Promise<ExtensionHarness> {
    const extensionPath = resolve('output', 'playwright', `extension-${testInfo.project.name}`)
    const profilePath = resolve('output', 'playwright', `profile-${testInfo.project.name}`)
    await rm(extensionPath, { recursive: true, force: true })
    await cp(resolve('dist'), extensionPath, { recursive: true })
    const manifestPath = resolve(extensionPath, 'manifest.json')
    const parsed = JSON.parse(await readFile(manifestPath, 'utf8')) as JsonObject
    const manifest: JsonObject = { ...parsed, host_permissions: ['http://127.0.0.1/*'] }
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
    await rm(profilePath, { recursive: true, force: true })
    const context = await chromium.launchPersistentContext(profilePath, {
      headless: false,
      viewport: testInfo.project.use.viewport,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    })
    let worker = context.serviceWorkers()[0]
    for (let attempt = 0; !worker && attempt < 100; attempt += 1) {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 50))
      worker = context.serviceWorkers()[0]
    }
    if (!worker) {
      await context.close()
      throw new Error('Extension service worker did not start within five seconds.')
    }
    return { context, extensionId: new URL(worker.url()).host }
  }
}
