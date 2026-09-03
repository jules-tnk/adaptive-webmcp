# Capability Forge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a hosted, install-free WebMCP application that records one successful catalog workflow, lets an agent propose a constrained capability, requires human review, verifies the capability, registers it dynamically, and demonstrates repair after a DOM change.

**Architecture:** A Vite React application contains a controlled legacy lab and a Capability Forge control surface on one origin. Focused domain modules own schemas, recording, execution, verification, persistence, and WebMCP lifecycle; React components consume those modules and expose the human review experience.

**Tech Stack:** Vite, React, TypeScript, Tailwind CSS, Zod, Vitest, Testing Library, Playwright, browser localStorage

**Spec:** `docs/superpowers/specs/2026-08-27-capability-forge-design.md`

## Global Constraints

- Work in the existing repository and current branch; do not create a branch or worktree.
- Do not create a Git commit unless the user asks for one.
- Create all implementation files under `experiments/capability-forge/`.
- Do not share implementation code with `experiments/automatic-tool-extension/` during the comparison phase.
- Do not add a required backend, embedded LLM, or server-side AI API.
- Register current WebMCP tools through `document.modelContext.registerTool()` with AbortSignal lifecycle.
- Keep the workflow language to `fill`, `click`, `waitFor`, and `extract`.
- Reject generated or imported JavaScript, navigation, network requests, unsafe targets, and cross-origin scopes.
- Enforce 12 steps, 5 seconds per wait, 20 extracted items, and 32 KB serialized output.
- Require a direct human UI action for approval and replacement.
- Keep the legacy lab functional when WebMCP is unavailable.
- Follow TDD for domain behavior and browser tests for the visible workflow.
- Use `pnpm` and keep a project-local lockfile.

---

### Task 1: Scaffold the application and test harness

**Files:**
- Create: `experiments/capability-forge/package.json`
- Create: `experiments/capability-forge/tsconfig.json`
- Create: `experiments/capability-forge/tsconfig.app.json`
- Create: `experiments/capability-forge/vite.config.ts`
- Create: `experiments/capability-forge/index.html`
- Create: `experiments/capability-forge/src/main.tsx`
- Create: `experiments/capability-forge/src/App.tsx`
- Create: `experiments/capability-forge/src/app/router.tsx`
- Create: `experiments/capability-forge/src/styles.css`
- Create: `experiments/capability-forge/src/test/setup.ts`
- Create: `experiments/capability-forge/src/App.test.tsx`
- Create: `experiments/capability-forge/playwright.config.ts`

**Interfaces:**
- Consumes: Node.js and pnpm available in the workspace
- Produces: `pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm test`, and `pnpm test:e2e` commands

- [x] **Step 1: Scaffold Vite React TypeScript**

Run from the repository root:

```powershell
New-Item -ItemType Directory -Path 'experiments\capability-forge' -Force | Out-Null
pnpm create vite@latest experiments/capability-forge --template react-ts
pnpm --dir experiments/capability-forge add react-router-dom zod
pnpm --dir experiments/capability-forge add -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test tailwindcss @tailwindcss/vite
```

Expected: Vite creates the application and pnpm creates `experiments/capability-forge/pnpm-lock.yaml`.

- [x] **Step 2: Configure scripts and test environment**

Set these scripts in `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc -b --pretty false",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  }
}
```

Configure `vite.config.ts`:

```ts
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
```

Create `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [x] **Step 3: Write the failing shell test**

Create `src/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("Capability Forge shell", () => {
  it("identifies the lab and forge surfaces", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Capability Forge" })).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Prototype sections" })).toBeVisible();
  });
});
```

- [x] **Step 4: Run the test and confirm failure**

Run:

```powershell
pnpm --dir experiments/capability-forge test -- src/App.test.tsx
```

Expected: FAIL because the generated Vite shell does not contain the required heading or navigation.

- [x] **Step 5: Implement the minimal application shell**

Replace `src/App.tsx` with a shell containing the `Capability Forge` heading and a `nav` with `aria-label="Prototype sections"`. Create a BrowserRouter in `src/app/router.tsx` that redirects `/` to `/lab` and renders the application shell at `/lab`. Import `src/styles.css` from `src/main.tsx` and begin `src/styles.css` with:

```css
@import "tailwindcss";

:root {
  color: #17211b;
  background: #f4f1e8;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}
```

- [x] **Step 6: Verify the scaffold**

Run:

```powershell
pnpm --dir experiments/capability-forge test
pnpm --dir experiments/capability-forge typecheck
pnpm --dir experiments/capability-forge build
```

Expected: all three commands exit with code 0.

### Task 2: Define capability contracts and validation

**Files:**
- Create: `experiments/capability-forge/src/capability/types.ts`
- Create: `experiments/capability-forge/src/capability/schema.ts`
- Create: `experiments/capability-forge/src/capability/validate-capability.ts`
- Create: `experiments/capability-forge/src/capability/validate-capability.test.ts`

**Interfaces:**
- Consumes: Zod
- Produces: `CapabilityDefinition`, `WorkflowStep`, `ValueExpression`, `ExpectedEffect`, `validateCapability(input, currentOrigin)`

- [x] **Step 1: Define the public TypeScript contracts**

Create `src/capability/types.ts` with the exact spec contracts and these result types:

```ts
export type CapabilityValidationIssue = {
  path: string;
  code: string;
  message: string;
};

export type CapabilityValidationResult =
  | { ok: true; value: CapabilityDefinition }
  | { ok: false; issues: CapabilityValidationIssue[] };
```

Use `classification: "read" | "client-write"`, `format: "capability-forge"`, and `version: 1` exactly.

- [x] **Step 2: Write failing validation tests**

Create `src/capability/validate-capability.test.ts` with tests that assert:

```ts
const validStep = { action: "click" as const, selector: "[data-shortlist]" };
const validCapability: CapabilityDefinition = {
  format: "capability-forge",
  version: 1,
  name: "find_and_shortlist_item",
  description: "Search the catalog and add the first matching item to the shortlist.",
  scope: { origin: "https://forge.test", pathname: "/lab" },
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string" },
      category: { type: "string" }
    },
    required: ["query", "category"],
    additionalProperties: false
  },
  classification: "client-write",
  workflow: [validStep],
  expected: { kind: "shortlist-size-delta", delta: 1 }
};

expect(validateCapability(validCapability, "https://forge.test").ok).toBe(true);
expect(validateCapability({ ...validCapability, workflow: Array(13).fill(validStep) }, "https://forge.test").ok).toBe(false);
expect(validateCapability({ ...validCapability, scope: { origin: "https://evil.test", pathname: "/lab" } }, "https://forge.test").ok).toBe(false);
expect(validateCapability({ ...validCapability, workflow: [{ action: "click", selector: "script" }] }, "https://forge.test").ok).toBe(false);
```

The fixture must include a valid object schema with `additionalProperties: false`, one `fill`, one `click`, one `waitFor`, and one `extract` step.

- [x] **Step 3: Run tests and confirm failure**

Run:

```powershell
pnpm --dir experiments/capability-forge test -- src/capability/validate-capability.test.ts
```

Expected: FAIL because `validateCapability` does not exist.

- [x] **Step 4: Implement schemas and policy validation**

Implement Zod discriminated unions for all four workflow actions. Add a second policy pass that rejects:

```ts
const forbiddenTargets = ["script", "iframe", "input[type=password]", "input[type=file]", "input[type=hidden]"];
```

Require exact current origin, `/lab` pathname, unique `extract.saveAs` names, valid step references, at most 12 steps, and wait time from 0 through 5000 milliseconds.

- [x] **Step 5: Verify capability validation**

Run:

```powershell
pnpm --dir experiments/capability-forge test -- src/capability/validate-capability.test.ts
pnpm --dir experiments/capability-forge typecheck
```

Expected: PASS with all validation cases green.

### Task 3: Build the versioned legacy catalog lab

**Files:**
- Create: `experiments/capability-forge/src/lab/catalog-fixture.ts`
- Create: `experiments/capability-forge/src/lab/lab-store.ts`
- Create: `experiments/capability-forge/src/lab/LegacyLab.tsx`
- Create: `experiments/capability-forge/src/lab/LegacyLab.test.tsx`
- Modify: `experiments/capability-forge/src/App.tsx`

**Interfaces:**
- Consumes: React
- Produces: `CatalogItem`, `LabVersion`, `createLabStore()`, `<LegacyLab store version />`

- [x] **Step 1: Write failing lab interaction tests**

Test version 1 search and shortlist behavior:

```tsx
const user = userEvent.setup();
render(<LegacyLab store={createLabStore()} version="v1" />);
await user.type(screen.getByLabelText("Search catalog"), "lamp");
await user.selectOptions(screen.getByLabelText("Category"), "home");
await user.click(screen.getByRole("button", { name: "Search" }));
await user.click(screen.getByRole("button", { name: "Shortlist Cedar Lamp" }));
expect(screen.getByText("Cedar Lamp", { selector: "[data-shortlist-item]" })).toBeVisible();
```

Add a second test confirming version 2 uses the same accessible labels and behavior but different `name`, `data-*`, and wrapper structure.

- [x] **Step 2: Run tests and confirm failure**

Run:

```powershell
pnpm --dir experiments/capability-forge test -- src/lab/LegacyLab.test.tsx
```

Expected: FAIL because the lab files do not exist.

- [x] **Step 3: Implement deterministic fixtures and store**

Create these fixed catalog items:

```ts
[
  { id: "cedar-lamp", name: "Cedar Lamp", category: "home", price: 79 },
  { id: "field-notebook", name: "Field Notebook", category: "office", price: 18 },
  { id: "trail-flask", name: "Trail Flask", category: "outdoors", price: 32 },
  { id: "studio-headphones", name: "Studio Headphones", category: "electronics", price: 149 },
  { id: "linen-throw", name: "Linen Throw", category: "home", price: 54 }
]
```

Implement store operations:

```ts
export type LabStore = {
  getState(): LabState;
  subscribe(listener: () => void): () => void;
  search(query: string, category: string): void;
  shortlist(itemId: string): void;
  reset(): void;
};
```

Keep state in memory and expose `useSyncExternalStore` integration from the component.

- [x] **Step 4: Implement both DOM versions**

Version 1 must use selectors such as `[name="catalog-query"]`, `[name="catalog-category"]`, and `[data-result-card]`. Version 2 must preserve labels while changing those attributes so a version 1 capability fails selector preflight.

- [x] **Step 5: Mount the lab and verify**

Render `LegacyLab` in `App.tsx` with a visible version switch and reset button. Run:

```powershell
pnpm --dir experiments/capability-forge test -- src/lab/LegacyLab.test.tsx
pnpm --dir experiments/capability-forge typecheck
```

Expected: PASS.

### Task 4: Record and normalize teaching interactions

**Files:**
- Create: `experiments/capability-forge/src/recorder/types.ts`
- Create: `experiments/capability-forge/src/recorder/selector-evidence.ts`
- Create: `experiments/capability-forge/src/recorder/teaching-recorder.ts`
- Create: `experiments/capability-forge/src/recorder/teaching-recorder.test.ts`
- Create: `experiments/capability-forge/src/recorder/useTeachingRecorder.ts`

**Interfaces:**
- Consumes: lab-root DOM events
- Produces: `TeachingTrace`, `TeachingRecorder.start(name)`, `TeachingRecorder.stop()`, `TeachingRecorder.getTrace()`

- [x] **Step 1: Write failing recorder tests**

Use a jsdom lab root and assert that input, click, and result-observation events become bounded records:

```ts
recorder.start("find and shortlist");
input.value = "lamp";
input.dispatchEvent(new Event("input", { bubbles: true }));
button.click();
results.replaceChildren(resultCard);
await Promise.resolve();
const trace = recorder.stop();
expect(trace.events.map((event) => event.action)).toEqual([
  "fill", "click", "waitFor", "extract"
]);
expect(trace.events[0]).toMatchObject({ label: "Search catalog", value: "lamp" });
```

Add tests that password inputs, events outside `[data-lab-root]`, and more than 40 events are rejected.

- [x] **Step 2: Run tests and confirm failure**

Run:

```powershell
pnpm --dir experiments/capability-forge test -- src/recorder/teaching-recorder.test.ts
```

Expected: FAIL because the recorder does not exist.

- [x] **Step 3: Implement selector evidence**

Generate evidence in this order: stable `data-*`, `name`, `id`, accessible label, role and text. Store candidate selectors and evidence; do not store arbitrary surrounding page text.

```ts
export type SelectorEvidence = {
  selected: string;
  candidates: string[];
  label?: string;
  role?: string;
};
```

- [x] **Step 4: Implement recorder lifecycle**

Attach listeners only while recording. Normalize `input`, `change`, and `click`. Observe the lab's marked result region with MutationObserver; when results appear, record one `waitFor` event and one bounded `extract` evidence event for the result cards. Cap traces at 40 events and 32 KB. Return immutable copies.

- [x] **Step 5: Verify recorder behavior**

Run:

```powershell
pnpm --dir experiments/capability-forge test -- src/recorder/teaching-recorder.test.ts
pnpm --dir experiments/capability-forge typecheck
```

Expected: PASS.

### Task 5: Implement the constrained workflow executor

**Files:**
- Create: `experiments/capability-forge/src/executor/resolve-value.ts`
- Create: `experiments/capability-forge/src/executor/dom-actions.ts`
- Create: `experiments/capability-forge/src/executor/execute-workflow.ts`
- Create: `experiments/capability-forge/src/executor/execute-workflow.test.ts`

**Interfaces:**
- Consumes: `CapabilityDefinition`, validated input object, lab root, AbortSignal
- Produces: `executeWorkflow(options): Promise<WorkflowExecutionResult>`

- [x] **Step 1: Define execution results and write failing tests**

Use this result contract:

```ts
export type WorkflowExecutionResult =
  | { ok: true; outputs: Record<string, unknown>; durationMs: number }
  | {
      ok: false;
      code: "TARGET_NOT_FOUND" | "TIMEOUT" | "ABORTED" | "OUTPUT_LIMIT" | "EXECUTION_ERROR";
      failedStep: number;
      message: string;
      durationMs: number;
    };
```

Write tests for successful fill and click, missing selector, timeout, abort, input reference, step reference, and output-size failure.

- [x] **Step 2: Run tests and confirm failure**

Run:

```powershell
pnpm --dir experiments/capability-forge test -- src/executor/execute-workflow.test.ts
```

Expected: FAIL because `executeWorkflow` does not exist.

- [x] **Step 3: Implement value resolution and DOM actions**

Resolve only declared inputs, literals, and saved extraction outputs. Dispatch `input` and `change` events after setting values. Use `HTMLElement.click()` for click and MutationObserver plus timeout for wait.

- [x] **Step 4: Implement sequential execution**

Check AbortSignal before and after each step. Restrict queries to the supplied lab root. Stop on the first failure and include its zero-based index. Extract only text, value, or an allowlisted attribute.

- [x] **Step 5: Verify the executor**

Run:

```powershell
pnpm --dir experiments/capability-forge test -- src/executor/execute-workflow.test.ts
pnpm --dir experiments/capability-forge typecheck
```

Expected: PASS.

### Task 6: Add preflight, replay verification, and revision persistence

**Files:**
- Create: `experiments/capability-forge/src/verifier/preflight.ts`
- Create: `experiments/capability-forge/src/verifier/verify-capability.ts`
- Create: `experiments/capability-forge/src/verifier/verify-capability.test.ts`
- Create: `experiments/capability-forge/src/registry/types.ts`
- Create: `experiments/capability-forge/src/registry/capability-repository.ts`
- Create: `experiments/capability-forge/src/registry/capability-repository.test.ts`

**Interfaces:**
- Consumes: executor, lab store, capability definition
- Produces: `preflightCapability`, `verifyCapability`, `CapabilityRepository`

- [x] **Step 1: Write failing preflight and verification tests**

Assert that version 1 resolves all selectors, version 2 identifies the first missing selector, and a replay only passes when shortlist size increases by one.

```ts
expect(preflightCapability(capability, v2Root)).toEqual({
  ok: false,
  code: "TARGET_NOT_FOUND",
  failedStep: 0,
  selector: "[name=\"catalog-query\"]",
});
```

- [x] **Step 2: Write failing repository transition tests**

Test these legal transitions:

```text
proposed -> rejected
proposed -> approved -> verifying -> verified
approved -> verifying -> failed
verified -> superseded
```

Assert that failed revisions cannot become active and that persistence restores only the last verified active revision.

- [x] **Step 3: Run tests and confirm failure**

Run:

```powershell
pnpm --dir experiments/capability-forge test -- src/verifier src/registry
```

Expected: FAIL because verifier and repository modules do not exist.

- [x] **Step 4: Implement verifier and repository**

Use dependency injection for `Storage` and `now()` so tests stay deterministic. Store under `capability-forge:registry:v1`. Verification must reset the lab before and after replay, compare `ExpectedEffect`, and preserve the previous verified revision when a replacement fails.

- [x] **Step 5: Verify persistence and replay**

Run:

```powershell
pnpm --dir experiments/capability-forge test -- src/verifier src/registry
pnpm --dir experiments/capability-forge typecheck
```

Expected: PASS.

### Task 7: Register forge and compiled WebMCP tools

**Files:**
- Create: `experiments/capability-forge/src/webmcp/model-context.d.ts`
- Create: `experiments/capability-forge/src/webmcp/types.ts`
- Create: `experiments/capability-forge/src/webmcp/model-context-adapter.ts`
- Create: `experiments/capability-forge/src/webmcp/forge-tool-definitions.ts`
- Create: `experiments/capability-forge/src/webmcp/compiled-tool-registration.ts`
- Create: `experiments/capability-forge/src/webmcp/model-context-adapter.test.ts`
- Create: `experiments/capability-forge/src/webmcp/useForgeTools.ts`

**Interfaces:**
- Consumes: recorder, validator, repository, verifier, executor
- Produces: five stable forge tools and dynamic compiled-tool lifecycle

- [x] **Step 1: Write a fake ModelContext and failing lifecycle tests**

Create an in-memory fake that records calls to `registerTool`. Test that:

```ts
expect(fake.registeredNames()).toEqual([
  "forge_start_teaching",
  "forge_get_trace",
  "forge_propose_capability",
  "forge_run_preflight",
  "forge_open_review",
]);
```

Add a test that aborting a compiled tool's controller removes the old registration before its verified replacement registers.

- [x] **Step 2: Run tests and confirm failure**

Run:

```powershell
pnpm --dir experiments/capability-forge test -- src/webmcp/model-context-adapter.test.ts
```

Expected: FAIL because the adapter does not exist.

- [x] **Step 3: Define the current browser surface**

Augment `Document` with optional `modelContext` and define:

```ts
export type ModelContextLike = {
  registerTool(
    tool: WebMcpTool,
    options?: { signal?: AbortSignal },
  ): Promise<void> | void;
};
```

Feature-detect `document.modelContext?.registerTool`. Do not use deprecated `navigator.modelContext` in the primary implementation.

- [x] **Step 4: Implement stable forge tools**

Map each tool to the approved spec behavior. Mark `forge_get_trace` and `forge_run_preflight` read-only. `forge_propose_capability` stores status `proposed` and opens no approval automatically. `forge_open_review` changes only UI state.

- [x] **Step 5: Implement compiled tool registration**

Register only the repository's active verified definitions. Validate inputs inside `execute`, call `executeWorkflow`, and return structured results. Own every registration with an AbortController map keyed by capability ID.

- [x] **Step 6: Verify WebMCP lifecycle**

Run:

```powershell
pnpm --dir experiments/capability-forge test -- src/webmcp
pnpm --dir experiments/capability-forge typecheck
```

Expected: PASS.

### Task 8: Build review, verification, repair, and metrics UI

**Files:**
- Create: `experiments/capability-forge/src/review/ReviewPanel.tsx`
- Create: `experiments/capability-forge/src/review/ReviewPanel.test.tsx`
- Create: `experiments/capability-forge/src/review/FailureReport.tsx`
- Create: `experiments/capability-forge/src/metrics/metrics-store.ts`
- Create: `experiments/capability-forge/src/metrics/MetricsPanel.tsx`
- Create: `experiments/capability-forge/src/metrics/metrics-store.test.ts`
- Create: `experiments/capability-forge/src/app/ForgeWorkspace.tsx`
- Modify: `experiments/capability-forge/src/App.tsx`

**Interfaces:**
- Consumes: repository, verifier, lab, recorder, WebMCP adapter
- Produces: visible teach, review, verify, reuse, and repair experience

- [x] **Step 1: Write failing review tests**

Render a proposed capability and assert that the panel shows name, description, origin, classification, schema, every workflow step, selector, and expected effect. Test that the Approve button calls verification and does not mark the proposal verified before verification succeeds.

- [x] **Step 2: Write failing metric tests**

Use this snapshot contract:

```ts
export type ComparisonMetrics = {
  teachingInteractions: number;
  compiledSteps: number;
  reuseToolCalls: number;
  lastExecutionMs: number | null;
  preflight: "not-run" | "passed" | "failed";
  replay: "not-run" | "passed" | "failed";
  repairAttempts: number;
};
```

Assert deterministic increments and reset behavior.

- [x] **Step 3: Run tests and confirm failure**

Run:

```powershell
pnpm --dir experiments/capability-forge test -- src/review src/metrics
```

Expected: FAIL because UI and metric modules do not exist.

- [x] **Step 4: Implement the workspace UI**

Build a restrained desktop-first layout with:

```text
header: product thesis + WebMCP status
left: legacy lab
right: teach / proposal / verification / repair panel
bottom: first-run vs reuse evidence
```

Use accessible buttons, dialogs, field labels, focus management, and status announcements. Do not hide critical state in hover-only UI.

- [x] **Step 5: Wire human-only approval**

Keep approval callbacks inside React event handlers. Do not export approval as a WebMCP tool or callable global. A failed replacement must render its failure while the prior verified revision remains active.

- [x] **Step 6: Verify UI behavior**

Run:

```powershell
pnpm --dir experiments/capability-forge test -- src/review src/metrics src/App.test.tsx
pnpm --dir experiments/capability-forge typecheck
```

Expected: PASS.

### Task 9: Add browser-level end-to-end coverage

**Files:**
- Create: `experiments/capability-forge/e2e/capability-forge.spec.ts`
- Create: `experiments/capability-forge/e2e/support/install-model-context.ts`
- Modify: `experiments/capability-forge/playwright.config.ts`

**Interfaces:**
- Consumes: built application and fake ModelContext installed before app scripts
- Produces: automated proof of teach, propose, approve, verify, reuse, failure, and repair

- [x] **Step 1: Configure Playwright web server**

Set `webServer.command` to `pnpm dev --host 127.0.0.1`, `url` to `http://127.0.0.1:4173`, and reuseExistingServer to false. Set Vite's test port to 4173.

Install the project-local browser once:

```powershell
pnpm --dir experiments/capability-forge exec playwright install chromium
```

- [x] **Step 2: Write the failing primary journey**

The test must:

```text
install fake document.modelContext
open the app
start teaching
perform catalog search and shortlist
stop teaching
invoke forge_get_trace through the fake
invoke forge_propose_capability with a concrete definition
approve in UI
wait for replay success
invoke find_and_shortlist_item through the fake
assert shortlist and metrics
reload and assert the compiled tool returns
```

Store the concrete definition as a typed fixture in the test file; do not generate code at runtime.

- [x] **Step 3: Write the failing repair journey**

Switch to version 2, invoke preflight, assert the exact stale selector, submit a revised definition using version 2 selectors, approve it, and assert that the replacement only activates after replay passes.

- [x] **Step 4: Run tests and confirm failure**

Run:

```powershell
pnpm --dir experiments/capability-forge test:e2e
```

Expected: FAIL until application wiring satisfies the full journeys.

- [x] **Step 5: Complete integration wiring and rerun**

Connect App providers, stores, repository hydration, registration lifecycle, and UI states required by the tests. Run:

```powershell
pnpm --dir experiments/capability-forge test:e2e
```

Expected: both journeys pass.

### Task 10: Add documentation, challenge evidence, and release checks

**Files:**
- Create: `experiments/capability-forge/README.md`
- Create: `experiments/capability-forge/docs/REAL-WEBMCP-TEST.md`
- Create: `experiments/capability-forge/docs/DEMO-SCRIPT.md`
- Create: `experiments/capability-forge/docs/COMPARISON-EVIDENCE.md`
- Create: `experiments/capability-forge/LICENSE`

**Interfaces:**
- Consumes: completed app and verification output
- Produces: reproducible setup, deployment, testing, and three-minute-demo materials

- [x] **Step 1: Write complete project instructions**

README must include prerequisites, install, dev, test, build, preview, browser requirements, architecture, safety boundaries, limitations, and deployment instructions for a static host.

- [x] **Step 2: Write the real WebMCP checklist**

`REAL-WEBMCP-TEST.md` must contain separate result tables for ChatGPT's in-app browser and Chrome 149 or later with `chrome://flags/#enable-webmcp-testing`. Each table must require recording:

```text
browser and exact version
flag or origin-trial state
agent and model
forge tool discovery
trace read
proposal call
human approval
compiled tool discovery
compiled tool invocation
reload restoration
version 2 failure
repair activation
```

- [x] **Step 3: Write a sub-three-minute demo script**

Use these windows:

```text
0:00-0:20 problem and unsupported lab
0:20-0:55 teach
0:55-1:25 compile and review
1:25-1:50 verify and reuse
1:50-2:25 break and repair
2:25-2:50 metrics and architecture
2:50-2:58 closing claim
```

- [x] **Step 4: Add license and evidence template**

Status: evidence template and MIT license complete.

Use the MIT license with the user's chosen copyright holder. If that holder has not been supplied at execution time, stop before creating `LICENSE` and request the exact holder name; do not invent ownership information.

`COMPARISON-EVIDENCE.md` must contain empty measurement fields represented as unchecked checkboxes rather than fabricated values.

- [x] **Step 5: Run the complete verification suite**

Run:

```powershell
pnpm --dir experiments/capability-forge test
pnpm --dir experiments/capability-forge typecheck
pnpm --dir experiments/capability-forge build
pnpm --dir experiments/capability-forge test:e2e
```

Expected: every command exits with code 0.

- [x] **Step 6: Inspect repository state**

Run:

```powershell
git status --short --branch
git diff --check
```

Expected: only intended uncommitted files are present; no commit, branch, or worktree was created.
