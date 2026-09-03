# tsCircuit SPICE Simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a verified local ngspice engine for compatible analog circuits while retaining deterministic simulation for the challenge demo and preventing partial or model-less results.

**Architecture:** `SimulationCoordinator` owns engine selection. A deterministic adapter wraps the current solver; a tsCircuit SPICE adapter builds a complete typed netlist, executes ngspice, and maps operating-point/transient data into ProbePilot results.

**Tech Stack:** Stage-one stack plus `spicets@0.0.5`, `circuit-json-to-spice@0.0.46`, `@tscircuit/ngspice-spice-engine@0.0.21`.

**Spec:** `docs/superpowers/specs/2026-09-01-tscircuit-integration-design.md`

## Global Constraints

- Complete the component-foundation plan first.
- Run simulation locally; do not introduce a server or hosted tsCircuit API.
- Never run SPICE when any component lacks a verified mapping.
- Keep the original switched-LED fixture on the deterministic engine until parity tests pass.
- Keep bench creation human-only and private faults out of Circuit JSON/netlists returned publicly.
- Pin exact package versions and do not commit without separate authorization.

---

### Task 1: Pin and prove the SPICE runtime

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `src/simulation/spice-runtime-contract.test.ts`

**Interfaces:**
- Produces: typed SPICE cards and an ngspice engine callable from the browser build.

- [x] Write a failing contract test that creates a voltage-divider netlist with `spicets` and imports the ngspice engine without Node built-ins.
- [x] Run the test; expect missing modules.
- [x] Run `pnpm add --save-exact spicets@0.0.5 circuit-json-to-spice@0.0.46 @tscircuit/ngspice-spice-engine@0.0.21`.
- [x] Run the focused test and production build; reject the dependency set if Vite includes unresolved Node APIs.

### Task 2: Introduce the engine contract and coordinator

**Files:**
- Create: `src/simulation/simulation-engine.ts`
- Create: `src/simulation/simulation-coordinator.ts`
- Create: `src/simulation/simulation-coordinator.test.ts`
- Create: `src/simulation/deterministic-simulation-engine.ts`
- Modify: `src/domain/simulation.ts`

**Interfaces:**
- Produces: `SimulationEngineId`, `SimulationRequest`, `SimulationCompatibility`, `SimulationEngine`, and `SimulationCoordinator.simulate`.

- [x] Write failing tests for deterministic selection, SPICE selection, unsupported-component rejection, preferred-engine override, and engine failure diagnostics.
- [x] Run the focused test; expect missing modules.
- [x] Wrap `simulateDcCircuit` without changing its output and implement coordinator preflight that lists every blocking component ID and reason.
- [x] Make `simulate` asynchronous at the coordinator boundary while keeping the deterministic engine internally synchronous.
- [x] Run simulation, store, bench, and WebMCP tests.

### Task 3: Map supported components to complete SPICE netlists

**Files:**
- Create: `src/tscircuit/probepilot-to-spice.ts`
- Create: `src/tscircuit/probepilot-to-spice.test.ts`
- Create: `src/tscircuit/spice-model-registry.ts`
- Create: `src/tscircuit/spice-model-registry.test.ts`

**Interfaces:**
- Produces: `ProbePilotToSpice.convert(design, request): SpiceConversionResult` and verified mappings for source, battery, current source, resistor, capacitor, inductor, diode families, LED, switch, pushbutton, fuse, and potentiometer.

- [x] Write exact-netlist failing fixtures for voltage divider, RC low-pass, RL circuit, LED limiter, diode rectifier, open switch, and potentiometer divider.
- [x] Run focused tests; expect absent adapter.
- [x] Build every netlist with `spicets` cards; map ground to node `0`, emit stable element names, and include analysis/probe commands from `SimulationRequest`.
- [x] Represent ideal switches/pushbuttons/fuses with documented closed/open resistance values and LEDs/diodes with named model cards.
- [x] Return errors for BJT, MOSFET, op-amp, or any unregistered model before producing executable text.
- [x] Cross-check `circuit-json-to-spice` output for its supported R/C/BJT subset without making it authoritative.
- [x] Run conversion and registry tests.

### Task 4: Execute ngspice and normalize results

**Files:**
- Create: `src/simulation/tscircuit-spice-simulation-engine.ts`
- Create: `src/simulation/tscircuit-spice-simulation-engine.test.ts`
- Create: `src/simulation/spice-result-mapper.ts`
- Create: `src/simulation/spice-result-mapper.test.ts`

**Interfaces:**
- Produces: operating-point values, DC/AC sweep series, transient series, component voltages/currents, and typed engine diagnostics.

- [x] Add failing golden tests with captured ngspice outputs for voltage divider, RC, LED, and malformed netlist cases.
- [x] Run focused tests; expect missing engine.
- [x] Adapt the package engine behind `TscircuitSpiceSimulationEngine` and isolate engine-specific payloads from the store.
- [x] Map node names back to component terminals and return the existing `SimulationResult` plus optional `waveforms` and `engineId` fields.
- [x] Enforce explicit numeric tolerances and cap waveform point counts before state insertion.
- [x] Run engine, mapper, and production-build tests.

### Task 5: Wire asynchronous simulation through application and WebMCP

**Files:**
- Modify: `src/state/store.ts`
- Modify: `src/state/store.test.ts`
- Modify: `src/webmcp/tools.ts`
- Modify: `src/webmcp/tools.test.ts`
- Modify: `src/webmcp/public-dto.ts`
- Modify: `src/features/top-bar.tsx`
- Modify: `src/features/left-panel.tsx`

**Interfaces:**
- Produces: `simulationStatus`, requested/executed engine IDs, supersession run identity, compatibility report, and asynchronous WebMCP simulation result.

- [ ] Write failing tests for pending/success/failure state, revision changes during a run, duplicate clicks, agent invocation, and unsupported-component messaging.
- [ ] Run store/WebMCP tests; expect synchronous behavior to fail new assertions.
- [ ] Add a run ID and superseded/draining state so stale results cannot overwrite a newer workspace; disable repeated or overlapping runs while work is pending or draining.
- [ ] Expose requested engine, executed engine, duration, warnings, and exact blockers in the UI and public DTO.
- [ ] Keep SPICE behind the registry capability gate until Task 7 promotion, and keep Bench disabled until the current revision has a non-failing deterministic result and every component is Bench-capable.
- [ ] Run store, WebMCP, and full tests.

### Task 6: Add operating-point and waveform presentation

**Files:**
- Create: `src/features/simulation-results.tsx`
- Create: `src/features/simulation-results.test.tsx`
- Create: `src/features/waveform-chart.tsx`
- Modify: `src/features/inspector-panel.tsx`
- Modify: `src/features/workbench.tsx`

**Interfaces:**
- Produces: engine badge, node/component readings, accessible data table, and SVG waveform chart.

- [ ] Write failing tests for deterministic summary, SPICE operating point, transient waveform, empty probes, and failure diagnostics.
- [ ] Implement a no-dependency SVG chart with labelled axes and a table alternative; do not use canvas-only output.
- [ ] Show exact engine and analysis type and preserve component selection interactions.
- [ ] Run focused tests and visual light/dark checks.

### Task 7: Prove parity and preserve the bench boundary

**Files:**
- Create: `src/simulation/simulation-parity.test.ts`
- Modify: `src/domain/bench.test.ts`
- Modify: `src/webmcp/tools.test.ts`
- Modify: `src/tscircuit/tscircuit-adapter.test.ts`

**Interfaces:**
- Proves: deterministic/SPICE agreement and private-fault non-disclosure.

- [ ] Compare source voltage, resistor current, LED state, divider midpoint, and RC final voltage within documented tolerances.
- [ ] Add negative tests proving SPICE payloads, Circuit JSON, DTOs, and waveforms contain no hidden fault identifiers.
- [ ] Run the original two-measurement repair journey on the deterministic engine and a separate public SPICE circuit without Bench.
- [ ] Require all parity/privacy tests before marking SPICE available in the registry.

### Task 8: Document and verify stage two

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture/system-design.md`
- Modify: `docs/architecture/security-and-safety.md`
- Modify: `docs/testing.md`

- [ ] Document engine selection, supported mappings, idealized switch values, tolerances, and model limitations.
- [ ] Run `pnpm test`, `pnpm typecheck`, and `pnpm build`.
- [ ] In Browser, run deterministic LED, voltage divider, RC transient, unsupported transistor, and revision-race scenarios.
- [ ] Repeat the complete WebMCP judging path and confirm Bench remains deterministic and private.
