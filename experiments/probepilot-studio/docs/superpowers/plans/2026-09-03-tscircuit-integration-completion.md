# tsCircuit Integration Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the verified SPICE, physical PCB, and 3D integration from the current Stage 2 Task 5 state through production-ready Browser validation.

**Architecture:** ProbePilot remains canonical. The completed component registry and Circuit JSON/SPICE adapters feed an asynchronous simulation coordinator and a separate versioned physical-design projection; PCB and 3D remain read-only derived views with no private bench data.

**Tech Stack:** React 18.3.1 then 19.1.0, TypeScript 5.7, Zustand 5, Zod 3, pinned tsCircuit packages, local ngspice WASM, Vitest, Vite.

**Spec:** `docs/superpowers/specs/2026-09-01-tscircuit-integration-design.md`

## Global Constraints

- Work in the existing user-selected workspace; do not create a branch, worktree, commit, server, or deployment without separate authorization.
- Keep all tsCircuit/SPICE foundation imports inside `src/tscircuit/` and preserve the executable isolation test.
- Keep the original deterministic demo authoritative and Bench-capable.
- Promote SPICE capability only after real parity fixtures pass.
- Never expose hidden bench faults through Circuit JSON, SPICE payloads, persistence, PCB, 3D, or WebMCP.
- PCB and 3D are labelled previews and never claim fabrication readiness.
- Use string enums for deterministic value sets and no `any`/`unknown` in application logic.

---

### Task 1: Close asynchronous engine integration

**Files:**
- Verify/modify: `src/simulation/simulation-coordinator.ts`
- Verify/modify: `src/state/store.ts`
- Verify/modify: `src/state/store.test.ts`
- Verify/modify: `src/webmcp/tools.test.ts`
- Verify/modify: `src/features/top-bar.tsx`
- Verify/modify: `src/features/left-panel.tsx`

**Interfaces:**
- Produces: coordinator-authored `executedEngineId`, store `requestedEngineId`, supersession state, and deterministic-only Bench eligibility.

- [x] Run the Task 5 focused tests proving omitted or falsified engine metadata cannot label SPICE as deterministic or unlock Bench.
- [x] Inspect the coordinator/store boundary and remove every fallback that infers executed engine identity.
- [x] Run `pnpm test`, `pnpm typecheck`, and `pnpm build`; update the Stage 2 ledger and mark original Task 5 complete.

### Task 2: Finish simulation presentation

**Files:**
- Create: `src/features/simulation-results.tsx`
- Create: `src/features/simulation-results.test.tsx`
- Create: `src/features/waveform-chart.tsx`
- Create: `src/features/waveform-chart.test.tsx`
- Modify: `src/features/inspector-panel.tsx`
- Modify: `src/features/workbench.tsx`

**Interfaces:**
- Consumes: normalized `SimulationResult`, `requestedEngineId`, `executedEngineId`, analysis type, waveforms, compatibility blockers.
- Produces: accessible result summary, data table, and SVG waveform chart.

- [x] Write failing tests for deterministic summary, SPICE operating point, transient/DC/AC waveforms, empty probes, error diagnostics, keyboard reading order, and light/dark tokens.
- [x] Run the focused tests and confirm missing components fail.
- [x] Implement an SVG chart with labelled axes, bounded paths, point summaries, and a table alternative; do not add a chart dependency.
- [x] Render exact requested/executed engines, analysis, duration, warnings, blockers, node values, component readings, and waveforms without exposing raw engine payloads.
- [x] Run focused tests, full tests, typecheck, and build.

### Task 3: Prove parity, promote capabilities, and finish Stage 2

**Files:**
- Create: `src/simulation/simulation-parity.test.ts`
- Modify: `src/components/component-definition-registry.ts`
- Modify: `src/domain/bench.test.ts`
- Modify: `src/webmcp/tools.test.ts`
- Modify: `src/tscircuit/tscircuit-adapter.test.ts`
- Modify: `README.md`
- Modify: `docs/architecture/system-design.md`
- Modify: `docs/architecture/security-and-safety.md`
- Modify: `docs/testing.md`

**Interfaces:**
- Produces: tested SPICE promotion for DC source, ground, resistor, LED, switch, battery, current source, capacitor, inductor, diode families, fuse, potentiometer, pushbutton, and SPDT.

- [x] Write parity/privacy tests for source voltage, divider midpoint/current, LED state/current, RC final voltage, RL behavior, diode output, and open path using real local WASM.
- [x] Assert SPICE/Circuit JSON/waveform/DTO serialization excludes all hidden-fault markers and Bench IDs.
- [x] Run tests red with SPICE capabilities still unavailable, then promote only component kinds whose fixtures pass.
- [x] Verify unsupported BJT/MOSFET/op-amp circuits list exact blockers and never execute SPICE.
- [x] Update documentation with engine selection, ideal switch/fuse values, tolerances, local WASM size, limitations, and no-abort supersession behavior.
- [x] Run the complete deterministic WebMCP Bench journey and SPICE Browser fixtures; complete Stage 2 only after full tests, typecheck, build, and zero console errors.

### Task 4: Upgrade React and add physical project schema

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `src/tests/react-version-contract.test.tsx`
- Create: `src/physical/physical-design.ts`
- Create: `src/physical/physical-design.test.ts`
- Create: `src/physical/physical-layout.ts`
- Create: `src/physical/physical-layout.test.ts`
- Modify: `src/projects/project-types.ts`
- Modify: `src/projects/project-codec.ts`
- Modify: `src/projects/project-repository.test.ts`

**Interfaces:**
- Produces: React 19.1.0 compatibility and version-2 `PhysicalDesign` with board dimensions and deterministic component placements.

- [x] Write the React-major contract and exercise Dialog, Router, Zustand, and StrictMode cleanup before upgrading.
- [x] Upgrade React, React DOM, and matching type packages to exact 19.1.0-compatible versions; run the entire gate before physical work.
- [x] Write failing version-1 migration and deterministic 0/1/5/21-component layout tests.
- [x] Implement enum-backed placement mode, board dimensions/thickness, footprint, X/Y, rotation, and side with bounded strict schemas.
- [x] Migrate version-1 files without changing IDs, revisions, circuit data, or 100 activities; persist/export version 2.
- [x] Run repository, migration, full tests, typecheck, and build.

### Task 5: Add PCB Circuit JSON and preview

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `src/tscircuit/tscircuit-adapter.ts`
- Create: `src/tscircuit/footprint-adapter.ts`
- Create: `src/tscircuit/footprint-adapter.test.ts`
- Create: `src/features/pcb-preview.tsx`
- Create: `src/features/pcb-preview.test.tsx`
- Create: `src/physical/use-physical-preview.ts`

**Interfaces:**
- Consumes: `CircuitDesign`, `PhysicalDesign`, registry footprints.
- Produces: validated PCB Circuit JSON and sanitized read-only SVG preview.

- [x] Pin the exact physical packages from the design spec and prove minimal PCB/SVG conversion in a dependency contract test.
- [x] Write failing fixtures for demo, complete catalog, missing footprint, auto-layout badge, manual status, zoom, and light/dark-safe colors.
- [x] Map all 21 default footprints to board, pad, PCB component, trace, silkscreen, and generic CAD metadata with stable source links.
- [x] Validate every generated element through Circuit JSON and render SVG only as an encoded image resource; preserve stable component IDs.
- [x] Show revision, zoom, reset, auto-layout status, and generic-footprint warnings; never enable editing in the viewer.
- [x] Run focused/full/type/build and confirm private data is absent.

### Task 6: Add lazy local 3D assembly preview

**Files:**
- Create: `src/features/assembly-preview.tsx`
- Create: `src/features/assembly-preview.test.tsx`
- Create: `src/features/simple-3d-fallback.tsx`
- Create: `src/features/simple-3d-fallback.test.tsx`

**Interfaces:**
- Produces: a lazy, bundled-only, error-contained six-angle SVG assembly preview with generic CAD geometry.

- [x] Write tests for lazy loading, generic geometry, six angle presets, zoom, error containment, theme-safe output, and reduced motion.
- [x] Evaluate `@tscircuit/3d-viewer`, document its undeclared peer-chain incompatibility, and avoid shipping the fragile dependency.
- [x] Restrict rendering to generated local CAD bounding boxes with no model URLs or external assets.
- [x] Lazy-load `circuit-json-to-simple-3d` with angle and zoom controls and preserve Circuit/PCB access on failure.
- [x] Verify the initial route does not preload the 3D or WASM chunks and run focused/full/type/build.

### Task 7: Complete workspace integration and release verification

**Files:**
- Create: `src/features/workspace-view-switcher.tsx`
- Create: `src/features/workspace-view-switcher.test.tsx`
- Create: `src/features/physical-inspector.tsx`
- Create: `src/features/physical-inspector.test.tsx`
- Modify: `src/features/studio-page.tsx`
- Modify: `src/features/inspector-panel.tsx`
- Modify: `src/state/store.ts`
- Modify: `src/webmcp/public-dto.ts`
- Modify: `src/webmcp/tools.test.ts`
- Modify: project documentation files.

**Interfaces:**
- Produces: Circuit/PCB Preview/3D Preview workspace views, physical inspector, and read-only public preview metadata.

- [x] Write failing tests for keyboard view switching, physical edits, auto-layout reset, unchanged electrical revision/simulation, public preview inspection, and absence of PCB/3D mutation tools.
- [x] Implement the secondary view selector separately from Design/Simulate/Bench and keep Simulate/Bench defaulting to Circuit.
- [x] Add board/placement controls whose changes persist without changing electrical revision.
- [x] Expose public footprint/placement/preview diagnostics through `studio_inspect` while preserving nine tool names and private boundaries.
- [x] Update README, experience, architecture, security, WebMCP, and testing documentation.
- [x] Run full tests, typecheck, warning-free production build, dependency/import scans, and privacy serialization scans.
- [x] Verify project persistence, deterministic Bench, SPICE fixtures, PCB, lazy 3D, light/dark, keyboard paths, and zero console errors in Browser; import/export remains covered by repository and launchpad integration tests.

## Completion evidence

- 337 tests across 45 files passed in the final handoff gate.
- Production output keeps the 7.20 MB raw local-ngspice runtime and 118.98 kB raw 3D renderer out of initial module preloads.
- Chrome verified physical persistence without an electrical revision, deterministic simulation tables, Bench eligibility, PCB and 3D rendering, light/dark switching, and zero console errors.
- No commit, branch, worktree, deployment, external asset request, or hidden-state exposure was introduced.
