# WebMCP Capability Forge Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Manifest V3 extension that learns reusable WebMCP workflows from human demonstrations, bounded agent exploration, or a hybrid trace, then reviews, verifies, persists, reuses, and repairs them.

**Architecture:** A pnpm workspace contains a pure TypeScript core package, a Chrome extension, and a deterministic Vite lab. The extension separates the isolated recorder and explorer, trusted background control plane, main-world WebMCP runtime, and React side panel while all surfaces share enum-backed contracts and validated JSON messages.

**Tech Stack:** Node.js 22, pnpm 9, TypeScript 6, React 19, Manifest V3, Chrome 149+, esbuild, Zod 4, Tailwind CSS 4, Vite 8, Vitest 4, jsdom 30, Playwright 1.62, `chrome.storage.local`, WebMCP imperative API

**Spec:** `docs/superpowers/specs/2026-08-29-webmcp-capability-forge-extension-design.md`

## Global Constraints

- Work in the current repository and branch. Create no branch or worktree.
- Create the merged product under `experiments/webmcp-capability-forge/` and leave both existing prototypes unchanged.
- Do not create a Git commit unless the user asks for one.
- Follow repository `AGENTS.md`: use a static-method class when one TypeScript file exports more than one function, replace deterministic string sets with string enums, and author no explicit `any` or `unknown` types.
- Omit `erasableSyntaxOnly` because the required TypeScript string enums need runtime emission.
- Run `pnpm check:rules` after each task that adds TypeScript.
- Keep agent proposals, imports, page content, and tool output as validated data. Execute packaged extension code only.
- Permit one active session per tab, 20 exploratory actions, 10 minutes, 32 KB per observation, 5 seconds per wait, 20 extracted items, and 32 KB serialized tool output.
- Support top-level HTTP/HTTPS pages, standard DOM, open Shadow DOM, and same-origin routes in the current tab.
- Exclude cross-origin iframes, closed Shadow DOM, cross-origin continuation, multiple tabs, authentication, CAPTCHAs, native dialogs, page uploads, and page downloads.
- Require direct human approval for site enablement, learning start, proposals, replacements, imports, deletion, and risk confirmations.
- Block credentials, payment data, authentication codes, file inputs, generated JavaScript, arbitrary network requests, and arbitrary URL navigation.
- Add no component-level UI tests. Validate the popup, side panel, homepage, and lab through loaded-extension Playwright journeys.
- Treat a full document navigation as a checkpointed extension execution. The current WebMCP proposal lists cross-document tool responses as an open question, and inactive documents cannot expose tools. Persist the continuation, resume it in the new document, and expose the final outcome through `capability_forge.inspect`; do not claim that the original document callback survives navigation. See `https://github.com/webmachinelearning/webmcp/blob/main/README.md` and `security-privacy-questionnaire.md`.
- Keep live public websites out of CI. Record native Chrome evidence separately.
- Run commands from `experiments/webmcp-capability-forge/` unless a task gives another working directory.
- Publish the English official website at `https://webmcp-forge.jules-tnk.com` on classic Firebase Hosting; keep the deterministic lab under `/lab/*` routes inside that website.
- Publish as the individual Kibalo Jules Tinaka with `julestnk.dev@gmail.com` as the public contact and Moroccan law in the Terms.
- Add no website analytics, advertising, tracking cookies, accounts, telemetry, contact forms, or mailing lists.
- Keep all extension workflow data local in `chrome.storage.local`; transmit no telemetry or workflow data to the publisher.
- Name Google Firebase Hosting in the Privacy Policy, keep Analytics and every other Firebase product disabled, and reconfirm Firebase's current log/subprocessor handling before publication.

## Locked file structure

```text
experiments/webmcp-capability-forge/
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
  scripts/
    check-coding-rules.mjs
    check-coding-rules.test.mjs
  packages/core/
    package.json
    tsconfig.json
    vitest.config.ts
    src/
      json/
      contracts/
      schemas/
      session/
      selectors/
      policy/
      protocol/
      index.ts
  extension/
    package.json
    tsconfig.json
    vitest.config.ts
    playwright.config.ts
    scripts/build.mjs
    public/
      manifest.json
      popup.html
      sidepanel.html
    src/
      background/
      bridge/
      content/
      main-world/
      popup/
      sidepanel/
      storage/
      toolpack/
      ui/
      test/
    e2e/
  website/
    package.json
    vite.config.ts
    official product, legal, support, install, and deterministic lab routes under src/
  docs/
```

---

### Task 1: Scaffold the workspace and enforce the coding rules

**Files:**
- Create: `experiments/webmcp-capability-forge/package.json`
- Create: `experiments/webmcp-capability-forge/pnpm-workspace.yaml`
- Create: `experiments/webmcp-capability-forge/tsconfig.base.json`
- Create: `experiments/webmcp-capability-forge/scripts/check-coding-rules.mjs`
- Create: `experiments/webmcp-capability-forge/scripts/check-coding-rules.test.mjs`
- Create: `experiments/webmcp-capability-forge/packages/core/package.json`
- Create: `experiments/webmcp-capability-forge/packages/core/tsconfig.json`
- Create: `experiments/webmcp-capability-forge/packages/core/vitest.config.ts`
- Create: `experiments/webmcp-capability-forge/packages/core/src/index.ts`
- Create: `experiments/webmcp-capability-forge/extension/package.json`
- Create: `experiments/webmcp-capability-forge/extension/tsconfig.json`
- Create: `experiments/webmcp-capability-forge/extension/vitest.config.ts`
- Create: `experiments/webmcp-capability-forge/extension/scripts/build.mjs`
- Create: `experiments/webmcp-capability-forge/extension/public/manifest.json`
- Create: `experiments/webmcp-capability-forge/extension/public/popup.html`
- Create: `experiments/webmcp-capability-forge/extension/public/sidepanel.html`
- Create: `experiments/webmcp-capability-forge/extension/src/background/index.ts`
- Create: `experiments/webmcp-capability-forge/extension/src/content/index.ts`
- Create: `experiments/webmcp-capability-forge/extension/src/main-world/index.ts`
- Create: `experiments/webmcp-capability-forge/extension/src/popup/main.tsx`
- Create: `experiments/webmcp-capability-forge/extension/src/sidepanel/main.tsx`
- Create: `experiments/webmcp-capability-forge/extension/src/test/setup.ts`
- Create: `experiments/webmcp-capability-forge/extension/src/ui/styles.css`
- Create: `experiments/webmcp-capability-forge/lab/package.json`
- Create: `experiments/webmcp-capability-forge/lab/vite.config.ts`
- Create: `experiments/webmcp-capability-forge/lab/index.html`
- Create: `experiments/webmcp-capability-forge/lab/src/main.tsx`
- Create: `experiments/webmcp-capability-forge/lab/src/styles.css`

**Interfaces:**
- Produces: root `check:rules`, `test`, `typecheck`, `build`, `verify`, `dev:lab`, and `test:e2e` commands
- Produces: build entries named `background`, `content`, `main-world`, `popup`, and `sidepanel`

- [x] **Step 1: Write the rule-checker tests**

Use `node:test` with in-memory TypeScript samples. Assert that the checker reports `ExplicitAny`, `ExplicitUnknown`, `StringLiteralUnion`, and `MultipleStandaloneFunctionExports`, while accepting two static methods on one exported class and enum-member comparisons.

```js
test('accepts the required class and enum pattern', () => {
  const source = `
    export enum State { Ready = 'ready', Done = 'done' }
    export class StateRules {
      static isReady(value: State): boolean { return value === State.Ready }
      static isDone(value: State): boolean { return value === State.Done }
    }
  `
  assert.deepEqual(CodingRuleChecker.checkText('valid.ts', source), [])
})
```

- [x] **Step 2: Run the checker test and confirm failure**

Run: `node --test scripts/check-coding-rules.test.mjs`

Expected: FAIL because `check-coding-rules.mjs` does not exist.

- [x] **Step 3: Implement the TypeScript AST checker**

Export one JavaScript class named `CodingRuleChecker`. Walk authored `.ts` and `.tsx` files under `packages/core/src`, `extension/src`, and `lab/src`. Inspect type nodes for explicit `any` and `unknown`, union nodes for two or more string literal members, and exported declarations for more than one standalone function or exported arrow-function variable per file. Ignore `.d.ts`, generated output, and dependencies.

- [x] **Step 4: Create workspace manifests and strict TypeScript configuration**

Use this root command contract:

```json
{
  "scripts": {
    "check:rules": "node scripts/check-coding-rules.mjs",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck",
    "build": "pnpm -r build",
    "verify": "pnpm check:rules && pnpm typecheck && pnpm test && pnpm build",
    "dev:lab": "pnpm --filter webmcp-capability-forge-lab dev",
    "test:e2e": "pnpm --filter webmcp-capability-forge-extension test:e2e"
  }
}
```

Create this workspace map:

```yaml
packages:
  - packages/*
  - extension
  - lab
```

Set `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `verbatimModuleSyntax`, `moduleResolution: "Bundler"`, and `target: "ES2023"`. Do not set `erasableSyntaxOnly`.

Use package names `webmcp-capability-forge-core`, `webmcp-capability-forge-extension`, and `webmcp-capability-forge-lab`; later filter commands depend on these exact names.

Use the versions in the plan header. Core depends on Zod. Extension depends on core through `workspace:*`, React, React DOM, and Zod, with Chrome types, esbuild, Tailwind, Vitest, jsdom, and Playwright as development dependencies. Lab depends on core through `workspace:*`, React, React DOM, and React Router, with Vite, Tailwind, TypeScript, and Playwright as development dependencies.

- [x] **Step 5: Create the extension build and manifest shell**

Copy the proven esbuild pattern from `experiments/automatic-tool-extension/extension/scripts/build.mjs`, add `sidepanel` as an entry, and target `chrome149`. The manifest must declare `activeTab`, `scripting`, `storage`, `tabs`, and `sidePanel`, plus optional `http://*/*` and `https://*/*` host access.

- [x] **Step 6: Add minimal entry files and lab shell required for a build**

Each entry should import no unfinished feature. Render minimal product-name headings in popup and side panel, and render a `WebMCP Capability Forge Lab` heading in the Vite lab.

- [x] **Step 7: Install and verify the scaffold**

Run from `experiments/webmcp-capability-forge`:

```powershell
pnpm install
pnpm check:rules
pnpm typecheck
pnpm test
pnpm build
```

Expected: all commands pass and `extension/dist` contains five JavaScript entries, two HTML files, one stylesheet, and `manifest.json`.

### Task 2: Define enum-backed JSON, session, workflow, and protocol contracts

**Files:**
- Create: `packages/core/src/json/json-value.ts`
- Create: `packages/core/src/contracts/session-contracts.ts`
- Create: `packages/core/src/contracts/workflow-contracts.ts`
- Create: `packages/core/src/contracts/protocol-contracts.ts`
- Create: `packages/core/src/contracts/error-contracts.ts`
- Create: `packages/core/src/contracts/toolpack-contracts.ts`
- Create: `packages/core/src/selectors/selector-contracts.ts`
- Create: `packages/core/src/schemas/schema-catalog.ts`
- Create: `packages/core/src/schemas/schema-catalog.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Produces: `JsonValue`, `JsonObject`, `LearningMode`, `SessionActor`, `SessionStatus`, `TraceSource`, `WorkflowAction`, `CapabilityClassification`, `VerificationStatus`, `FailureCode`, `ForgeToolName`, `BootstrapOperation`, `SelectorKind`, `SemanticRole`, `TargetHandle`, `TraceEvent`, `CapabilityDefinition`, `ToolPack`, and `ValidationResult<T>`
- Produces: `SchemaCatalog.parseSession(JsonValue)` and `SchemaCatalog.parseCapability(JsonValue)`

- [x] **Step 1: Write failing schema tests**

Cover a valid Hybrid session and reject a capability containing an unsupported action, invalid origin URL, more than 20 steps, or an invalid classification value.

```ts
expect(SchemaCatalog.parseSession(validSession).valid).toBe(true)
expect(SchemaCatalog.parseCapability(invalidCapability).valid).toBe(false)
```

- [x] **Step 2: Run the focused tests and confirm failure**

Run: `pnpm --filter webmcp-capability-forge-core test -- schema-catalog.test.ts`

Expected: FAIL because the contracts and `SchemaCatalog` are missing.

- [x] **Step 3: Define concrete JSON types and deterministic enums**

Use concrete recursive JSON types and enums for each deterministic string set:

```ts
export type JsonScalar = string | number | boolean | null
export type JsonObject = { readonly [key: string]: JsonValue }
export type JsonValue = JsonScalar | JsonObject | readonly JsonValue[]

export enum LearningMode {
  Manual = 'manual',
  Automatic = 'automatic',
  Hybrid = 'hybrid',
}

export enum SessionActor {
  Human = 'human',
  Agent = 'agent',
}

export enum TraceSource {
  Human = 'human',
  Agent = 'agent',
  Verifier = 'verifier',
}
```

Define the remaining states and operation names as enums. Use enum members in Zod schemas and tests.

- [x] **Step 4: Define workflow and capability interfaces**

Model steps as a union of concrete interfaces discriminated by `WorkflowAction` enum members. Include ranked semantic target evidence, exact origin, path patterns, expected effects, provenance summary, verification record, and revision.

- [x] **Step 5: Implement `SchemaCatalog`**

Put all exported parsing methods on one class. Each method accepts `JsonValue`, uses a strict Zod schema, and returns `ValidationResult<T>` with enum-backed issue codes.

- [x] **Step 6: Export the package surface and run checks**

Run:

```powershell
pnpm check:rules
pnpm --filter webmcp-capability-forge-core test
pnpm --filter webmcp-capability-forge-core typecheck
```

Expected: schema tests pass and the rule checker reports no violations.

### Task 3: Implement the immutable Hybrid session state machine

**Files:**
- Create: `packages/core/src/session/session-machine.ts`
- Create: `packages/core/src/session/session-machine.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: session contracts from Task 2
- Produces: `SessionMachine.start`, `SessionMachine.append`, `SessionMachine.handoff`, `SessionMachine.transition`, `SessionMachine.pause`, and `SessionMachine.expire`

- [x] **Step 1: Write failing state-machine tests**

Assert one chronological trace can contain Human, Agent, and Verifier events; returned state changes do not mutate earlier snapshots; illegal transitions return `FailureCode.InvalidSessionTransition`; and the 20-action or 10-minute limit pauses the session.

```ts
const manual = SessionMachine.append(started, humanEvent)
if (!manual.valid) throw new Error('Human event must be valid in this test.')
const handedOff = SessionMachine.handoff(manual.value, SessionActor.Agent)
if (!handedOff.valid) throw new Error('Agent handoff must be valid in this test.')
const hybrid = SessionMachine.append(handedOff.value, agentEvent)
if (!hybrid.valid) throw new Error('Agent event must be valid in this test.')
expect(hybrid.value.trace.map((event) => event.source)).toEqual([
  TraceSource.Human,
  TraceSource.Agent,
])
expect(started.trace).toHaveLength(0)
```

- [x] **Step 2: Run the focused test and confirm failure**

Run: `pnpm --filter webmcp-capability-forge-core test -- session-machine.test.ts`

Expected: FAIL because `SessionMachine` does not exist.

- [x] **Step 3: Implement immutable session operations**

Use `structuredClone` at public boundaries. Accept a `SessionDependencies` interface with `now(): number` and `createId(): string` so tests remain deterministic. Keep allowed transitions in an enum-keyed record.

```ts
export class SessionMachine {
  static start(input: StartSessionInput, dependencies: SessionDependencies): LearningSession
  static append(session: LearningSession, event: TraceEvent): ValidationResult<LearningSession>
  static handoff(session: LearningSession, actor: SessionActor): ValidationResult<LearningSession>
  static transition(session: LearningSession, status: SessionStatus): ValidationResult<LearningSession>
  static pause(session: LearningSession, reason: FailureCode): LearningSession
  static expire(session: LearningSession, currentTime: number): LearningSession
}
```

- [x] **Step 4: Implement action and time limits**

Pause at 20 agent interaction events or 600,000 elapsed milliseconds. Return a structured recovery containing Stop, HumanHandoff, and RequestExtension enum options.

Define those options in a `SessionRecoveryAction` enum exported from the session contracts.

- [x] **Step 5: Run focused and package verification**

Run: `pnpm check:rules && pnpm --filter webmcp-capability-forge-core test && pnpm --filter webmcp-capability-forge-core typecheck`

Expected: all session tests pass.

### Task 3A: Promote the lab scaffold to the official extension website

**Files:**
- Move: `experiments/webmcp-capability-forge/lab/` to `experiments/webmcp-capability-forge/website/`
- Modify: `experiments/webmcp-capability-forge/package.json`
- Modify: `experiments/webmcp-capability-forge/pnpm-workspace.yaml`
- Modify: `experiments/webmcp-capability-forge/scripts/check-coding-rules.mjs`
- Modify: `experiments/webmcp-capability-forge/website/package.json`
- Modify: `experiments/webmcp-capability-forge/website/index.html`
- Modify: `experiments/webmcp-capability-forge/website/src/main.tsx`
- Modify: `experiments/webmcp-capability-forge/website/src/styles.css`
- Create: `experiments/webmcp-capability-forge/website/src/app/router.tsx`
- Create: `experiments/webmcp-capability-forge/website/src/app/site-route.ts`
- Create: `experiments/webmcp-capability-forge/website/src/components/SiteHeader.tsx`
- Create: `experiments/webmcp-capability-forge/website/src/components/SiteFooter.tsx`
- Create: `experiments/webmcp-capability-forge/website/src/components/InstallDisclosure.tsx`
- Create: `experiments/webmcp-capability-forge/website/src/pages/HomePage.tsx`
- Create: `experiments/webmcp-capability-forge/website/src/pages/HowItWorksPage.tsx`
- Create: `experiments/webmcp-capability-forge/website/src/pages/InstallPage.tsx`
- Create: `experiments/webmcp-capability-forge/website/src/pages/PrivacyPage.tsx`
- Create: `experiments/webmcp-capability-forge/website/src/pages/TermsPage.tsx`
- Create: `experiments/webmcp-capability-forge/website/src/pages/SupportPage.tsx`
- Create: `experiments/webmcp-capability-forge/website/public/robots.txt`
- Create: `experiments/webmcp-capability-forge/website/public/sitemap.xml`

**Interfaces:**
- Produces: package `webmcp-capability-forge-website` and root `dev:website` command
- Produces: `/`, `/how-it-works`, `/install`, `/privacy`, `/terms`, and `/support`
- Produces: canonical links to `https://webmcp-forge.jules-tnk.com`
- Consumes: approved publisher, privacy, governing-law, age, language, and no-telemetry decisions

- [x] **Step 1: Rename the package and update workspace tooling**

Move the scaffold with `Move-Item -LiteralPath 'lab' -Destination 'website'`. Change the package name and root filter from `webmcp-capability-forge-lab` and `dev:lab` to `webmcp-capability-forge-website` and `dev:website`. Change the coding-rule checker source root from `lab/src` to `website/src`.

- [x] **Step 2: Define official website routes and shared chrome**

Use a `SiteRoute` string enum for all routes. Render one header and footer around nested pages. The footer links Privacy, Terms, Support, and the MIT license from every page. Show `Source repository release in progress` without a link until the repository exists.

```ts
export enum SiteRoute {
  Home = '/',
  HowItWorks = '/how-it-works',
  Install = '/install',
  LabGuide = '/lab/guide',
  LabWorkflow = '/lab/workflow',
  LabResults = '/lab/results',
  LabEvidence = '/lab/evidence',
  Privacy = '/privacy',
  Terms = '/terms',
  Support = '/support',
}
```

- [x] **Step 3: Build the product, process, and install pages**

The homepage states the single purpose before its first install link: WebMCP Capability Forge is a Chrome extension that teaches, discovers, verifies, and reuses browser workflows as WebMCP tools. `/how-it-works` explains Manual, Automatic, and Hybrid modes. `/install` displays `Chrome Web Store release in progress`, the requested permissions and reasons, and no email form.

- [x] **Step 4: Draft the Privacy Policy page from actual release behavior**

Use effective date `August 29, 2026`. Name Kibalo Jules Tinaka as individual publisher and data controller and `julestnk.dev@gmail.com` as contact. Disclose local processing of page origin/path, visible controls, bounded observations, interactions, non-sensitive inputs, capability definitions, traces, revisions, verification, and failures. State that the extension uses `chrome.storage.local`, blocks sensitive targets, sends no telemetry, sells no data, and uses no advertising. Include local deletion/export controls, security limits, policy changes, under-13 handling, and Chrome Web Store Limited Use compliance.

State that the website uses no analytics, advertising, tracking cookies, accounts, telemetry, forms, or mailing lists. Name Google Firebase Hosting as the hosting provider and explain that it may process standard request and security logs. State that Firebase Analytics and every other Firebase product are disabled. Reconfirm Firebase's current log and subprocessor disclosures before publication.

- [x] **Step 5: Draft Terms and Support pages**

Use effective date `August 29, 2026`. The Terms cover publisher identity, eligibility, under-13 restriction, acceptable use, responsibility for learned workflows and agent actions, consequential confirmations, third-party sites, selector compatibility, intellectual property, MIT source, availability, warranty disclaimer, liability limits, suspension, termination, changes, Moroccan governing law, mandatory consumer protections, and contact. Support uses a `mailto:julestnk.dev@gmail.com` link and no form.

- [x] **Step 6: Add canonical, search, and social metadata**

Set canonical and Open Graph metadata to `https://webmcp-forge.jules-tnk.com`, add a descriptive title and description, publish `robots.txt`, and list every public route in `sitemap.xml`.

- [x] **Step 7: Verify the promoted website scaffold**

Run:

```powershell
pnpm install
pnpm check:rules
pnpm --filter webmcp-capability-forge-website typecheck
pnpm --filter webmcp-capability-forge-website build
```

Expected: all commands pass, the old `lab/` directory no longer exists, and the production website build contains the legal, support, install, and sitemap routes or fallback assets.

### Task 4: Build semantic page inspection, sensitive-target blocking, and selector ranking

**Files:**
- Create: `packages/core/src/selectors/selector-ranker.ts`
- Create: `packages/core/src/selectors/selector-ranker.test.ts`
- Modify: `packages/core/src/selectors/selector-contracts.ts`
- Create: `extension/src/content/open-shadow-dom.ts`
- Create: `extension/src/content/semantic-inventory.ts`
- Create: `extension/src/content/semantic-inventory.test.ts`
- Create: `extension/src/content/sensitive-target-policy.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Consumes: `SelectorKind`, `SemanticRole`, and `TargetHandle` contracts from Task 2
- Produces: `SelectorCandidate`, `SelectorRanker.rank(SelectorCandidate[])`, `SemanticInventory.inspect(Document)`, `SemanticInventory.resolve(TargetHandle)`, and `SensitiveTargetPolicy.classify(Element)`
- Produces: short-lived `TargetHandle` values scoped to a page-inspection revision

- [x] **Step 1: Write failing selector and DOM tests**

Cover role/name, label, stable name, stable ID, semantic `data-*`, generated classes, duplicate candidates, hidden elements, open Shadow DOM, password, payment-like autocomplete, one-time-code, file, and hidden inputs.

```ts
expect(SelectorRanker.rank(candidates)[0]?.kind).toBe(SelectorKind.AccessibleRole)
expect(SensitiveTargetPolicy.classify(password).blocked).toBe(true)
expect(SemanticInventory.inspect(document).targets).toContainEqual(
  expect.objectContaining({ role: SemanticRole.Button, name: 'Search' }),
)
```

- [x] **Step 2: Run focused tests and confirm failure**

Run: `pnpm --filter webmcp-capability-forge-core test -- selector-ranker.test.ts && pnpm --filter webmcp-capability-forge-extension test -- semantic-inventory.test.ts`

Expected: FAIL because the ranking and inventory classes are missing.

- [x] **Step 3: Implement selector ranking**

Score accessible role/name, associated label, stable name, stable ID, stable semantic attribute, context, and bounded structural fallback in that order. Return `FailureCode.TargetAmbiguous` when the best candidate does not resolve to one visible element.

```ts
export class SelectorRanker {
  static rank(candidates: readonly SelectorCandidate[]): readonly SelectorCandidate[]
  static select(candidates: readonly SelectorCandidate[]): ValidationResult<SelectorCandidate>
}
```

- [x] **Step 4: Implement DOM and open-Shadow traversal**

Traverse the top-level document and recursively visit open shadow roots. Exclude cross-origin frames and closed roots. Return bounded semantic metadata and opaque target handles, not HTML snapshots.

```ts
export class SemanticInventory {
  static inspect(documentValue: Document): PageInspection
  static resolve(documentValue: Document, handle: TargetHandle): ValidationResult<Element>
}
```

- [x] **Step 5: Implement sensitive-target policy**

Block sensitive input types and autocomplete tokens, payment labels, authentication codes, and editable fields within login or payment forms. Do not record their values or target evidence.

- [x] **Step 6: Run package checks**

Run: `pnpm check:rules && pnpm --filter webmcp-capability-forge-core test && pnpm --filter webmcp-capability-forge-extension test`

Expected: selector and DOM tests pass.

### Task 5: Implement capability validation and the runtime risk policy

**Files:**
- Create: `packages/core/src/policy/capability-validator.ts`
- Create: `packages/core/src/policy/capability-validator.test.ts`
- Create: `packages/core/src/policy/risk-policy.ts`
- Create: `packages/core/src/policy/risk-policy.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Produces: `CapabilityValidator.validate(CapabilityDefinition, ActivePageScope)`
- Produces: `RiskPolicy.classify(CapabilityDefinition)` and `RiskPolicy.authorize(RiskContext)`

- [x] **Step 1: Write failing policy tests**

Require exact-origin scope, bounded path patterns, declared inputs, valid step-output references, `waitForURL` after route-changing clicks, no arbitrary URLs, and classification escalation for submission or external effects.

```ts
expect(RiskPolicy.classify(readTool)).toBe(CapabilityClassification.Read)
expect(RiskPolicy.authorize(submitContext).failure?.code).toBe(
  FailureCode.RiskConfirmationRequired,
)
expect(CapabilityValidator.validate(crossOriginTool, scope).valid).toBe(false)
```

- [x] **Step 2: Run focused tests and confirm failure**

Run: `pnpm --filter webmcp-capability-forge-core test -- capability-validator.test.ts risk-policy.test.ts`

Expected: FAIL because the policy classes are missing.

- [x] **Step 3: Implement semantic validation**

Validate origin, path patterns, maximum steps, waits, extracted items, output limits, inputs, output references, target evidence, expected effects, and route checkpoints after schema parsing.

```ts
export class CapabilityValidator {
  static validate(
    definition: CapabilityDefinition,
    scope: ActivePageScope,
  ): ValidationResult<CapabilityDefinition>
}
```

- [x] **Step 4: Implement risk classification and authorization**

Map read, local UI, navigation, external write, and blocked-sensitive behavior to enum-backed policy results. Require per-run confirmation at each consequential step. Re-run authorization immediately before execution.

```ts
export class RiskPolicy {
  static classify(definition: CapabilityDefinition): CapabilityClassification
  static authorize(context: RiskContext): AuthorizationResult
}
```

- [x] **Step 5: Run core verification**

Run: `pnpm check:rules && pnpm --filter webmcp-capability-forge-core test && pnpm --filter webmcp-capability-forge-core typecheck`

Expected: all policy tests pass.

### Task 6: Build the versioned bridge, site permissions, and local repositories

**Files:**
- Create: `extension/src/bridge/bridge-envelope.ts`
- Create: `extension/src/bridge/bridge-envelope.test.ts`
- Create: `extension/src/bridge/bridge-replay-guard.ts`
- Create: `extension/src/bridge/window-bridge.ts`
- Create: `extension/src/background/site-permissions.ts`
- Create: `extension/src/background/site-permissions.test.ts`
- Create: `extension/src/storage/chrome-storage-area.ts`
- Create: `extension/src/storage/storage-area.ts`
- Create: `extension/src/storage/session-repository.ts`
- Create: `extension/src/storage/session-repository.test.ts`
- Create: `extension/src/storage/capability-repository.ts`
- Create: `extension/src/storage/capability-repository.test.ts`
- Create: `extension/src/background/chrome-platform.ts`
- Modify: `extension/src/background/index.ts`

**Interfaces:**
- Produces: `BridgeEnvelopeCodec.create`, `BridgeEnvelopeCodec.parse`, and `BridgeReplayGuard.accept`
- Produces: `SitePermissions.enable`, `SitePermissions.disable`, and `SitePermissions.status`
- Produces: typed session and capability repositories over `StorageArea`

- [x] **Step 1: Write failing bridge, permission, and repository tests**

Reject wrong protocol versions, directions, message types, payload schemas, and duplicate request IDs. Assert host patterns omit ports while stored origins retain ports. Assert repositories clone reads, isolate origins, keep one session per tab, and retain the last verified revision when a replacement fails.

- [x] **Step 2: Run focused tests and confirm failure**

Run: `pnpm --filter webmcp-capability-forge-extension test -- bridge-envelope.test.ts site-permissions.test.ts session-repository.test.ts capability-repository.test.ts`

Expected: FAIL because the classes are missing.

- [x] **Step 3: Implement the message boundary**

Serialize browser-provided messages to JSON inside `ChromePlatform`, parse them through a strict `JsonValue` schema, and pass only validated envelopes into application code. Use enums for direction and message type. Reject replayed IDs.

```ts
export class BridgeEnvelopeCodec {
  static create(input: CreateEnvelopeInput): BridgeEnvelope
  static parse(value: JsonValue, direction: BridgeDirection): ValidationResult<BridgeEnvelope>
}

export interface StorageArea {
  get(key: string): Promise<JsonObject>
  set(values: JsonObject): Promise<void>
}
```

- [x] **Step 4: Implement optional origin enablement**

Request `${url.protocol}//${url.hostname}/*` from a direct user action. Register the isolated content script at `document_start` with `persistAcrossSessions: true`. Keep repository keys on exact `URL.origin`.

- [x] **Step 5: Implement repositories**

Use versioned keys `webmcp-capability-forge:sessions:v1` and `webmcp-capability-forge:capabilities:v1`. Store definitions, revisions, active pointers, verification, health, bounded failures, and continuation state. Store no snapshots or conversation text.

Wire the background entry to parse each Chrome message through `ChromePlatform`, route enum-backed site permission and repository operations, and serialize one `JsonValue` response. Keep Chrome callback values inside the platform adapter until schema validation succeeds.

- [x] **Step 6: Run extension verification**

Run: `pnpm check:rules && pnpm --filter webmcp-capability-forge-extension test && pnpm --filter webmcp-capability-forge-extension typecheck`

Expected: all boundary and repository tests pass.

### Task 7: Implement Manual recording and bounded Automatic exploration

**Files:**
- Create: `extension/src/content/manual-recorder.ts`
- Create: `extension/src/content/manual-recorder.test.ts`
- Create: `extension/src/content/page-observer.ts`
- Create: `extension/src/content/page-explorer.ts`
- Create: `extension/src/content/page-explorer.test.ts`
- Create: `extension/src/content/content-controller.ts`
- Modify: `extension/src/content/index.ts`

**Interfaces:**
- Consumes: `SessionMachine`, semantic inventory, risk policy, and bridge from Tasks 3 through 6
- Produces: `ManualRecorder.start`, `ManualRecorder.stop`, `PageExplorer.inspect`, `PageExplorer.interact`, and `PageExplorer.observe`

- [x] **Step 1: Write failing recorder and explorer tests**

Record fill, click, select, check, keypress, and bounded DOM outcomes. Assert Human and Agent provenance, opaque handles, stale inspection rejection, sensitive-field redaction, 32 KB observation truncation, and confirmation requirements for navigation and submission.

```ts
const trace = recorder.stop()
expect(trace.events[0]?.source).toBe(TraceSource.Human)
expect(explorer.interact(navigationRequest).failure?.code).toBe(
  FailureCode.RiskConfirmationRequired,
)
```

- [x] **Step 2: Run focused tests and confirm failure**

Run: `pnpm --filter webmcp-capability-forge-extension test -- manual-recorder.test.ts page-explorer.test.ts`

Expected: FAIL because recorder and explorer classes are missing.

- [x] **Step 3: Adapt the proven recorder without fixture selectors**

Use event delegation on the active document and open shadow roots. Replace `data-record-observation` assumptions from the old prototype with a bounded `MutationObserver` diff. Convert user-entered values into named input references and discard sensitive values.

```ts
export class ManualRecorder {
  start(session: LearningSession, root: Document): void
  stop(): LearningSession
  dispose(): void
}
```

- [x] **Step 4: Implement semantic inspection and interaction**

Return at most 100 visible targets and 32 KB serialized observation data. Resolve only handles from the latest inspection revision. Authorize each action before dispatching native input, change, click, key, select, or check events.

```ts
export class PageExplorer {
  inspect(documentValue: Document): PageInspection
  interact(request: ExplorationRequest): Promise<ExplorationResult>
  observe(request: ObservationRequest): Promise<BoundedObservation>
}
```

- [x] **Step 5: Connect the content controller**

Route validated background messages to recorder and explorer classes. Emit trace events and route changes back to the background service worker. Stop active listeners when permission disappears or a session pauses.

- [x] **Step 6: Run extension tests and type checks**

Run: `pnpm check:rules && pnpm --filter webmcp-capability-forge-extension test && pnpm --filter webmcp-capability-forge-extension typecheck`

Expected: all content tests pass.

### Task 8: Register the bootstrap and temporary WebMCP exploration tools

**Files:**
- Create: `packages/core/src/protocol/protocol-builder.ts`
- Create: `packages/core/src/protocol/protocol-builder.test.ts`
- Create: `extension/src/main-world/model-context.d.ts`
- Create: `extension/src/main-world/model-context-adapter.ts`
- Create: `extension/src/main-world/registration-lifecycle.ts`
- Create: `extension/src/main-world/registration-lifecycle.test.ts`
- Create: `extension/src/main-world/bootstrap-runtime.ts`
- Create: `extension/src/main-world/bootstrap-runtime.test.ts`
- Modify: `extension/src/main-world/index.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Produces: `ProtocolBuilder.inspect(ProtocolContext)`
- Produces: stable `capability_forge` operations and temporary tool registrations
- Produces: AbortSignal-owned registration lifecycle with expected abort rejection handling

- [x] **Step 1: Write failing protocol and registration tests**

Assert the bootstrap description directs an unfamiliar agent to `inspect`; inspect returns phases, constraints, current page, session, tools, failures, pending cross-document outcomes, and valid next calls. Assert temporary tools exist only during Automatic or Hybrid collection and abort when the session pauses.

- [x] **Step 2: Run focused tests and confirm failure**

Run: `pnpm --filter webmcp-capability-forge-core test -- protocol-builder.test.ts && pnpm --filter webmcp-capability-forge-extension test -- registration-lifecycle.test.ts bootstrap-runtime.test.ts`

Expected: FAIL because protocol and runtime classes are missing.

- [x] **Step 3: Implement the structured protocol**

Use `ForgeToolName` and `BootstrapOperation` enums. Include begin, join, inspect, list, report-failure, and request-repair calls. Return `SessionStatus.AwaitingStartApproval` when the agent requests Automatic learning before the person approves it in the side panel.

```ts
export class ProtocolBuilder {
  static inspect(context: ProtocolContext): LearningProtocol
  static nextCalls(context: ProtocolContext): readonly ProtocolNextCall[]
}
```

- [x] **Step 4: Implement WebMCP type declarations and registration lifecycle**

Type execute inputs as `JsonObject` and outputs as `JsonValue`. Treat `AbortError` from registration teardown as expected. Report other registration failures to the bridge.

- [x] **Step 5: Implement bootstrap and temporary tools**

Forward validated calls through the page bridge. Register `forge_inspect_page`, `forge_interact`, `forge_observe_changes`, `forge_read_trace`, and `forge_propose_workflow` only for approved collecting sessions.

```ts
export class BootstrapRuntime {
  install(context: ModelContext, bridge: PageBridge): void
  sync(state: RuntimeState): void
  dispose(): void
}
```

- [x] **Step 6: Run core and extension verification**

Run: `pnpm check:rules && pnpm --filter webmcp-capability-forge-core test && pnpm --filter webmcp-capability-forge-extension test && pnpm typecheck`

Expected: all protocol and registration tests pass.

### Task 9: Execute workflows and resume same-origin route checkpoints

**Files:**
- Create: `extension/src/content/workflow-executor.ts`
- Create: `extension/src/content/workflow-executor.test.ts`
- Create: `packages/core/src/contracts/execution-contracts.ts`
- Create: `extension/src/background/execution-coordinator.ts`
- Create: `extension/src/background/execution-coordinator.test.ts`
- Create: `extension/src/storage/continuation-repository.ts`
- Create: `extension/src/storage/continuation-repository.test.ts`
- Modify: `extension/src/main-world/bootstrap-runtime.ts`
- Modify: `extension/src/content/content-controller.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Produces: `ExecutionStatus`, `ExecutionCheckpoint`, `ExecutionOutcome`, `WorkflowExecutor.run(ExecutionRequest)`, and `ExecutionCoordinator.resume(PageReadyEvent)`
- Produces: `ExecutionCheckpoint` and `ExecutionOutcome` returned by the next `capability_forge.inspect`

- [x] **Step 1: Write failing executor and continuation tests**

Cover all nine actions, cancellation, missing and ambiguous targets, wait timeout, extraction limits, SPA route changes, full-document checkpoint persistence, origin mismatch, expected-path mismatch, and recovery through inspect.

```ts
await coordinator.checkpoint(routeExecution)
const resumed = await coordinator.resume(newPageReady)
expect(resumed.status).toBe(ExecutionStatus.Completed)
expect(await continuationRepository.getRecentOutcome(tabId)).toEqual(resumed)
```

- [x] **Step 2: Run focused tests and confirm failure**

Run: `pnpm --filter webmcp-capability-forge-extension test -- workflow-executor.test.ts execution-coordinator.test.ts continuation-repository.test.ts`

Expected: FAIL because execution classes are missing.

- [x] **Step 3: Implement bounded workflow execution**

Resolve ranked targets at each step, authorize risk at runtime, dispatch the action, and collect enum-keyed outputs. Stop at the first structured failure. Enforce 5-second waits, 20 extracted items, and 32 KB output.

```ts
export class WorkflowExecutor {
  run(request: ExecutionRequest): Promise<ExecutionOutcome>
  cancel(executionId: string): void
}
```

- [x] **Step 4: Implement SPA continuation**

Observe `popstate`, history changes, and the current URL. Let `waitForURL` continue within the same document when the page uses client-side routing.

- [x] **Step 5: Implement full-document checkpoints**

Store the next step, expected origin/path, input, capability revision, and expiration before the route-changing action. Resume after `page.ready` in the new document. Store the final outcome for bootstrap inspection because the original document callback may no longer exist.

```ts
export class ExecutionCoordinator {
  checkpoint(checkpoint: ExecutionCheckpoint): Promise<void>
  resume(event: PageReadyEvent): Promise<ExecutionOutcome>
  recentOutcome(tabId: number): Promise<ExecutionOutcome | null>
}
```

- [x] **Step 6: Run extension verification**

Run: `pnpm check:rules && pnpm --filter webmcp-capability-forge-extension test && pnpm --filter webmcp-capability-forge-extension typecheck`

Expected: route and executor tests pass.

### Task 10: Coordinate proposals, review, verification, activation, and repair

**Files:**
- Create: `extension/src/background/proposal-coordinator.ts`
- Create: `extension/src/background/proposal-coordinator.test.ts`
- Create: `extension/src/background/verification-coordinator.ts`
- Create: `extension/src/background/verification-coordinator.test.ts`
- Create: `extension/src/background/repair-coordinator.ts`
- Create: `extension/src/background/repair-coordinator.test.ts`
- Create: `extension/src/main-world/learned-tool-runtime.ts`
- Create: `extension/src/main-world/learned-tool-runtime.test.ts`
- Modify: `extension/src/storage/capability-repository.ts`
- Modify: `extension/src/background/index.ts`

**Interfaces:**
- Produces: pending proposal records, explicit verification states, active revision pointers, guarded external-write registrations, structured failure summaries, and reviewed replacements

- [x] **Step 1: Write failing lifecycle tests**

Require human approval before verification, replay verification for read/local/navigation tools, structural verification for external-write tools, no registration for blocked-sensitive tools, failed-repair preservation, and stale failure reporting.

- [x] **Step 2: Run focused tests and confirm failure**

Run: `pnpm --filter webmcp-capability-forge-extension test -- proposal-coordinator.test.ts verification-coordinator.test.ts repair-coordinator.test.ts learned-tool-runtime.test.ts`

Expected: FAIL because lifecycle coordinators are missing.

- [x] **Step 3: Implement proposal review coordination**

Validate the draft again in the background, store it as proposed, notify the side panel, and resolve only from a direct side-panel approval message. Expire unanswered requests after 120 seconds.

```ts
export class ProposalCoordinator {
  propose(request: ProposalRequest): Promise<ProposalRecord>
  resolve(request: ProposalResolution): Promise<ProposalRecord>
}
```

- [x] **Step 4: Implement honest verification states**

Run preflight and replay for read, local UI, and confirmed navigation capabilities. Store external-write definitions as `VerificationStatus.ReviewedNotReplayVerified` after structural checks. Keep preflight evidence distinct from replay evidence.

```ts
export class VerificationCoordinator {
  verify(request: VerificationRequest): Promise<VerificationRecord>
}
```

- [x] **Step 5: Implement activation and learned-tool registration**

Register only scope-matching eligible revisions. Guard external-write steps with per-run confirmation. Abort registrations when scope, permission, health, or enabled state changes.

- [x] **Step 6: Implement failure and repair**

Record revision, step, route, candidate attempts, bounded outcome, completed actions, and external-state uncertainty. Keep the old active revision until the replacement passes review and verification.

- [x] **Step 7: Run lifecycle verification**

Run: `pnpm check:rules && pnpm --filter webmcp-capability-forge-extension test && pnpm --filter webmcp-capability-forge-extension typecheck`

Expected: all lifecycle tests pass.

### Task 11: Build the toolbar popup and four-section side panel

**Files:**
- Modify: `extension/src/ui/styles.css`
- Modify: `extension/src/popup/main.tsx`
- Create: `extension/src/popup/Popup.tsx`
- Modify: `extension/src/sidepanel/main.tsx`
- Create: `extension/src/sidepanel/SidePanelApp.tsx`
- Create: `extension/src/sidepanel/SidePanelRouter.tsx`
- Create: `extension/src/sidepanel/session/SessionPage.tsx`
- Create: `extension/src/sidepanel/review/ReviewPage.tsx`
- Create: `extension/src/sidepanel/tools/ToolsPage.tsx`
- Create: `extension/src/sidepanel/evidence/EvidencePage.tsx`
- Create: `extension/src/sidepanel/state/side-panel-store.ts`
- Create: `extension/src/sidepanel/state/panel-contracts.ts`
- Modify: `extension/scripts/build.mjs`
- Modify: `extension/public/manifest.json`

**Interfaces:**
- Consumes: background message contracts and repositories from earlier tasks
- Produces: `PanelSection`, `SidePanelStore`, accessible popup controls, and side-panel Session, Review, Tools, and Evidence routes

- [x] **Step 1: Implement the popup shell**

Show current origin, permission state, enable/disable action, active-tool count, and `Open Capability Forge`. Call `chrome.sidePanel.open({ tabId })` only from the direct popup click.

- [x] **Step 2: Implement side-panel routing and state**

Use `PanelSection` enum values for Session, Review, Tools, and Evidence. Keep the selected section in the extension URL hash so reload restores it. Put non-React state transitions in `SidePanelStore`.

```ts
export enum PanelSection {
  Session = 'session',
  Review = 'review',
  Tools = 'tools',
  Evidence = 'evidence',
}

export class SidePanelStore {
  getState(): SidePanelState
  dispatch(action: SidePanelAction): void
  subscribe(listener: SidePanelListener): SidePanelUnsubscribe
}
```

- [x] **Step 3: Implement Session and Review pages**

Session must expose goal entry, Teach manually, Let the agent explore, Build together, current actor, route, step count, risk boundary, handoff, pause, and stop. Review must show the complete contract, provenance, selector evidence, risk, approval, rejection, and verification state.

- [x] **Step 4: Implement Tools and Evidence pages**

Tools lists draft, active, paused, stale, and guarded tools with inspect, enable/disable, import, export, repair, and deletion actions. Require a direct confirmation before import replacement or deletion. Evidence shows chronological trace, verification attempts, executions, failures, repairs, and revisions without page snapshots.

- [x] **Step 5: Apply the approved institutional visual system**

Reuse the token vocabulary from the existing prototypes, keep raw colors in CSS, use no gradients, add reduced-motion behavior, keep compact extension density, and retain visible focus states.

- [x] **Step 6: Build without component tests**

Run: `pnpm check:rules && pnpm --filter webmcp-capability-forge-extension typecheck && pnpm --filter webmcp-capability-forge-extension build`

Expected: the popup and side-panel bundles compile. Browser validation comes in Task 13.

### Task 12: Complete the deterministic lab inside the official website

**Files:**
- Modify: `website/src/app/router.tsx`
- Modify: `website/src/app/site-route.ts`
- Create: `website/src/pages/LabGuidePage.tsx`
- Create: `website/src/pages/WorkflowPage.tsx`
- Create: `website/src/pages/RouteResultPage.tsx`
- Create: `website/src/pages/EvidencePage.tsx`
- Create: `website/src/fixtures/catalog-store.ts`
- Create: `packages/core/src/contracts/lab-contracts.ts`
- Create: `website/src/fixtures/BaselineCatalog.tsx`
- Create: `website/src/fixtures/ChangedCatalog.tsx`
- Modify: `website/src/styles.css`
- Create: `website/DESIGN.md`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Produces: uninstrumented fixture routes that the extension learns against
- Produces: baseline, changed-target, same-document route, and full-document route scenarios
- Produces: `CatalogCategory` and fixture expected-effect enums for browser tests

- [x] **Step 1: Build the lab guide within the official website**

Explain the deterministic workflow, required extension setup, Manual/Automatic/Hybrid test paths, verification labels, and evidence boundaries. Link back to the official product, install, privacy, terms, support, and source pages.

- [x] **Step 2: Build accessible uninstrumented fixtures**

Provide search, select, check, results, detail navigation, shortlist, and extraction surfaces. The lab must expose no `document.modelContext` tools and no extension-specific hidden instructions.

```tsx
<Routes>
  <Route path={SiteRoute.LabGuide} element={<LabGuidePage />} />
  <Route path={SiteRoute.LabWorkflow} element={<WorkflowPage />} />
  <Route path={SiteRoute.LabResults} element={<RouteResultPage />} />
  <Route path={SiteRoute.LabEvidence} element={<EvidencePage />} />
</Routes>
```

- [x] **Step 3: Build route and change scenarios**

Use Baseline DOM and Changed DOM with identical human labels but different selector evidence. Provide one SPA route and one full-document route to exercise both continuation paths.

- [x] **Step 4: Reuse shared contracts where the browser boundary permits**

Depend on `webmcp-capability-forge-core` for fixture enums and expected-effect identifiers. Keep the lab independent from extension storage and control-plane code.

- [x] **Step 5: Verify the lab build**

Run: `pnpm check:rules && pnpm --filter webmcp-capability-forge-website typecheck && pnpm --filter webmcp-capability-forge-website build`

Expected: the public site and all fixture routes build with no component test suite.

### Task 13: Add loaded-extension end-to-end journeys

**Files:**
- Create: `extension/playwright.config.ts`
- Create: `extension/e2e/support/extension-context.ts`
- Create: `extension/e2e/support/fake-model-context.ts`
- Create: `extension/e2e/support/fake-agent.ts`
- Create: `extension/e2e/support/lab-page.ts`
- Create: `extension/e2e/support/side-panel-page.ts`
- Create: `extension/e2e/manual-learning.spec.ts`
- Create: `extension/e2e/automatic-learning.spec.ts`
- Create: `extension/e2e/hybrid-learning.spec.ts`
- Create: `extension/e2e/navigation-and-reload.spec.ts`
- Create: `extension/e2e/risk-and-repair.spec.ts`
- Create: `extension/e2e/website-and-compliance.spec.ts`

**Interfaces:**
- Consumes: production extension build and official website server
- Produces: `SidePanelPage`, `LabPage`, `FakeAgent`, and browser-level evidence for all visible UI and extension-runtime flows

- [x] **Step 1: Create the loaded-extension harness**

Build the production extension before tests, copy it to a short temporary profile, grant only the local lab host in the test copy, load the service worker, and inject a faithful ModelContext implementation. Open `sidepanel.html` as an extension page for semantic Playwright control. Export a typed Playwright `test` fixture from `extension-context.ts` that provides `lab: LabPage`, `sidePanel: SidePanelPage`, and `agent: FakeAgent`.

- [x] **Step 2: Write and run the failing Manual journey**

Enable the lab, start teaching, perform a workflow, inspect Human provenance, propose, approve, replay, invoke the learned tool, reload, and invoke it again.

```ts
test('learns, verifies, restores, and reuses a manual workflow', async ({
  page,
  lab,
  sidePanel,
  agent,
}) => {
  const learnedToolName = 'find_and_shortlist_item'
  const learnedInput: JsonObject = {
    query: 'notebook',
    category: CatalogCategory.Office,
  }
  await sidePanel.start(LearningMode.Manual, 'Find and shortlist an item')
  await lab.completeCatalogWorkflow(page)
  await sidePanel.approveAndVerify()
  await agent.invoke(learnedToolName, learnedInput)
  await page.reload()
  await agent.invoke(learnedToolName, learnedInput)
})
```

Run: `pnpm --filter webmcp-capability-forge-extension test:e2e -- manual-learning.spec.ts`

Expected before integration fixes: FAIL at the first missing lifecycle behavior.

- [x] **Step 3: Write Automatic and Hybrid journeys**

Automatic must use bootstrap and temporary tools without direct Playwright actions on the catalog after session start. Hybrid must record a human prefix, hand control to the agent, complete the trace, and show mixed provenance.

- [x] **Step 4: Write route and reload journeys**

Cover SPA continuation, full-document checkpoint recovery through `capability_forge.inspect`, session recovery, learned-tool restoration, and exact-origin isolation.

- [x] **Step 5: Write risk and repair journeys**

Assert navigation confirmation, external-write per-run confirmation, sensitive-target blocking, stale selector reporting, failed replacement preservation, and successful reviewed repair.

- [x] **Step 6: Run desktop and mobile UI projects**

Use 1280x900 and 390x844 viewports for the official website and extension pages. Assert no horizontal overflow and no browser console errors. Verify `/`, `/how-it-works`, `/install`, `/privacy`, `/terms`, `/support`, and `/lab/guide`; require the install disclosure, publisher identity, public email, Moroccan governing-law clause, policy footer links, and absence of analytics or contact-form requests.

Run: `pnpm test:e2e`

Expected: all loaded-extension journeys pass.

### Task 14: Add legacy import, Store release materials, and native challenge evidence checklists

**Files:**
- Create: `extension/src/toolpack/legacy-toolpack-importer.ts`
- Create: `extension/src/toolpack/legacy-toolpack-importer.test.ts`
- Create: `extension/src/toolpack/toolpack-exporter.ts`
- Create: `extension/src/toolpack/toolpack-exporter.test.ts`
- Create: `experiments/webmcp-capability-forge/README.md`
- Create: `experiments/webmcp-capability-forge/LICENSE`
- Create: `experiments/webmcp-capability-forge/scripts/package-extension.ps1`
- Create: `experiments/webmcp-capability-forge/docs/PRIVACY.md`
- Create: `experiments/webmcp-capability-forge/docs/TERMS.md`
- Create: `experiments/webmcp-capability-forge/docs/PERMISSIONS.md`
- Create: `experiments/webmcp-capability-forge/docs/STORE-LISTING.md`
- Create: `experiments/webmcp-capability-forge/docs/PRIVACY-PRACTICES.md`
- Create: `experiments/webmcp-capability-forge/docs/REAL-WEBMCP-TEST.md`
- Create: `experiments/webmcp-capability-forge/docs/DEMO-SCRIPT.md`
- Create: `experiments/webmcp-capability-forge/docs/PUBLIC-SITE-ASSESSMENT.md`
- Create: `experiments/webmcp-capability-forge/docs/COMPARISON-EVIDENCE.md`
- Create: `experiments/webmcp-capability-forge/extension/public/icons/icon-16.png`
- Create: `experiments/webmcp-capability-forge/extension/public/icons/icon-32.png`
- Create: `experiments/webmcp-capability-forge/extension/public/icons/icon-48.png`
- Create: `experiments/webmcp-capability-forge/extension/public/icons/icon-128.png`
- Create: `experiments/webmcp-capability-forge/store-assets/screenshots/01-hybrid-session.png`
- Create: `experiments/webmcp-capability-forge/store-assets/promo-440x280.png`
- Modify: `experiments/webmcp-capability-forge/extension/public/manifest.json`
- Modify: `README.md`
- Modify: `STATUS.md`

**Interfaces:**
- Produces: validated import from `adaptive-webmcp-toolpack` version 1 and a versioned WebMCP Capability Forge export
- Produces: exact manual evidence gates for the lab, Wikipedia, and conditional YouTube testing

- [x] **Step 1: Write the failing legacy-import tests**

Accept old fill, click, waitFor, and extract steps after converting raw selectors into lowest-confidence selector evidence. Reject origin mismatch, replacement without approval, invalid paths, unsafe selectors, and unsupported legacy values. Assert new exports contain exact origin, schema version, revision metadata, and no session trace or failure history.

- [x] **Step 2: Run the focused import test and confirm failure**

Run: `pnpm --filter webmcp-capability-forge-extension test -- legacy-toolpack-importer.test.ts toolpack-exporter.test.ts`

Expected: FAIL because the importer is missing.

- [x] **Step 3: Implement atomic legacy import**

Parse the old pack through a dedicated strict schema, convert all tools in memory, validate them through the new `CapabilityValidator`, show the complete import review, and write nothing unless the person approves the whole set.

Implement `ToolPackExporter.create` to emit enabled definitions and revision metadata for one exact origin. Exclude sessions, raw traces, confirmations, execution history, and failure details.

- [x] **Step 4: Write product, privacy, and test documentation**

Document installation, permissions, stored fields, excluded data, limits, learning modes, cross-document checkpoint behavior, verification labels, tool-pack compatibility, and current limitations. Keep implemented facts separate from planned and manual claims. Add the MIT license with copyright `Kibalo Jules Tinaka`.

Mirror the public Terms and Privacy content in Markdown for Store review. Add permission justifications, concise and detailed Store descriptions, official website/privacy/support URLs, data-category answers, Limited Use certification text, and the no-telemetry statement. Require the Store dashboard answers, runtime behavior, website pages, and Markdown documents to agree.

Create `package-extension.ps1` to run the production build, verify the expected manifest and entry files, and produce `output/webmcp-capability-forge-extension.zip` from `extension/dist` without modifying the source manifest.

```powershell
pnpm --filter webmcp-capability-forge-extension build
New-Item -ItemType Directory -Path 'output' -Force | Out-Null
$required = @(
  'manifest.json',
  'background.js',
  'content.js',
  'main-world.js',
  'popup.js',
  'sidepanel.js',
  'popup.html',
  'sidepanel.html',
  'styles.css'
)
foreach ($name in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path 'extension/dist' $name))) {
    throw "Missing extension artifact: $name"
  }
}
Compress-Archive -Path 'extension/dist/*' -DestinationPath 'output/webmcp-capability-forge-extension.zip' -Force
```

- [x] **Step 5: Create the Store icon, screenshot, and promotional tile**

Use the approved WebMCP Capability Forge identity. Package 16, 32, 48, and 128 pixel PNG icons and reference them from `manifest.json` and the action. Set `homepage_url` to `https://webmcp-forge.jules-tnk.com`. Capture a current 1280x800 Hybrid-session screenshot from the production extension and website. Create a 440x280 PNG promotional tile without unsupported claims. Verify image dimensions and ensure the 128-pixel icon is present in the release ZIP.

- [x] **Step 6: Assess public-site candidates and select the second site**

Score candidates for semantic markup, same-origin routes, sensitive actions, reproducibility, terms, and selector stability. Select the highest-scoring candidate that supports a read or local-UI Automatic workflow. Record rejected candidates and reasons.

- [ ] **Step 7: Run native WebMCP evidence sessions**

Use the supported Chrome build and testing flag. Record browser version, extension build hash, date, goal, trace summary, verification state, reload result, failure/repair result, and screen recording reference for:

- Controlled lab Manual, Automatic, and Hybrid modes.
- One unmodified Wikipedia Automatic workflow.
- A YouTube read-oriented Hybrid workflow only when written permission or another documented Terms exception exists.
- One real-site restoration and one real-site reviewed repair.

- [x] **Step 8: Run final verification**

Run from `experiments/webmcp-capability-forge`:

```powershell
pnpm check:rules
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Expected: all automated commands pass. Complete the native checklist before claiming real-agent or public-site compatibility.

- [ ] **Step 9: Complete publication gates and update status without committing**

Record exact test counts, browser evidence, implemented limitations, deployment state, Store assets, and submission artifacts in `STATUS.md`. Before publication, reconfirm Firebase's current subprocessors/log handling in Privacy, obtain professional legal review of Terms and Privacy, add the public repository link, replace the release-in-progress message with the real Store URL, and reconcile the Chrome Web Store Privacy Practices answers against the release build. Leave all changes uncommitted unless the user gives explicit commit authorization.

## Execution checkpoints

Pause for review after Tasks 3, 3A, 6, 10, and 13:

- **Task 3:** shared contracts and Hybrid session semantics are stable.
- **Task 3A:** the official website, install disclosure, Terms, Privacy, and Support foundation is reviewable before deeper product work resumes.
- **Task 6:** trust boundaries, permissions, bridge, and storage are stable.
- **Task 10:** the complete capability lifecycle works through domain and integration tests.
- **Task 13:** the visible merged product works in loaded Chromium before live-site evidence begins.

## Final verification contract

Do not describe the project as complete until all of these are true:

- `pnpm check:rules`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm test:e2e` pass from the merged workspace root.
- The production manifest retains optional host permissions and no required broad host access.
- The new folder contains no explicit `any`, explicit `unknown`, or string-literal union in authored TypeScript.
- No TypeScript file exports more than one standalone function.
- Manual, Automatic, and Hybrid browser journeys pass.
- Same-origin SPA navigation and full-document checkpoint recovery pass.
- Verification labels match recorded evidence.
- Sensitive targets remain blocked.
- Failed repairs preserve the previous verified revision.
- Native Chrome evidence exists for the lab and Wikipedia. YouTube is either supported by a documented permission basis or explicitly excluded from release claims.
- The official website package replaces the old `lab` package and builds every product, legal, support, install, and `/lab/*` route.
- The website makes no analytics, advertising, tracking-cookie, account, telemetry, form, or mailing-list requests.
- Terms identify Kibalo Jules Tinaka, Moroccan governing law, mandatory consumer protections, and `julestnk.dev@gmail.com`.
- Privacy describes local website-content processing, `chrome.storage.local`, sensitive-target blocking, Limited Use, deletion/export, and Google Firebase Hosting.
- The Store listing, Privacy Practices answers, manifest permissions, website policies, and runtime behavior agree.
- The release ZIP contains referenced icons, and Store assets include a current 1280x800 screenshot and 440x280 promotional tile.
- Both original prototype folders remain unchanged.
