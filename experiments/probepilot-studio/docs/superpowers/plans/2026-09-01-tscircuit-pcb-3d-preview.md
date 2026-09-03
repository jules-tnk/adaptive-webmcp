# tsCircuit PCB and 3D Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add revision-linked read-only PCB and interactive 3D assembly previews with deterministic generic footprints, explicit preview status, and a non-WebGL SVG fallback.

**Architecture:** Version-2 project metadata stores physical placement separately from the electrical design. The tsCircuit adapter emits PCB Circuit JSON; PCB renders to SVG, while 3D lazy-loads `CadViewer` and falls back to simplified angle-preset SVG.

**Tech Stack:** Stage-two stack, React/React DOM 19.1.0, `circuit-to-svg@0.0.411`, `@tscircuit/alphabet@0.0.26`, `@tscircuit/circuit-json-util@0.0.111`, `@tscircuit/core@0.0.1816`, `@tscircuit/3d-viewer@0.0.597`, `circuit-json-to-simple-3d@0.0.10`, `@tscircuit/simple-3d-svg@0.0.41`.

**Spec:** `docs/superpowers/specs/2026-09-01-tscircuit-integration-design.md`

## Global Constraints

- Complete and verify stages one and two first.
- Treat PCB/3D as previews; never claim fabrication readiness.
- Do not let physical placement alter electrical simulation, Bench, or WebMCP mutation semantics.
- Do not load external CAD URLs by default.
- Lazy-load 3D code and preserve a usable Circuit view when WebGL or assets fail.
- Pin exact versions and do not commit without separate authorization.

---

### Task 1: Upgrade and verify React 19 compatibility

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `src/main.tsx` only if compiler errors require API changes.
- Create: `src/tests/react-version-contract.test.tsx`

**Interfaces:**
- Produces: React and React DOM 19.1.0 runtime compatible with Radix, Router, Zustand, tests, and 3D viewer peer requirements.

- [ ] Add a failing contract test asserting React major 19 and exercising Dialog portal, Router navigation, Zustand subscription, and StrictMode mount cleanup.
- [ ] Run the focused test; expect the version assertion to fail on 18.3.1.
- [ ] Run `pnpm add --save-exact react@19.1.0 react-dom@19.1.0` and matching exact `@types/react`/`@types/react-dom` dev dependencies.
- [ ] Fix only demonstrated compatibility failures; run all 44+ tests, typecheck, build, and the launchpad/studio Browser smoke flow before adding viewers.

### Task 2: Pin and prove physical-view dependencies

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `src/tscircuit/physical-dependency-contract.test.ts`

**Interfaces:**
- Produces: PCB SVG conversion, Circuit JSON utilities, lazy-loadable `CadViewer`, and simple 3D fallback conversion.

- [ ] Write a failing test importing each pinned renderer and converting a minimal one-resistor board to PCB SVG and simplified 3D SVG.
- [ ] Install all exact versions listed in this plan with `pnpm add --save-exact`.
- [ ] Run the contract test and production build; inspect the base and lazy chunk sizes and record them in `docs/testing.md`.

### Task 3: Add version-2 physical project metadata

**Files:**
- Create: `src/physical/physical-design.ts`
- Create: `src/physical/physical-design.test.ts`
- Create: `src/physical/physical-layout.ts`
- Create: `src/physical/physical-layout.test.ts`
- Modify: `src/projects/project-types.ts`
- Modify: `src/projects/project-codec.ts`
- Modify: `src/projects/project-repository.test.ts`

**Interfaces:**
- Produces: `PhysicalPlacementMode`, `PhysicalPlacement`, `PhysicalDesign`, and `PhysicalLayout.generate(design, registry)`.

- [ ] Write failing migration tests for version-1 imports and deterministic layout tests for 0, 1, 5, and 21 components.
- [ ] Add board dimensions, thickness, component X/Y/rotation/side/footprint, and placement mode with bounded Zod schemas.
- [ ] Generate stable row/column placement ordered by component ID; expand board bounds deterministically without changing schematic positions.
- [ ] Persist/export version 2 and preserve name, ID, design revision, and 100 activities during migration.
- [ ] Run project repository and import/export tests.

### Task 4: Emit PCB Circuit JSON

**Files:**
- Modify: `src/tscircuit/tscircuit-adapter.ts`
- Modify: `src/tscircuit/tscircuit-adapter.test.ts`
- Create: `src/tscircuit/footprint-adapter.ts`
- Create: `src/tscircuit/footprint-adapter.test.ts`

**Interfaces:**
- Produces: board, footprint, pad, PCB component, via-free trace, and CAD metadata elements linked to stable source IDs.

- [ ] Add failing snapshots for the demo board, RC board, transistor generic package, and missing-footprint fallback.
- [ ] Map every initial catalog footprint to supported tsCircuit footprint data and generic package dimensions.
- [ ] Emit deterministic PCB elements from `PhysicalDesign`; return warning diagnostics for generic geometry rather than failing the circuit view.
- [ ] Assert private Bench data and physical metadata never enter simulation input except footprint-independent source connectivity.

### Task 5: Add the PCB preview

**Files:**
- Create: `src/features/pcb-preview.tsx`
- Create: `src/features/pcb-preview.test.tsx`
- Create: `src/physical/use-physical-preview.ts`
- Modify: `src/features/circuit-board.tsx`
- Modify: `src/features/workbench.tsx`

**Interfaces:**
- Produces: accessible read-only PCB SVG with auto-layout status, revision, warnings, zoom, and reset controls.

- [ ] Write failing tests for valid SVG, auto-layout badge, stale revision regeneration, generic footprint warning, and light/dark colors.
- [ ] Convert current Circuit JSON through `circuit-to-svg`; sanitize the returned SVG with an allowlist before rendering.
- [ ] Keep component IDs selectable by linking SVG data attributes to the existing store selection.
- [ ] Run focused tests and Browser visual comparison against the Circuit view.

### Task 6: Add interactive 3D with fallback

**Files:**
- Create: `src/features/assembly-preview.tsx`
- Create: `src/features/assembly-preview.test.tsx`
- Create: `src/features/assembly-preview-loader.ts`
- Create: `src/features/simple-3d-fallback.tsx`
- Create: `src/features/simple-3d-fallback.test.tsx`

**Interfaces:**
- Produces: lazy `CadViewer`, restricted asset resolver, loading/error states, and six-angle SVG fallback.

- [ ] Write failing tests for lazy loading, generic component geometry, denied external URL, WebGL failure, angle change, and reduced motion.
- [ ] Lazy-import `@tscircuit/3d-viewer` only when the 3D view opens; wrap it in an error boundary.
- [ ] Pass only derived public Circuit JSON and resolve bundled assets; reject HTTP assets unless a future explicit policy allows them.
- [ ] Render `circuit-json-to-simple-3d` fallback with angle1, angle2, left, right, left-raised, and right-raised controls.
- [ ] Run focused tests and confirm initial Circuit-route bundle does not contain the 3D viewer chunk.

### Task 7: Add the workspace view selector and physical inspector

**Files:**
- Create: `src/features/workspace-view-switcher.tsx`
- Create: `src/features/workspace-view-switcher.test.tsx`
- Create: `src/features/physical-inspector.tsx`
- Create: `src/features/physical-inspector.test.tsx`
- Modify: `src/features/studio-page.tsx`
- Modify: `src/features/inspector-panel.tsx`
- Modify: `src/state/store.ts`

**Interfaces:**
- Produces: `WorkspaceView` values Circuit/PCB/ThreeD and physical board/placement editing that does not create an electrical revision.

- [ ] Write failing tests for view switching, keyboard tabs, persisted physical edits, reset auto-layout, and unchanged electrical revision/simulation.
- [ ] Place the secondary selector inside the center workspace, visually separate from Design/Simulate/Bench workflow modes.
- [ ] Add board dimensions, footprint, X/Y, rotation, and board-side controls in the physical inspector.
- [ ] Default Simulate and Bench to Circuit while allowing read-only preview switching without revealing faults.

### Task 8: Extend public inspection without physical mutation tools

**Files:**
- Modify: `src/webmcp/public-dto.ts`
- Modify: `src/webmcp/tools.test.ts`
- Modify: `src/webmcp/tools.ts`

**Interfaces:**
- Produces: read-only physical preview summary and warnings in `studio_inspect`.

- [ ] Add failing tests that inspect footprint/placement/preview availability and prove no PCB/3D mutation tool exists.
- [ ] Expose public physical metadata and preview diagnostics but omit viewer internals, external asset paths, and private bench state.
- [ ] Preserve all nine existing tool names and behavioral contracts.

### Task 9: Document and verify stage three

**Files:**
- Modify: `README.md`
- Modify: `docs/product/experience-spec.md`
- Modify: `docs/architecture/system-design.md`
- Modify: `docs/architecture/security-and-safety.md`
- Modify: `docs/testing.md`

- [ ] Document preview status, generic footprints, local asset policy, React migration, fallback behavior, and non-fabrication warning.
- [ ] Run `pnpm test`, `pnpm typecheck`, and `pnpm build` and compare bundle sizes with the recorded stage-two baseline.
- [ ] In Browser, verify Circuit/PCB/3D on demo, RC, and mixed unsupported circuits in light/dark and reduced-motion settings.
- [ ] Force WebGL failure and external-model denial, then verify the SVG fallback remains usable.
- [ ] Repeat project reload/import/export and the complete deterministic WebMCP judging path.
