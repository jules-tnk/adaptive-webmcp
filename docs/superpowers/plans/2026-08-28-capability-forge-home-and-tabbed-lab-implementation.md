# Capability Forge Home and Tabbed Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mixed-audience project homepage and split Capability Forge into Workflow, Review, and Evidence routes backed by one persistent lab session.

**Architecture:** React Router nested routes mount a `LabSessionProvider` once in `LabLayout`, while focused child pages consume a typed context. The provider owns existing stores, repository, WebMCP handlers, compiled registrations, visible replay orchestration, and cross-tab state; the homepage remains outside it and registers no tools.

**Tech Stack:** React 19, React Router 7, TypeScript, Tailwind CSS 4, Vitest, Testing Library, Playwright, WebMCP imperative API

**Spec:** `docs/superpowers/specs/2026-08-28-capability-forge-home-and-tabbed-lab-design.md`

## Global Constraints

- Keep current design tokens and brand identity.
- Preserve all capability validation, workflow execution, persistence, human approval, and repair behavior.
- Register no WebMCP tools on the homepage.
- Register compiled tools only with a visible Workflow lab root.
- Change capability scope pathname to `/lab/workflow` everywhere.
- Replace user-facing `v1`/`v2` with `Baseline DOM`/`Changed DOM`; internal type values may remain `v1`/`v2`.
- Preserve current accessible catalog labels and machine selectors.
- Add no backend, external runtime service, gradients, commits, branches, worktrees, or subagents.

**Testing override:** The user explicitly requested no UI component tests. Steps below that originally mention router, page, tab, or component tests are satisfied through the desktop/mobile Playwright journeys. Only domain and `LabSessionProvider` logic tests are retained.

---

### Task 1: Introduce the route map and homepage

**Files:**
- Create: `experiments/capability-forge/src/pages/HomePage.tsx`
- Create: `experiments/capability-forge/src/components/SiteHeader.tsx`
- Create: `experiments/capability-forge/src/app/router.test.tsx`
- Modify: `experiments/capability-forge/src/app/router.tsx`
- Modify: `experiments/capability-forge/src/App.tsx`

**Interfaces:**
- Produces: `/`, `/lab` redirect, `/lab/workflow`, `/lab/review`, `/lab/evidence`, and fallback route contracts

- [x] **Step 1: Write failing router and homepage tests**

Use `MemoryRouter` or `createMemoryRouter` to assert:

```tsx
expect(screen.getByRole('heading', { name: 'Capability Forge' })).toBeVisible()
expect(screen.getByRole('link', { name: 'Open the Lab' })).toHaveAttribute(
  'href',
  '/lab/workflow',
)
```

Assert `/lab` resolves to Workflow and the homepage contains Technical architecture, Safety by construction, and the eight FAQ questions.

- [x] **Step 2: Run the router test and confirm failure**

Run: `pnpm test -- src/app/router.test.tsx`

Expected: FAIL because the homepage and nested routes do not exist.

- [x] **Step 3: Implement `SiteHeader` and `HomePage`**

`SiteHeader` accepts `mode: 'dark' | 'light'` and renders the Capability Forge wordmark plus Home and Lab links. `HomePage` renders the approved hero, lifecycle, architecture, safety, FAQ, and final CTA with no WebMCP hooks.

- [x] **Step 4: Implement the new top-level route map**

Create route elements for the homepage and nested lab paths. Use explicit `Navigate` elements for `/lab` and `*`.

- [x] **Step 5: Run focused tests**

Run: `pnpm test -- src/app/router.test.tsx`

Expected: homepage assertions pass; child routes may remain pending until Task 3.

### Task 2: Extract persistent lab session state

**Files:**
- Create: `experiments/capability-forge/src/app/LabSessionContext.tsx`
- Create: `experiments/capability-forge/src/app/LabSessionContext.test.tsx`
- Modify: `experiments/capability-forge/src/app/ForgeWorkspace.tsx`

**Interfaces:**
- Produces: `LabSessionProvider`, `useLabSession()`, `LabSessionValue`, `setLabContainer`, `approve`, `reject`, and all current state values

- [x] **Step 1: Write failing provider tests**

Render a context probe inside `MemoryRouter`. Assert state survives navigation, `startTeaching` without a lab root returns `WORKFLOW_TAB_REQUIRED`, and proposal/open-review handlers navigate to `/lab/review`.

- [x] **Step 2: Run the provider test and confirm failure**

Run: `pnpm test -- src/app/LabSessionContext.test.tsx`

Expected: FAIL because the provider does not exist.

- [x] **Step 3: Move state and handlers into `LabSessionProvider`**

Move the stores, repository, recorder, revision state, preflight state, handlers, compiled registration, and callbacks from `ForgeWorkspace`. Expose them through a typed context. Return structured Workflow-required errors when `labRoot` is absent.

- [x] **Step 4: Implement visible replay routing**

`approve(revisionId)` transitions to `approved`/`verifying`, records a pending revision, and navigates to `/lab/workflow`. An effect verifies once `labRoot` mounts, records metrics/status, clears pending state, and navigates back to `/lab/review`.

- [x] **Step 5: Restrict compiled registration to visible Workflow DOM**

Do not construct `CompiledToolRegistration` when `labRoot` is null. Cleanup aborts registrations when Workflow unmounts; returning to Workflow re-registers verified revisions.

- [x] **Step 6: Run provider tests**

Run: `pnpm test -- src/app/LabSessionContext.test.tsx`

Expected: PASS.

### Task 3: Build the lab layout and Workflow route

**Files:**
- Create: `experiments/capability-forge/src/app/LabLayout.tsx`
- Create: `experiments/capability-forge/src/components/LabTabs.tsx`
- Create: `experiments/capability-forge/src/pages/WorkflowPage.tsx`
- Create: `experiments/capability-forge/src/components/LabTabs.test.tsx`
- Modify: `experiments/capability-forge/src/app/router.tsx`
- Modify: `experiments/capability-forge/src/app/ForgeWorkspace.tsx`

**Interfaces:**
- Consumes: `LabSessionProvider` and `useLabSession()`
- Produces: persistent lab shell, three route links, and `/lab/workflow` operational page

- [x] **Step 1: Write failing tab navigation tests**

Assert Workflow, Review, and Evidence are links to their exact routes and the active link exposes `aria-current="page"`.

- [x] **Step 2: Run the tab test and confirm failure**

Run: `pnpm test -- src/components/LabTabs.test.tsx`

Expected: FAIL because the tabs do not exist.

- [x] **Step 3: Implement `LabLayout` and `LabTabs`**

Wrap `Outlet` with `LabSessionProvider`. Keep header and sticky horizontally scrollable tab bar mounted across route changes.

- [x] **Step 4: Implement `WorkflowPage`**

Move the dark operational hero, fixture controls, `LegacyLab`, teaching controls, and trace summary from `ForgeWorkspace`. Render `Baseline DOM` and `Changed DOM` while preserving `v1`/`v2` state values and selector behavior.

- [x] **Step 5: Run focused Workflow tests**

Run: `pnpm test -- src/App.test.tsx src/lab/LegacyLab.test.tsx src/components/LabTabs.test.tsx`

Expected: PASS after tests target `/lab/workflow` through the provider.

### Task 4: Build Review and Evidence routes

**Files:**
- Create: `experiments/capability-forge/src/pages/ReviewPage.tsx`
- Create: `experiments/capability-forge/src/pages/EvidencePage.tsx`
- Create: `experiments/capability-forge/src/pages/LabPages.test.tsx`
- Modify: `experiments/capability-forge/src/app/router.tsx`
- Modify: `experiments/capability-forge/src/metrics/MetricsPanel.tsx`

**Interfaces:**
- Consumes: selected revision, approval/rejection, failure, revisions, and MetricsStore from `useLabSession()`
- Produces: direct-loadable governance and evidence pages

- [x] **Step 1: Write failing route-page tests**

Assert Review empty state links to Workflow, Evidence renders Interaction evidence, and switching routes retains a trace/proposal summary from the provider.

- [x] **Step 2: Run the page tests and confirm failure**

Run: `pnpm test -- src/pages/LabPages.test.tsx`

Expected: FAIL because the pages do not exist.

- [x] **Step 3: Implement `ReviewPage`**

Render `ReviewPanel`, `FailureReport`, pending verification status, revision history, and an empty state. Preserve existing approval/rejection button names.

- [x] **Step 4: Implement `EvidencePage`**

Render `MetricsPanel` plus a local-evidence explanatory note. Keep numbers and statuses connected to the persistent MetricsStore.

- [x] **Step 5: Run focused page tests**

Run: `pnpm test -- src/pages/LabPages.test.tsx src/review/ReviewPanel.test.tsx`

Expected: PASS.

### Task 5: Update capability scope and WebMCP route behavior

**Files:**
- Modify: `experiments/capability-forge/src/capability/schema.ts`
- Modify: `experiments/capability-forge/src/capability/validate-capability.test.ts`
- Modify: `experiments/capability-forge/src/webmcp/model-context-adapter.test.ts`
- Modify: `experiments/capability-forge/e2e/capability-forge.spec.ts`
- Modify: `experiments/capability-forge/docs/REAL-WEBMCP-TEST.md`
- Modify: `experiments/capability-forge/docs/DEMO-SCRIPT.md`
- Modify: `experiments/capability-forge/README.md`

**Interfaces:**
- Produces: `/lab/workflow` capability scope, route-aware tool availability, and accurate testing instructions

- [x] **Step 1: Write failing scope and lifecycle tests**

Assert `/lab` scope is rejected, `/lab/workflow` is accepted, compiled tools disappear without a visible lab root, and stable forge tools are absent on the homepage.

- [x] **Step 2: Run focused tests and confirm failure**

Run: `pnpm test -- src/capability/validate-capability.test.ts src/webmcp/model-context-adapter.test.ts`

Expected: FAIL on the old pathname contract or lifecycle behavior.

- [x] **Step 3: Change pathname validation and fixtures**

Replace the literal `/lab` with `/lab/workflow` in the schema, unit fixtures, proposal examples, E2E definitions, and documentation.

- [x] **Step 4: Update E2E navigation**

Start at `/lab/workflow`, teach there, assert proposal navigation to Review, approve, observe visible Workflow replay and return to Review, navigate to Evidence, return to Workflow for reuse, reload, and test Changed DOM repair.

- [x] **Step 5: Run focused tests**

Run: `pnpm test -- src/capability src/webmcp`

Expected: PASS.

### Task 6: Verify the complete information architecture

**Files:**
- Inspect: all files modified above

**Interfaces:**
- Produces: release-quality test and browser evidence

- [x] **Step 1: Run complete verification**

```powershell
pnpm test
pnpm typecheck
pnpm build
$env:CAPABILITY_FORGE_E2E_PORT='4176'; pnpm test:e2e
```

Expected: every command exits 0 across desktop and mobile projects.

- [x] **Step 2: Inspect routes in Chrome**

Verify `/`, `/lab/workflow`, `/lab/review`, and `/lab/evidence`; browser back/forward; direct reload; tab active state; homepage FAQ; mixed-audience content; mobile tab scrolling; and zero console errors.

- [x] **Step 3: Run repository checks**

Run `git diff --check` and `git status --short --branch`.

Expected: no whitespace errors, no commit, and only intended workspace changes.
