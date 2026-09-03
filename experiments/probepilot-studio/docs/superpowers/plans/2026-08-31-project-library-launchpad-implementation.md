# Project Library and Launchpad Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add a safe local project library, versioned JSON import/export, a 100-entry activity policy, and a richer explanatory launchpad.

**Architecture:** A versioned `ProjectRecord` and Zod codec form the durable boundary. `ProjectRepository` owns browser storage, a small autosave service bridges the active Zustand store, and React components consume those APIs without persisting bench-private or transient editor state.

**Tech Stack:** React 18, TypeScript 5.7, Zustand 5, Zod 3, React Router 6, Tailwind CSS 3, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-31-project-library-launchpad-design.md`

## Global Constraints

- Keep exactly the newest 100 activity entries.
- Persist and export only metadata, design, and public activity.
- Never persist or export simulation, active bench, hidden bench fault, selection, undo/redo, or zoom.
- Imports always create a new ID and never overwrite.
- All deterministic string sets introduced by this work use string enums.
- Do not use `any`, `unknown`, or exported string-literal unions.
- Do not commit; repository instructions require explicit commit authorization.

---

### Task 1: Activity retention policy

**Files:**
- Create: `src/activity/activity-log.ts`
- Create: `src/activity/activity-log.test.ts`
- Modify: `src/state/store.ts`

**Interfaces:**
- Produces: `ActivityLog.MaxEntries` and `ActivityLog.prepend(entries, entry)`.
- Consumes: `ActivityEvent` from `src/domain/types.ts`.

- [x] Write a failing test that prepends 101 timestamped events and expects the newest 100 in order.
- [x] Run `pnpm test -- src/activity/activity-log.test.ts` and confirm the module is missing.
- [x] Implement `ActivityLog` as one exported class and replace every `.slice(0, 150)` activity insertion in the store.
- [x] Run the focused test and `pnpm test -- src/state/store.test.ts`.

### Task 2: Versioned project codec and repository CRUD

**Files:**
- Create: `src/projects/project-types.ts`
- Create: `src/projects/project-codec.ts`
- Create: `src/projects/project-repository.ts`
- Create: `src/projects/project-repository.test.ts`

**Interfaces:**
- Produces: `ProjectRecord`, `ProjectSummary`, `ProjectSchemaVersion`, `ProjectCodec.parseImport`, `ProjectCodec.serialize`, and `ProjectRepository` CRUD methods.
- Consumes: `CircuitDesign`, `ActivityEvent`, `Storage`, Zod.

- [x] Write failing tests for create/read/update/delete, newest-first ordering, duplicate, imported ID replacement, name collision, malformed JSON rejection, 101-activity rejection, and export/import round trip.
- [x] Run `pnpm test -- src/projects/project-repository.test.ts` and confirm missing modules.
- [x] Define the exact version-1 types and schemas without transient or bench fields.
- [x] Implement immutable storage CRUD under `probepilot:projects:v1`.
- [x] Implement safe filenames and imported-name collision handling.
- [x] Run the focused repository tests.

### Task 3: Store project loading and autosave bridge

**Files:**
- Modify: `src/state/store.ts`
- Modify: `src/state/store.test.ts`
- Create: `src/projects/project-autosave.ts`
- Create: `src/projects/project-autosave.test.ts`
- Modify: `src/main.tsx`

**Interfaces:**
- Produces: `StudioState.loadProject(record)`, `StudioState.createDemoProject()`, `ProjectAutosave.start`, and observable `ProjectSaveStatus`.
- Consumes: `ProjectRepository`, `ProjectRecord`, `StoreApi<StudioState>`.

- [x] Add failing store tests proving load restores durable fields and clears simulation, bench, selection, wire draft, undo/redo, and zoom.
- [x] Add failing autosave tests proving durable changes save and storage failures report failure.
- [x] Run the focused tests and confirm the new APIs are absent.
- [x] Implement project loading and demo-template copy creation with new IDs.
- [x] Implement autosave with an initial hydration guard and start it from `main.tsx`.
- [x] Remove the legacy `probepilot:latest-project` subscription.
- [x] Run store and autosave tests.

### Task 4: Route hydration and project management UI

**Files:**
- Create: `src/projects/project-library.tsx`
- Create: `src/projects/project-library.test.tsx`
- Create: `src/projects/project-actions.tsx`
- Create: `src/projects/project-file-transfer.ts`
- Modify: `src/features/launchpad.tsx`
- Modify: `src/features/studio-page.tsx`
- Modify: `src/features/top-bar.tsx`
- Modify: `src/components/ui/dialog.tsx` only if an existing primitive is insufficient.

**Interfaces:**
- Produces: project rows with open, rename, duplicate, export, delete, and import actions; route hydration; visible save state.
- Consumes: repository and autosave interfaces from Tasks 2 and 3.

- [x] Write failing component tests for empty state, opening, renaming, duplicating, import success/error, delete confirmation, and save status labels.
- [x] Run `pnpm test -- src/projects/project-library.test.tsx` and confirm the component is absent.
- [x] Implement file download and picker helpers with concrete DOM types.
- [x] Implement the project list as dense rows, with actions revealed per row.
- [x] Load route records before workspace render; redirect missing IDs with a notice.
- [x] Add export/delete and save status to the studio top bar.
- [x] Run focused component tests.

### Task 5: Rich launchpad content

**Files:**
- Refactor: `src/features/launchpad.tsx`
- Create: `src/features/launchpad-sections.tsx`
- Create: `src/features/launchpad.test.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Produces: hero, project library, workflow, human-control, WebMCP explanation, FAQ, and final CTA sections.
- Consumes: `ProjectLibrary`, theme tokens, existing launch actions.

- [x] Write a failing test for the core headings, FAQ questions, demo action, blank action, and project library landmark.
- [x] Run the focused test and confirm the new sections are absent.
- [x] Refactor the hero into a full-width engineering workspace composition that keeps the current proof circuit.
- [x] Add the project library directly after the hero.
- [x] Add the four-step workflow, human-control explanation, structured WebMCP explanation, six-question FAQ, and final CTA with direct copy.
- [x] Add restrained entrance, expansion, and circuit-line motion with reduced-motion fallbacks.
- [x] Run launchpad and project-library tests.

### Task 6: Documentation and complete verification

**Files:**
- Modify: `README.md`
- Modify: `docs/product/experience-spec.md`
- Modify: `docs/testing.md`

**Interfaces:**
- Documents: durable boundary, local CRUD, JSON schema behavior, 100-entry limit, and manual verification path.

- [x] Update routes, persistence boundaries, import/export format, and user workflow documentation.
- [x] Run `pnpm test` and require zero failures.
- [x] Run `pnpm typecheck` and require exit code 0.
- [x] Run `pnpm build` and require exit code 0.
- [x] Verify the approved CRUD, reload, JSON, activity, theme, and responsive flows in the Browser.
