# Site Access Bridge Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make enabled-site status survive side-panel closure and reopen so Session modes unlock after a goal is entered.

**Architecture:** Keep the existing optional host-permission and dynamic-registration architecture. Align the strict bridge schema with the `{ url, tabId }` payload already emitted by `ExtensionClient`, then protect the behavior with contract and loaded-extension regressions.

**Tech Stack:** TypeScript 6, Zod 4, React 19, Chrome Manifest V3 APIs, Vitest 4, Playwright 1.62, pnpm.

**Spec:** `docs/superpowers/specs/2026-08-29-site-access-bridge-fix-design.md`

## Global Constraints

- Do not add UI component tests.
- Do not add required or broad host permissions.
- Keep `activeTab` absent and retain `optional_host_permissions` for HTTP/HTTPS.
- Keep deterministic strings in enums; do not introduce string-literal unions.
- Do not use explicit `any` or `unknown`.
- Do not create a branch, worktree, commit, or Firebase deployment.

---

### Task 1: Capture the bridge mismatch and reopen regression

Execution status: Complete.

**Files:**
- Modify: `experiments/webmcp-capability-forge/extension/src/bridge/bridge-envelope.test.ts`
- Create: `experiments/webmcp-capability-forge/extension/e2e/site-access-persistence.spec.ts`
- Consume: `experiments/webmcp-capability-forge/extension/e2e/support/extension-context.ts`
- Consume: `experiments/webmcp-capability-forge/extension/e2e/support/fake-model-context.ts`

**Interfaces:**
- Consumes: `BridgeEnvelopeCodec.create(input: CreateEnvelopeInput): BridgeEnvelope`.
- Consumes: `BridgeEnvelopeCodec.parse(value: JsonValue, direction: BridgeDirection): ValidationResult<BridgeEnvelope>`.
- Produces: regression coverage for the exact `{ url: string, tabId: number }` payloads emitted by `ExtensionClient.siteStatus()` and `disableSite()`.

- [ ] **Step 1: Add failing bridge-contract tests**

Add these cases inside `describe('BridgeEnvelopeCodec', ...)`:

```ts
  it.each([BridgeMessageType.SiteStatus, BridgeMessageType.SiteDisable])(
    'round-trips a valid %s page payload',
    (type) => {
      const envelope = BridgeEnvelopeCodec.create({
        requestId: `request-${type}`,
        direction: BridgeDirection.UiToBackground,
        type,
        payload: { url: 'https://www.youtube.com/@TheGreatReview/videos', tabId: 12 },
      })

      const parsed = BridgeEnvelopeCodec.parse(envelope, BridgeDirection.UiToBackground)

      expect(parsed.valid).toBe(true)
    },
  )
```

- [ ] **Step 2: Add the loaded close/reopen journey**

Create `site-access-persistence.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

import { ExtensionContextHarness } from './support/extension-context'
import { FakeModelContextInstaller } from './support/fake-model-context'

test('keeps site access enabled after the side panel is closed and reopened', async ({}, testInfo) => {
  const harness = await ExtensionContextHarness.launch(testInfo)
  try {
    await FakeModelContextInstaller.install(harness.context)
    const website = await harness.context.newPage()
    await website.goto('http://127.0.0.1:4181/lab/workflow')

    const firstPanel = await harness.context.newPage()
    await firstPanel.goto(`chrome-extension://${harness.extensionId}/sidepanel.html#site`)
    await expect(firstPanel.getByText('Enabled', { exact: true })).toBeVisible()
    await firstPanel.close()

    const reopenedPanel = await harness.context.newPage()
    await reopenedPanel.goto(`chrome-extension://${harness.extensionId}/sidepanel.html#site`)
    await expect(reopenedPanel.getByText('Enabled', { exact: true })).toBeVisible()
    await reopenedPanel.getByRole('button', { name: 'session', exact: true }).click()
    await reopenedPanel.getByLabel('Workflow goal').fill('Find and shortlist a notebook')
    await expect(reopenedPanel.getByRole('button', { name: 'Teach manually' })).toBeEnabled()
    await expect(reopenedPanel.getByRole('button', { name: 'Let the agent explore' })).toBeEnabled()
    await expect(reopenedPanel.getByRole('button', { name: 'Build together' })).toBeEnabled()
  } finally {
    await harness.context.close()
  }
})
```

- [ ] **Step 3: Run both regressions and verify RED**

Run:

```powershell
pnpm --filter webmcp-capability-forge-extension test -- src/bridge/bridge-envelope.test.ts
pnpm --filter webmcp-capability-forge-extension test:e2e -- site-access-persistence.spec.ts --project=desktop
```

Expected:

- Vitest fails because `SiteStatus` and `SiteDisable` reject the extra `tabId`.
- Playwright fails because the reopened panel receives `BRIDGE_INVALID`, displays Disabled, and keeps Session buttons disabled.

### Task 2: Align the strict bridge contract

Execution status: Complete.

**Files:**
- Modify: `experiments/webmcp-capability-forge/extension/src/bridge/bridge-envelope.ts:25-68`
- Test: `experiments/webmcp-capability-forge/extension/src/bridge/bridge-envelope.test.ts`
- Test: `experiments/webmcp-capability-forge/extension/e2e/site-access-persistence.spec.ts`

**Interfaces:**
- Consumes: `BridgeMessageType.SiteEnable`, `SiteDisable`, and `SiteStatus`.
- Produces: one strict `sitePagePayload` schema shared by all three message types.

- [ ] **Step 1: Replace the mismatched payload schemas**

In `bridge-envelope.ts`, replace `siteEnablePayload` and `siteUrlPayload` with:

```ts
const sitePagePayload = z
  .object({ url: z.url(), tabId: z.number().int().nonnegative() })
  .strict()
```

Replace the site branches in `payloadMatches` with:

```ts
    if (
      type === BridgeMessageType.SiteEnable ||
      type === BridgeMessageType.SiteDisable ||
      type === BridgeMessageType.SiteStatus
    ) {
      return sitePagePayload.safeParse(payload).success
    }
```

- [ ] **Step 2: Run the focused unit test and verify GREEN**

Run:

```powershell
pnpm --filter webmcp-capability-forge-extension test -- src/bridge/bridge-envelope.test.ts
```

Expected: all bridge-envelope tests pass.

- [ ] **Step 3: Run the close/reopen journey and verify GREEN**

Run:

```powershell
pnpm --filter webmcp-capability-forge-extension test:e2e -- site-access-persistence.spec.ts --project=desktop
```

Expected: the reopened panel remains Enabled and all three learning buttons become enabled after the goal is filled.

- [ ] **Step 4: Inject the current document when status repairs registration**

If the full suite shows an Enabled site without the bootstrap tool on the already-open fixture page, add `registrationChanged: boolean` to `SitePermissionResult`. Set it only when `status()` creates a missing dynamic registration. In the `SiteStatus` branch of `ChromePlatform.handle`, call `services.injectContent(payload.tabId)` only when `enabled` and `registrationChanged` are both true. Verify the existing registration-restoration test asserts `registrationChanged === true`.

### Task 3: Reconcile artifacts and complete release verification

Execution status: Complete.

**Files:**
- Modify: `STATUS.md`
- Modify: `deployment/STATUS.md`
- Regenerate: `experiments/webmcp-capability-forge/output/webmcp-capability-forge-extension.zip`

**Interfaces:**
- Consumes: the passing bridge and loaded-extension regressions from Tasks 1-2.
- Produces: verified build, updated test totals, and a production ZIP without popup artifacts.

- [ ] **Step 1: Run the full project gate**

Run:

```powershell
pnpm verify
```

Expected: coding rules, type checking, 27 core tests, all extension tests, extension build, and website build pass.

- [ ] **Step 2: Run the full loaded-extension suite**

Run:

```powershell
pnpm test:e2e
```

Expected: all desktop/mobile journeys pass except the intentionally skipped duplicate mobile Store screenshot.

- [ ] **Step 3: Validate the Chrome Web Store publication kit**

Run from the repository root:

```powershell
node --test deployment/scripts/validate-publication-kit.test.mjs
node deployment/scripts/validate-publication-kit.mjs deployment
```

Expected: four validator tests pass and the deferred publication kit validates.

- [ ] **Step 4: Regenerate and inspect the production ZIP**

Run from `experiments/webmcp-capability-forge`:

```powershell
pwsh -File scripts/package-extension.ps1
$entries = tar -tf output/webmcp-capability-forge-extension.zip
Write-Output "PopupEntries=$(@($entries | Where-Object { $_ -match 'popup' }).Count)"
```

Expected: packaging succeeds and `PopupEntries=0`.

- [ ] **Step 5: Update status totals**

Update `STATUS.md` and `deployment/STATUS.md` with the exact fresh extension-unit and loaded-browser counts from Steps 1-2. Preserve all still-open native WebMCP, legal-review, Store-submission, and public-repository gates.

- [ ] **Step 6: Perform the real-Chrome handoff**

In the final response, instruct the user to reload the unpacked extension, enable one origin, close/reopen the panel, fill a workflow goal, and confirm the three mode buttons are enabled. State explicitly that this native Chrome sequence remains user-verified rather than Playwright-verified.

No commit step is permitted for any task in this plan.
