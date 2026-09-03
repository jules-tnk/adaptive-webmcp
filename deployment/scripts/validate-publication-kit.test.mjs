import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { PublicationKitValidator } from './validate-publication-kit.mjs'

class PublicationKitFixture {
  static async create(overrides = {}) {
    const root = await mkdtemp(join(tmpdir(), 'webmcp-forge-kit-'))
    const storeRoot = join(root, 'chrome-web-store')
    for (const directory of ['listing', 'privacy', 'review', 'assets']) {
      await mkdir(join(storeRoot, directory), { recursive: true })
    }

    const shortDescription =
      overrides.shortDescription ??
      'Teach or let an AI agent discover reusable browser workflows, review them, and expose them as local WebMCP tools.'
    const permissions =
      overrides.permissions ??
      '`scripting` `storage` `tabs` `sidePanel` optional HTTP/HTTPS host access'

    const files = {
      'listing/en-US.md': `Name: WebMCP Capability Forge\nCategory: Developer Tools\nLanguage: English\nShort description: ${shortDescription}\nHomepage: https://webmcp-forge.jules-tnk.com\nPrivacy: https://webmcp-forge.jules-tnk.com/privacy\nSupport: https://webmcp-forge.jules-tnk.com/support\nDistribution: Free, public, all regions, deferred publishing`,
      'privacy/privacy-policy.md': 'Workflow data uses Chrome local storage. A user-selected AI agent may receive bounded observations. Chrome Web Store Limited Use requirements apply.',
      'privacy/data-disclosure-matrix.md': 'URL and path; visible website content; interactions; non-sensitive form examples; extracted results; developer receives no page data.',
      'privacy/permission-justifications.md': `${permissions}\nNo remote code. Reconcile against the production manifest before submission.`,
      'privacy/prominent-disclosure.md': 'Processes page URL, visible controls, workflow interactions, and bounded content. Stored locally. A connected AI agent may receive bounded observations. Sensitive fields are blocked.',
      'review/test-instructions.md': 'Reviewer entry: https://webmcp-forge.jules-tnk.com/lab/guide\nSubmission remains blocked until the public lab and production package pass verification.',
      'review/submission-checklist.md': '- [ ] Final manifest reconciliation\n- [ ] Production ZIP\n- [ ] Actual screenshots\n- [ ] Automated extension evidence\n- [ ] Native WebMCP evidence\n- [ ] Submit for Review\n- [ ] Public release',
      'assets/README.md': '128x128 PNG icon\n1280x800 screenshots\n440x280 small promo tile\n1400x560 optional marquee\nNo mock screenshots.',
    }

    for (const [relativePath, content] of Object.entries(files)) {
      await writeFile(join(storeRoot, relativePath), content, 'utf8')
    }
    return root
  }
}

test('accepts a complete deferred publication kit', async () => {
  const root = await PublicationKitFixture.create()
  assert.deepEqual(await PublicationKitValidator.validate(root), [])
})

test('rejects a short description over 132 characters', async () => {
  const root = await PublicationKitFixture.create({ shortDescription: 'x'.repeat(133) })
  const issues = await PublicationKitValidator.validate(root)
  assert.ok(issues.includes('The manifest short description exceeds 132 characters.'))
})

test('requires every planned permission justification', async () => {
  const root = await PublicationKitFixture.create({
    permissions: '`scripting` `storage`',
  })
  const issues = await PublicationKitValidator.validate(root)
  assert.ok(issues.includes('Missing permission justification: tabs'))
  assert.ok(issues.includes('Missing permission justification: sidePanel'))
  assert.ok(issues.includes('Missing permission justification: optional host access'))
})

test('requires deferred submission gates to remain unchecked', async () => {
  const root = await PublicationKitFixture.create()
  const checklistPath = join(
    root,
    'chrome-web-store',
    'review',
    'submission-checklist.md',
  )
  await writeFile(checklistPath, '- [x] Submit for Review\n- [x] Public release', 'utf8')
  const issues = await PublicationKitValidator.validate(root)
  assert.ok(issues.includes('Submit for Review must remain blocked.'))
  assert.ok(issues.includes('Public release must remain blocked.'))
})
