# Automatic Tool Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Manifest V3 Chrome extension and hosted unsupported-site demo where an unfamiliar WebMCP agent discovers one `adaptive_webmcp` bootstrap tool, reads a structured learning protocol, proposes a declarative tool, receives human approval, and reuses the restored tool after reload and import.

**Architecture:** A custom esbuild pipeline produces stable classic-script extension assets for a background worker, isolated content bridge, main-world WebMCP runtime, approval UI, and React popup. The hosted Vite demo contains no native catalog tool; the extension requests exact-origin permission, registers a persistent content script, injects the main-world runtime, and stores approved definitions in `chrome.storage.local`.

**Tech Stack:** TypeScript, Manifest V3, esbuild, React, Tailwind CSS, Zod, Vite, Vitest, Testing Library, Playwright, chrome.storage.local

**Spec:** `docs/superpowers/specs/2026-08-27-automatic-tool-extension-design.md`

## Global Constraints

- Work in the existing repository and current branch; do not create a branch or worktree.
- Do not create a Git commit unless the user asks for one.
- Create all implementation files under `experiments/automatic-tool-extension/`.
- Do not share implementation code with `experiments/capability-forge/` during the comparison phase.
- Build a real Manifest V3 extension plus a distinct hosted demo app.
- Request optional host permission for the exact enabled origin through a direct user gesture.
- Inject only packaged JavaScript; generated and imported artifacts remain declarative data.
- Register exactly one bootstrap tool named `adaptive_webmcp` before learning.
- Use `inspect`, `list`, `propose`, and `report_failure` exactly.
- Do not inject invisible, hidden, accessibility-only, metadata, or off-screen instructions.
- Keep the workflow language to `fill`, `click`, `waitFor`, and `extract`.
- Enforce 12 steps, 5 seconds per wait, 20 extracted items, and 32 KB serialized output.
- Require direct user approval for origin enablement, tool proposals, replacements, imports, and deletion.
- Reject cross-origin scope, navigation, network requests, executable code, unsafe targets, and unsupported operations.
- Store no page text, credentials, cookies, or agent conversation content.
- Target Chrome 149 or later for real WebMCP verification.
- Follow TDD for domain and bridge behavior; use a loaded-extension Playwright flow for browser verification.
- Use `pnpm` and keep project-local lockfiles.

---

### Task 1: Scaffold the independent workspace, extension build, and demo build

**Files:**
- Create: `experiments/automatic-tool-extension/package.json`
- Create: `experiments/automatic-tool-extension/pnpm-workspace.yaml`
- Create: `experiments/automatic-tool-extension/extension/package.json`
- Create: `experiments/automatic-tool-extension/extension/tsconfig.json`
- Create: `experiments/automatic-tool-extension/extension/scripts/build.mjs`
- Create: `experiments/automatic-tool-extension/extension/public/manifest.json`
- Create: `experiments/automatic-tool-extension/extension/public/popup.html`
- Create: `experiments/automatic-tool-extension/extension/src/background/index.ts`
- Create: `experiments/automatic-tool-extension/extension/src/content/index.tsx`
- Create: `experiments/automatic-tool-extension/extension/src/main-world/index.ts`
- Create: `experiments/automatic-tool-extension/extension/src/popup/main.tsx`
- Create: `experiments/automatic-tool-extension/extension/src/styles.css`
- Create: `experiments/automatic-tool-extension/extension/src/test/setup.ts`
- Create: `experiments/automatic-tool-extension/extension/src/popup/Popup.test.tsx`
- Create: `experiments/automatic-tool-extension/demo-web/package.json`
- Create: `experiments/automatic-tool-extension/demo-web/vite.config.ts`
- Create: `experiments/automatic-tool-extension/demo-web/src/main.tsx`
- Create: `experiments/automatic-tool-extension/demo-web/src/App.tsx`
- Create: `experiments/automatic-tool-extension/demo-web/src/App.test.tsx`

**Interfaces:**
- Consumes: Node.js and pnpm
- Produces: root commands for install, build, typecheck, unit tests, demo development, and extension E2E tests

- [x] **Step 1: Create the workspace and package manifests**

Run from the repository root:

```powershell
New-Item -ItemType Directory -Path 'experiments\automatic-tool-extension\extension' -Force | Out-Null
pnpm create vite@latest experiments/automatic-tool-extension/demo-web --template react-ts
```

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - extension
  - demo-web
```

Set the extension package name to `automatic-tool-extension-extension` and the generated demo package name to `automatic-tool-extension-demo`; the root filter scripts depend on these exact names.

Set the root `package.json` to private and add:

```json
{
  "scripts": {
    "build": "pnpm --recursive build",
    "typecheck": "pnpm --recursive typecheck",
    "test": "pnpm --recursive test",
    "test:e2e": "pnpm --filter automatic-tool-extension-extension test:e2e",
    "dev:demo": "pnpm --filter automatic-tool-extension-demo dev"
  }
}
```

- [x] **Step 2: Install extension dependencies**

Run:

```powershell
pnpm --dir experiments/automatic-tool-extension/extension add react react-dom zod
pnpm --dir experiments/automatic-tool-extension/extension add -D typescript esbuild @types/chrome @types/react @types/react-dom vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test tailwindcss @tailwindcss/cli
pnpm --dir experiments/automatic-tool-extension/demo-web add -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test tailwindcss @tailwindcss/vite
```

- [x] **Step 3: Define extension scripts**

Set `extension/package.json` scripts:

```json
{
  "scripts": {
    "build": "node scripts/build.mjs",
    "typecheck": "tsc --noEmit --pretty false",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  }
}
```

Create `scripts/build.mjs` that removes `dist`, bundles four stable IIFE entry points with esbuild, copies `manifest.json` and `popup.html`, and compiles Tailwind:

```js
import { execFile } from "node:child_process";
import { cp, mkdir, rm } from "node:fs/promises";
import { promisify } from "node:util";
import { build } from "esbuild";

const execFileAsync = promisify(execFile);
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

await build({
  entryPoints: {
    background: "src/background/index.ts",
    content: "src/content/index.tsx",
    "main-world": "src/main-world/index.ts",
    popup: "src/popup/main.tsx"
  },
  outdir: "dist",
  bundle: true,
  format: "iife",
  target: "chrome149",
  sourcemap: true,
  entryNames: "[name]"
});

await cp("public/manifest.json", "dist/manifest.json");
await cp("public/popup.html", "dist/popup.html");
await execFileAsync(process.platform === "win32" ? "pnpm.CMD" : "pnpm", [
  "exec", "tailwindcss", "-i", "src/styles.css", "-o", "dist/styles.css", "--minify"
]);
```

- [x] **Step 4: Define the minimal manifest**

Create `public/manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "Adaptive WebMCP",
  "version": "0.1.0",
  "description": "Teach WebMCP-aware agents reusable tools for unsupported websites.",
  "permissions": ["activeTab", "scripting", "storage", "tabs"],
  "optional_host_permissions": ["http://*/*", "https://*/*"],
  "background": { "service_worker": "background.js" },
  "action": { "default_popup": "popup.html", "default_title": "Adaptive WebMCP" }
}
```

Do not add `<all_urls>` to `host_permissions`.

Create `public/popup.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="styles.css" />
    <title>Adaptive WebMCP</title>
  </head>
  <body>
    <div id="root"></div>
    <script src="popup.js"></script>
  </body>
</html>
```

- [x] **Step 5: Write failing shell tests**

Extension popup test:

```tsx
render(<Popup />);
expect(screen.getByRole("heading", { name: "Adaptive WebMCP" })).toBeVisible();
expect(screen.getByRole("button", { name: "Enable on this site" })).toBeEnabled();
```

Demo test:

```tsx
render(<App />);
expect(screen.getByRole("heading", { name: "Unsupported Catalog Lab" })).toBeVisible();
expect(screen.getByText("No native catalog tools are registered by this site.")).toBeVisible();
```

- [x] **Step 6: Run tests and confirm failure**

Run:

```powershell
pnpm --dir experiments/automatic-tool-extension test
```

Expected: FAIL because Popup and demo shell behavior are not implemented.

- [x] **Step 7: Implement minimal shells and verify builds**

Add `Popup`, the demo heading, test setup files, `@import "tailwindcss";` to both style entry files, and Vite/Vitest configuration using `defineConfig` from `vitest/config`. Run:

```powershell
pnpm --dir experiments/automatic-tool-extension test
pnpm --dir experiments/automatic-tool-extension typecheck
pnpm --dir experiments/automatic-tool-extension build
```

Expected: all commands exit with code 0 and `extension/dist/manifest.json` exists.

### Task 2: Define learned tools, bootstrap operations, and structured protocol

**Files:**
- Create: `experiments/automatic-tool-extension/extension/src/domain/types.ts`
- Create: `experiments/automatic-tool-extension/extension/src/domain/schemas.ts`
- Create: `experiments/automatic-tool-extension/extension/src/domain/validate-bootstrap-input.ts`
- Create: `experiments/automatic-tool-extension/extension/src/domain/validate-learned-tool.ts`
- Create: `experiments/automatic-tool-extension/extension/src/protocol/constants.ts`
- Create: `experiments/automatic-tool-extension/extension/src/protocol/build-learning-protocol.ts`
- Create: `experiments/automatic-tool-extension/extension/src/protocol/build-learning-protocol.test.ts`
- Create: `experiments/automatic-tool-extension/extension/src/domain/validation.test.ts`

**Interfaces:**
- Consumes: Zod and current page scope
- Produces: approved spec types, `validateBootstrapInput`, `validateLearnedTool`, `buildLearningProtocol`

- [x] **Step 1: Define exact domain contracts**

Copy the approved contracts from the spec into `types.ts`, including `AdaptiveWebMcpInput`, `ToolFailureReport`, `LearningProtocol`, `LearnedToolDefinition`, summaries, value expressions, extraction fields, tool packs, and learned-tool results.

Define the portable artifact exactly:

```ts
export type ToolPack = {
  format: "adaptive-webmcp-toolpack";
  version: 1;
  exportedAt: string;
  origin: string;
  tools: LearnedToolDefinition[];
};
```

Add:

```ts
export type StoredLearnedTool = {
  id: string;
  revision: number;
  enabled: boolean;
  health: "healthy" | "unhealthy" | "unknown";
  definition: LearnedToolDefinition;
  lastFailure?: LearnedToolFailureSummary;
  createdAt: string;
  updatedAt: string;
};
```

- [x] **Step 2: Write failing operation validation tests**

Assert the exact field matrix:

```ts
expect(validateBootstrapInput({ operation: "inspect" }).ok).toBe(true);
expect(validateBootstrapInput({ operation: "inspect", toolName: "x" }).ok).toBe(false);
expect(validateBootstrapInput({ operation: "propose" }).ok).toBe(false);
expect(validateBootstrapInput({ operation: "report_failure", toolName: "x" }).ok).toBe(false);
expect(validateBootstrapInput({ operation: "unknown" }).ok).toBe(false);
```

- [x] **Step 3: Write failing learned-tool policy tests**

Cover origin mismatch, unsupported path glob, more than 12 steps, wait over 5000 ms, unknown action, script target, undeclared input reference, duplicate `saveAs`, and valid definition.

- [x] **Step 4: Write failing protocol tests**

Build the protocol with two stored tools and one failure. Assert:

```ts
expect(protocol.protocolVersion).toBe(1);
expect(protocol.phases.map((phase) => phase.phase)).toEqual([
  "reuse", "explore", "model", "propose", "improve"
]);
expect(protocol.constraints).toMatchObject({
  maximumSteps: 12,
  sameOriginOnly: true,
  executableCodeAllowed: false,
  humanApprovalRequired: true
});
expect(protocol.failedTools).toHaveLength(1);
```

- [x] **Step 5: Run tests and confirm failure**

Run:

```powershell
pnpm --dir experiments/automatic-tool-extension/extension test -- src/domain src/protocol
```

Expected: FAIL because validators and protocol builder do not exist.

- [x] **Step 6: Implement schemas, policies, and protocol**

Export this exact metadata from `constants.ts`:

```ts
export const BOOTSTRAP_TOOL_NAME = "adaptive_webmcp";
export const BOOTSTRAP_TOOL_TITLE = "Adaptive site capability manager";
export const BOOTSTRAP_TOOL_DESCRIPTION =
  "Use this tool when the current page lacks a suitable site tool for the user's task. " +
  "Start with operation 'inspect' to receive the page-specific learning protocol, " +
  "existing learned tools, supported workflow actions, safety constraints, and detected failures. " +
  "After exploring the page, use operation 'propose' to submit a declarative tool for human review. " +
  "Use operation 'report_failure' when a learned tool no longer works.";
```

Add a test that the description length is at most 500 characters.

- [x] **Step 7: Verify the structured protocol**

Run:

```powershell
pnpm --dir experiments/automatic-tool-extension/extension test -- src/domain src/protocol
pnpm --dir experiments/automatic-tool-extension/extension typecheck
```

Expected: PASS.

### Task 3: Build the hosted unsupported catalog demo

**Files:**
- Create: `experiments/automatic-tool-extension/demo-web/src/lab/catalog-fixture.ts`
- Create: `experiments/automatic-tool-extension/demo-web/src/lab/lab-store.ts`
- Create: `experiments/automatic-tool-extension/demo-web/src/lab/UnsupportedCatalog.tsx`
- Create: `experiments/automatic-tool-extension/demo-web/src/lab/UnsupportedCatalog.test.tsx`
- Create: `experiments/automatic-tool-extension/demo-web/src/metrics/metrics-store.ts`
- Create: `experiments/automatic-tool-extension/demo-web/src/metrics/MetricsPanel.tsx`
- Create: `experiments/automatic-tool-extension/demo-web/src/extension-status.ts`
- Modify: `experiments/automatic-tool-extension/demo-web/src/App.tsx`

**Interfaces:**
- Consumes: normal browser interaction and extension status events
- Produces: versioned unsupported site, resettable state, and before/after measurements

- [x] **Step 1: Write failing catalog behavior tests**

Duplicate this fixture locally in the demo package:

```ts
[
  { id: "cedar-lamp", name: "Cedar Lamp", category: "home", price: 79 },
  { id: "field-notebook", name: "Field Notebook", category: "office", price: 18 },
  { id: "trail-flask", name: "Trail Flask", category: "outdoors", price: 32 },
  { id: "studio-headphones", name: "Studio Headphones", category: "electronics", price: 149 },
  { id: "linen-throw", name: "Linen Throw", category: "home", price: 54 }
]
```

Test search for `lamp` in `home`, shortlist `Cedar Lamp`, and confirm version 1 and version 2 have the same labels with different selectors.

- [x] **Step 2: Write a failing no-native-tools test**

Install a fake `document.modelContext` that records registrations, render the demo, and assert:

```ts
expect(fakeModelContext.registeredNames()).toEqual([]);
```

The demo may display extension status events, but it must not call `registerTool`.

- [x] **Step 3: Run tests and confirm failure**

Run:

```powershell
pnpm --dir experiments/automatic-tool-extension/demo-web test -- src/lab src/App.test.tsx
```

Expected: FAIL because the lab is missing.

- [x] **Step 4: Implement the demo and metrics**

Render a visible statement that the site registers no native catalog tools. Add version switch, reset, search, results, shortlist, manual interaction count, learned-tool call count, and last execution duration. Listen only for the namespaced status event `adaptive-webmcp:status`; treat its payload as untrusted display data.

- [x] **Step 5: Verify demo independence**

Run:

```powershell
pnpm --dir experiments/automatic-tool-extension/demo-web test
pnpm --dir experiments/automatic-tool-extension/demo-web typecheck
pnpm --dir experiments/automatic-tool-extension/demo-web build
```

Expected: PASS and no demo source file contains `registerTool(`.

### Task 4: Implement storage, matching, revisions, failures, and tool packs

**Files:**
- Create: `experiments/automatic-tool-extension/extension/src/storage/storage-area.ts`
- Create: `experiments/automatic-tool-extension/extension/src/storage/learned-tool-repository.ts`
- Create: `experiments/automatic-tool-extension/extension/src/storage/learned-tool-repository.test.ts`
- Create: `experiments/automatic-tool-extension/extension/src/domain/path-match.ts`
- Create: `experiments/automatic-tool-extension/extension/src/domain/path-match.test.ts`
- Create: `experiments/automatic-tool-extension/extension/src/toolpack/toolpack.ts`
- Create: `experiments/automatic-tool-extension/extension/src/toolpack/toolpack.test.ts`

**Interfaces:**
- Consumes: `chrome.storage.local` adapter and validated definitions
- Produces: atomic repository operations, exact/trailing-wildcard matching, JSON import/export

- [x] **Step 1: Write failing path-match tests**

Assert:

```ts
expect(matchesPath("/catalog", "/catalog")).toBe(true);
expect(matchesPath("/catalog/items", "/catalog/*")).toBe(true);
expect(matchesPath("/admin", "/catalog/*")).toBe(false);
expect(parsePathMatch("/catalog/**").ok).toBe(false);
```

- [x] **Step 2: Write failing repository tests**

Use an in-memory `StorageAreaLike`. Test add revision 1, replacement revision 2, enabled state, executor failure recording, agent failure recording, origin isolation, deletion, and list matching page.

- [x] **Step 3: Write failing tool-pack tests**

Test export, parse, mixed-origin rejection, invalid tool atomic rejection, and replacement conflicts. No tool from a failed import may be persisted.

- [x] **Step 4: Run tests and confirm failure**

Run:

```powershell
pnpm --dir experiments/automatic-tool-extension/extension test -- src/storage src/domain/path-match.test.ts src/toolpack
```

Expected: FAIL because repository and tool-pack modules are missing.

- [x] **Step 5: Implement repository and tool packs**

Store under `adaptive-webmcp:state:v1`. Inject `now()` and ID generation. Export plain JSON with `format`, `version`, `exportedAt`, `origin`, and definitions. Parse JSON with `JSON.parse`; never use evaluation or dynamic imports.

- [x] **Step 6: Verify persistence behavior**

Run:

```powershell
pnpm --dir experiments/automatic-tool-extension/extension test -- src/storage src/domain/path-match.test.ts src/toolpack
pnpm --dir experiments/automatic-tool-extension/extension typecheck
```

Expected: PASS.

### Task 5: Implement the packaged main-world executor and bootstrap runtime

**Files:**
- Create: `experiments/automatic-tool-extension/extension/src/main-world/model-context.d.ts`
- Create: `experiments/automatic-tool-extension/extension/src/main-world/model-context.ts`
- Create: `experiments/automatic-tool-extension/extension/src/main-world/resolve-value.ts`
- Create: `experiments/automatic-tool-extension/extension/src/main-world/dom-actions.ts`
- Create: `experiments/automatic-tool-extension/extension/src/main-world/execute-workflow.ts`
- Create: `experiments/automatic-tool-extension/extension/src/main-world/execute-workflow.test.ts`
- Create: `experiments/automatic-tool-extension/extension/src/main-world/bootstrap-runtime.ts`
- Create: `experiments/automatic-tool-extension/extension/src/main-world/bootstrap-runtime.test.ts`
- Modify: `experiments/automatic-tool-extension/extension/src/main-world/index.ts`

**Interfaces:**
- Consumes: bridge request/reply events and serializable bootstrap state
- Produces: one bootstrap registration, dynamic learned registrations, bounded executor, structured recovery results

- [x] **Step 1: Write failing executor tests**

Use the same result codes as the spec. Cover fill, click, wait, extract, missing target, abort, output cap, forbidden target defense, and first-failure stop.

- [x] **Step 2: Write failing bootstrap registration tests**

Use a fake ModelContext and assert:

```ts
installBootstrapRuntime(fakeDocument, bridgeClient);
expect(fakeModelContext.registeredNames()).toEqual(["adaptive_webmcp"]);
expect(fakeModelContext.tool("adaptive_webmcp").description).toBe(BOOTSTRAP_TOOL_DESCRIPTION);
```

Call `inspect` and assert the bridge returns a LearningProtocol. Call `propose` and assert no learned tool registers until an approved bridge reply arrives.

- [x] **Step 3: Run tests and confirm failure**

Run:

```powershell
pnpm --dir experiments/automatic-tool-extension/extension test -- src/main-world
```

Expected: FAIL because runtime modules do not exist.

- [x] **Step 4: Implement model-context feature detection**

Use `document.modelContext?.registerTool`. Define `registerTool(tool, { signal })` and no deprecated primary path. Return a structured unsupported-browser status when absent.

- [x] **Step 5: Implement executor and failure recovery**

On failure, call the bridge with source `executor`, mark the tool unhealthy, and return:

```ts
{
  ok: false,
  failure,
  recovery: {
    tool: "adaptive_webmcp",
    arguments: { operation: "report_failure", toolName, failure }
  }
}
```

- [x] **Step 6: Implement bootstrap operations**

Validate operation fields before bridge calls. `inspect` and `list` are read-only. `propose` waits at most 120 seconds for approval. `report_failure` stores semantic failure evidence. Own learned registrations with AbortController objects keyed by stored tool ID.

- [x] **Step 7: Verify main-world runtime**

Run:

```powershell
pnpm --dir experiments/automatic-tool-extension/extension test -- src/main-world
pnpm --dir experiments/automatic-tool-extension/extension typecheck
```

Expected: PASS.

### Task 6: Build the typed bridge, background coordinator, and site enablement

**Files:**
- Create: `experiments/automatic-tool-extension/extension/src/bridge/messages.ts`
- Create: `experiments/automatic-tool-extension/extension/src/bridge/messages.test.ts`
- Create: `experiments/automatic-tool-extension/extension/src/content/bridge.ts`
- Create: `experiments/automatic-tool-extension/extension/src/background/origin-permissions.ts`
- Create: `experiments/automatic-tool-extension/extension/src/background/content-registration.ts`
- Create: `experiments/automatic-tool-extension/extension/src/background/coordinator.ts`
- Create: `experiments/automatic-tool-extension/extension/src/background/coordinator.test.ts`
- Modify: `experiments/automatic-tool-extension/extension/src/background/index.ts`
- Modify: `experiments/automatic-tool-extension/extension/src/content/index.tsx`

**Interfaces:**
- Consumes: chrome permissions, scripting, tabs, runtime messaging, repository
- Produces: exact-origin enable/disable, persistent content registration, main-world injection, validated request routing

- [x] **Step 1: Write failing message-validation tests**

Every page bridge message must include:

```ts
type BridgeEnvelope = {
  protocol: "adaptive-webmcp-bridge";
  version: 1;
  requestId: string;
  direction: "page-to-extension" | "extension-to-page";
  type: string;
  payload: unknown;
};
```

Reject wrong source direction, version, type, duplicate request ID, and invalid payload.

- [x] **Step 2: Write failing permission and registration tests**

Mock chrome APIs and assert that enabling `https://demo.test/catalog` requests `https://demo.test/*`, stores the origin only after permission succeeds, and registers a persistent isolated content script matching that pattern.

- [x] **Step 3: Write failing coordinator tests**

Test inspect, list, pending proposal creation, approval result, failure recording, enable, disable, and page-ready flows. Assert that the background validates definitions again before persistence.

- [x] **Step 4: Run tests and confirm failure**

Run:

```powershell
pnpm --dir experiments/automatic-tool-extension/extension test -- src/bridge src/background
```

Expected: FAIL because bridge and coordinator do not exist.

- [x] **Step 5: Implement exact-origin permission flow**

Convert URL to `scheme://host/*`. Call `chrome.permissions.request` only from a popup-originated user gesture. Register content scripts with `persistAcrossSessions: true`, `runAt: "document_start"`, and `world: "ISOLATED"`.

- [x] **Step 6: Implement page bridge and main-world injection**

The content bridge accepts only `event.source === window`, the correct protocol, direction, type, and valid payload. On startup it asks the background to inject `main-world.js` with `world: "MAIN"`, then delivers matching stored definitions through the typed page bridge.

- [x] **Step 7: Verify coordination**

Run:

```powershell
pnpm --dir experiments/automatic-tool-extension/extension test -- src/bridge src/background
pnpm --dir experiments/automatic-tool-extension/extension typecheck
```

Expected: PASS.

### Task 7: Implement extension-owned proposal approval

**Files:**
- Create: `experiments/automatic-tool-extension/extension/src/approval/ApprovalPanel.tsx`
- Create: `experiments/automatic-tool-extension/extension/src/approval/ApprovalPanel.test.tsx`
- Create: `experiments/automatic-tool-extension/extension/src/approval/approval-controller.ts`
- Create: `experiments/automatic-tool-extension/extension/src/approval/approval-controller.test.ts`
- Modify: `experiments/automatic-tool-extension/extension/src/content/index.tsx`

**Interfaces:**
- Consumes: pending proposal messages from background
- Produces: isolated-world Shadow DOM review, approve/reject/expire decisions

- [x] **Step 1: Write failing panel tests**

Render a proposal and assert that origin, path, name, description, classification, input schema, every workflow step, selectors, and replacement warning are visible. Test Approve and Reject callbacks and keyboard focus.

- [x] **Step 2: Write failing controller tests**

Use fake timers. Assert that pending proposals expire at 120 seconds, late decisions are rejected, and only the active request ID can resolve.

- [x] **Step 3: Run tests and confirm failure**

Run:

```powershell
pnpm --dir experiments/automatic-tool-extension/extension test -- src/approval
```

Expected: FAIL because approval modules do not exist.

- [x] **Step 4: Implement Shadow DOM mounting**

Create one host element with an open ShadowRoot from the isolated content world. Fetch packaged `styles.css` through `chrome.runtime.getURL`, place its text in a ShadowRoot `<style>`, and never load remote styles. The host page may observe the element, so treat all messages as untrusted and rely on background validation plus the user's explicit decision.

- [x] **Step 5: Implement approval messages**

Send `proposal.approve`, `proposal.reject`, or `proposal.expire` to background with request ID. Do not expose approval through window globals, DOM custom events, or WebMCP tools.

- [x] **Step 6: Verify approval UI**

Run:

```powershell
pnpm --dir experiments/automatic-tool-extension/extension test -- src/approval
pnpm --dir experiments/automatic-tool-extension/extension typecheck
```

Expected: PASS.

### Task 8: Build popup management and import/export

**Files:**
- Create: `experiments/automatic-tool-extension/extension/src/popup/Popup.tsx`
- Create: `experiments/automatic-tool-extension/extension/src/popup/useActiveTab.ts`
- Create: `experiments/automatic-tool-extension/extension/src/popup/ToolList.tsx`
- Create: `experiments/automatic-tool-extension/extension/src/popup/ImportReviewDialog.tsx`
- Create: `experiments/automatic-tool-extension/extension/src/popup/Popup.test.tsx`
- Modify: `experiments/automatic-tool-extension/extension/src/popup/main.tsx`

**Interfaces:**
- Consumes: background runtime messages and tool-pack helpers
- Produces: enable/disable, health view, export, reviewed import, replacement, deletion

- [x] **Step 1: Expand failing popup tests**

Cover disabled origin, permission denial, enabled origin, protocol version, tool health, failure summary, pending proposal, export download, import review, conflict replacement, disable, and delete confirmation.

- [x] **Step 2: Run tests and confirm failure**

Run:

```powershell
pnpm --dir experiments/automatic-tool-extension/extension test -- src/popup
```

Expected: FAIL until the popup modules are implemented.

- [x] **Step 3: Implement site enablement UI**

Read the active tab URL, reject unsupported schemes, and call background `site.enable` only from the button click. Show permission errors without claiming enablement.

- [x] **Step 4: Implement management controls**

List tool name, revision, path, classification, enabled state, health, and last failure. Require explicit confirmation for replacement, import, and deletion.

- [x] **Step 5: Implement file export and import**

Export through a Blob download. Import with `<input type="file" accept="application/json,.json">`, parse as text, validate the entire pack, display review details, and send one atomic import request after approval.

- [x] **Step 6: Verify popup behavior and build**

Run:

```powershell
pnpm --dir experiments/automatic-tool-extension/extension test -- src/popup
pnpm --dir experiments/automatic-tool-extension/extension typecheck
pnpm --dir experiments/automatic-tool-extension/extension build
```

Expected: PASS and complete popup assets in `dist`.

### Task 9: Add loaded-extension browser tests

**Files:**
- Create: `experiments/automatic-tool-extension/extension/playwright.config.ts`
- Create: `experiments/automatic-tool-extension/extension/e2e/automatic-tools.spec.ts`
- Create: `experiments/automatic-tool-extension/extension/e2e/support/fake-model-context.ts`
- Create: `experiments/automatic-tool-extension/extension/e2e/support/extension-context.ts`

**Interfaces:**
- Consumes: built extension, running demo, Chromium persistent context
- Produces: automated proof of enablement, inspect, proposal, approval, registration, restoration, import/export, and failure

- [x] **Step 1: Configure demo web server and extension build**

Use Playwright `webServer` commands that build the extension and run the demo on `http://127.0.0.1:4174`. Launch a persistent Chromium context with:

```ts
args: [
  `--disable-extensions-except=${extensionPath}`,
  `--load-extension=${extensionPath}`
]
```

Run headed locally because extension service workers and popup UI must execute.

Install the project-local browser once:

```powershell
pnpm --dir experiments/automatic-tool-extension/extension exec playwright install chromium
```

- [x] **Step 2: Install the fake ModelContext before page scripts**

Use `context.addInitScript` to define `document.modelContext` with `registerTool`, `getTools`, and `executeTool`. Respect AbortSignal removal so lifecycle tests match the current API.

- [x] **Step 3: Write the failing primary extension journey**

The test must:

```text
open demo and assert no catalog tool
open extension popup
enable exact origin and accept permission
reload demo
assert only adaptive_webmcp exists
invoke inspect with no extension-specific page prompt
assert protocol phases and constraints
perform normal catalog task
invoke propose with a concrete definition
approve through isolated panel
assert learned tool appears
invoke learned tool and assert shortlist
reload and assert restoration
```

- [x] **Step 4: Write the failing import and failure journey**

Export the pack, delete the tool, import and approve it, reload, invoke it, switch demo to version 2, assert stale-target failure, invoke `report_failure`, then assert the next `inspect` response reports the unhealthy tool and replacement guidance.

- [x] **Step 5: Run tests and confirm failure**

Run:

```powershell
pnpm --dir experiments/automatic-tool-extension test:e2e
```

Expected: FAIL until all runtime paths are integrated.

- [x] **Step 6: Complete integration wiring and rerun**

Fix only gaps required by the journeys. Run:

```powershell
pnpm --dir experiments/automatic-tool-extension test:e2e
```

Expected: both journeys pass.

### Task 10: Add reproducible docs, real WebMCP verification, and release checks

**Files:**
- Create: `experiments/automatic-tool-extension/README.md`
- Create: `experiments/automatic-tool-extension/extension/README.md`
- Create: `experiments/automatic-tool-extension/demo-web/README.md`
- Create: `experiments/automatic-tool-extension/docs/REAL-WEBMCP-TEST.md`
- Create: `experiments/automatic-tool-extension/docs/DEMO-SCRIPT.md`
- Create: `experiments/automatic-tool-extension/docs/COMPARISON-EVIDENCE.md`
- Create: `experiments/automatic-tool-extension/LICENSE`

**Interfaces:**
- Consumes: complete builds and test output
- Produces: public-repository setup, unpacked-extension instructions, hosted demo instructions, challenge evidence

- [x] **Step 1: Document installation and architecture**

README must cover prerequisites, install, build, load unpacked extension, enable WebMCP flag, enable exact origin, run demo, test, package artifact, permissions, structured protocol, bridge, safety boundaries, limitations, and static deployment.

- [x] **Step 2: Write the real Chrome verification checklist**

Require recording:

```text
Chrome exact version >=149
chrome://flags/#enable-webmcp-testing state
extension build hash
demo URL
agent and model
adaptive_webmcp discovery
inspect selection without pasted prompt
protocol response
normal exploration
propose call
human approval
same-session learned-tool discovery
learned-tool invocation
reload restoration
export/import restoration
version 2 failure and recovery guidance
```

- [x] **Step 3: Write a sub-three-minute demo script**

Use these windows:

```text
0:00-0:18 unsupported site and problem
0:18-0:38 enable extension and discover bootstrap
0:38-1:00 structured inspect protocol
1:00-1:25 explore and propose
1:25-1:48 human approval and registration
1:48-2:10 reload and reuse
2:10-2:32 export/import
2:32-2:48 stale failure and recovery
2:48-2:58 measured claim and close
```

- [x] **Step 4: Add license and evidence template**

Status: evidence template and MIT license complete.

Use the MIT license with the user's chosen copyright holder. If that holder has not been supplied at execution time, stop before creating `LICENSE` and request the exact holder name; do not invent ownership information.

Keep measurement cells unchecked until real runs provide values.

- [x] **Step 5: Run the complete verification suite**

Run:

```powershell
pnpm --dir experiments/automatic-tool-extension test
pnpm --dir experiments/automatic-tool-extension typecheck
pnpm --dir experiments/automatic-tool-extension build
pnpm --dir experiments/automatic-tool-extension test:e2e
```

Expected: every command exits with code 0.

- [x] **Step 6: Inspect output and repository state**

Run:

```powershell
Get-ChildItem -Recurse -File 'experiments\automatic-tool-extension\extension\dist'
git status --short --branch
git diff --check
```

Expected: manifest, background, content, main-world, popup, styles, and source maps exist; only intended uncommitted files are present; no commit, branch, or worktree was created.
