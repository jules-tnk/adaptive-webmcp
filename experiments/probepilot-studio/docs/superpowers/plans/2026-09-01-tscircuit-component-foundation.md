# tsCircuit Component Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ProbePilot’s five hand-authored symbols and property definitions with a tsCircuit-backed, searchable 21-component catalog that emits validated Circuit JSON and advertises exact capabilities.

**Architecture:** ProbePilot remains canonical. A registry owns each component’s tsCircuit symbol, properties, terminals, default footprint, and Design/SPICE/Bench levels; adapters are the only files allowed to import tsCircuit packages.

**Tech Stack:** React 18.3.1, TypeScript 5.7, Zod 3, Zustand 5, `schematic-symbols@0.0.244`, `@tscircuit/props@0.0.645`, `circuit-json@0.0.480`, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-01-tscircuit-integration-design.md`

## Global Constraints

- Install exact package versions; do not use range prefixes.
- Keep ProbePilot projects canonical and preserve the original demo behavior.
- Use string enums for every new deterministic string set.
- Do not introduce `any` or `unknown` into application logic.
- Preserve the private bench boundary and existing WebMCP human-only exclusions.
- Do not commit without separate user authorization.

---

### Task 1: Pin the component dependencies

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `src/tscircuit/dependency-contract.test.ts`

**Interfaces:**
- Produces: importable `symbols`, `getSvg`, tsCircuit prop parsers, and Circuit JSON runtime schemas.

- [x] Add a failing test that imports `symbols.resistor`, validates `{ resistance: "10k" }` through `resistorProps`, and parses a minimal Circuit JSON source component.
- [x] Run `pnpm test -- src/tscircuit/dependency-contract.test.ts`; expect module-resolution failure.
- [x] Run `pnpm add --save-exact schematic-symbols@0.0.244 @tscircuit/props@0.0.645 circuit-json@0.0.480 format-si-unit@0.0.14`.
- [x] Re-run the focused test, `pnpm typecheck`, and `pnpm build`; require clean output.

### Task 2: Establish the registry and capability model

**Files:**
- Create: `src/components/component-capability.ts`
- Create: `src/components/component-definition.ts`
- Create: `src/components/component-definition-registry.ts`
- Create: `src/components/component-definition-registry.test.ts`
- Modify: `src/domain/types.ts`
- Refactor: `src/domain/catalog.ts`

**Interfaces:**
- Produces: `ComponentCapability`, `ComponentCategory`, expanded `ComponentKind`, `ComponentPropertiesByKind`, `ComponentDefinition`, and `ComponentDefinitionRegistry.get(kind)`.
- Consumes: tsCircuit Zod parsers and symbol names.

- [x] Write table-driven failing tests for all 21 rows in the spec capability matrix, including exact terminals, defaults, prefix, symbol, and footprint.
- [x] Run the focused test; expect missing registry exports.
- [x] Add string enums for capability, category, and kind; define concrete property interfaces for all catalog entries.
- [x] Implement one exported `ComponentDefinitionRegistry` class with static `get`, `list`, `byCategory`, and `supports` methods.
- [x] Replace catalog reads in `domain/catalog.ts` with registry delegation while keeping existing function signatures temporarily compatible.
- [x] Run registry, validation, simulation, store, and WebMCP tests.

### Task 3: Render tsCircuit symbols safely

**Files:**
- Create: `src/tscircuit/tscircuit-symbol-adapter.tsx`
- Create: `src/tscircuit/tscircuit-symbol-adapter.test.tsx`
- Refactor: `src/features/component-symbol.tsx`
- Modify: `src/features/board-geometry.ts`

**Interfaces:**
- Produces: `TscircuitSymbolAdapter.render(symbolName, options)` and normalized terminal coordinates.
- Consumes: `schematic-symbols` structured primitives; no raw HTML.

- [x] Write failing snapshots for resistor, capacitor, diode, NPN, MOSFET, op-amp, switch, and ground in light/dark and active/inactive states.
- [x] Run the focused test; expect the adapter module to be absent.
- [x] Convert path, text, circle, and box primitives into React SVG elements with theme-token colors.
- [x] Map symbol port coordinates to ProbePilot terminal button positions and assert every registry terminal resolves exactly once.
- [x] Replace the hand-written SVG branches in `ComponentSymbol` with the adapter.
- [x] Run symbol, board geometry, and complete existing tests.

### Task 4: Add the expanded property editor

**Files:**
- Create: `src/components/component-property-editor.tsx`
- Create: `src/components/component-property-editor.test.tsx`
- Create: `src/components/property-field-definition.ts`
- Modify: `src/features/inspector-panel.tsx`
- Modify: `src/domain/catalog.ts`
- Modify: `src/state/store.ts`

**Interfaces:**
- Produces: schema-backed editors for voltage, current, resistance, tolerance, capacitance, inductance, polarity, switch type/state, transistor type, MOSFET channel/mode, and footprint.

- [x] Write failing interaction tests for resistor units, polarized capacitor, SPDT state, transistor type, MOSFET channel, invalid numeric input, and agent lock preservation.
- [x] Run the focused test; expect missing editor.
- [x] Define explicit field metadata beside each registry definition; parse every update through its tsCircuit/Zod parser before store mutation.
- [x] Implement accessible number, select, and boolean controls with normalized SI-unit summaries.
- [x] Replace component-specific property branches in `InspectorPanel` with `ComponentPropertyEditor`.
- [x] Run inspector, store, import/export, and full tests.

### Task 5: Make the palette searchable and capability-aware

**Files:**
- Refactor: `src/features/component-palette.tsx`
- Create: `src/features/component-palette.test.tsx`
- Modify: `src/features/left-panel.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Produces: catalog search, category filters, component count, and Design/SPICE/Bench badges.

- [x] Write failing tests that search “zener”, filter Semiconductors, add a capacitor, and read the capability labels without relying on color.
- [x] Run the focused test; expect missing search/filter controls.
- [x] Render registry categories with a sticky search field and compact rows; lazy-render long groups.
- [x] Add a short capability legend and tooltips that explain why Bench can be unavailable.
- [x] Run palette tests and visually verify light/dark at desktop editor width.

### Task 6: Produce validated Circuit JSON

**Files:**
- Create: `src/tscircuit/tscircuit-adapter.ts`
- Create: `src/tscircuit/tscircuit-adapter.test.ts`
- Create: `src/tscircuit/tscircuit-diagnostics.ts`

**Interfaces:**
- Produces: `TscircuitAdapter.toCircuitJson(design, physicalDesign?): TscircuitConversionResult` containing `elements` and typed diagnostics; stage one omits the optional physical argument.

- [x] Write failing fixtures for the switched LED, RC network, diode, SPDT, transistor, and an invalid terminal reference.
- [x] Run the focused test; expect missing adapter.
- [x] Emit source components, source ports, source traces, schematic components, schematic ports, and schematic traces with stable IDs derived from ProbePilot IDs.
- [x] Validate the returned array with Circuit JSON schemas; never return partially converted output when an error diagnostic exists.
- [x] Assert private fault strings and bench IDs never appear in serialized elements.
- [x] Run adapter, bench privacy, and public DTO tests.

### Task 7: Expand persistence and WebMCP contracts

**Files:**
- Modify: `src/projects/project-codec.ts`
- Modify: `src/projects/project-repository.test.ts`
- Modify: `src/webmcp/tools.ts`
- Modify: `src/webmcp/tools.test.ts`
- Modify: `src/webmcp/public-dto.ts`
- Modify: `src/domain/fixtures.ts`

**Interfaces:**
- Produces: expanded version-1 component properties and capability-rich inspection/build/update schemas; stage three owns the version-2 physical migration.

- [x] Add failing round-trip tests for every component kind and migration tests for existing version-1 project files.
- [x] Add failing WebMCP tests that build an RC circuit, reject invalid properties, and inspect capability levels.
- [x] Extend the codec with explicit discriminated schemas and migrate version 1 without changing IDs or revisions.
- [x] Generate tool enums and property schemas from the registry, then expose capabilities and conversion diagnostics in the public DTO.
- [x] Keep the original five-component WebMCP fixture byte-for-byte behaviorally compatible.
- [x] Run repository, WebMCP, full tests, typecheck, and build.

### Task 8: Document and verify stage one

**Files:**
- Modify: `README.md`
- Modify: `docs/product/experience-spec.md`
- Modify: `docs/architecture/system-design.md`
- Modify: `docs/architecture/webmcp-contract.md`
- Modify: `docs/testing.md`

**Interfaces:**
- Documents: package provenance, capability meanings, catalog coverage, Circuit JSON boundary, and unsupported behavior.

- [x] Document exact package versions and MIT attribution.
- [x] Document the 21-component matrix and the rule that Design does not imply simulation.
- [x] Run `pnpm test`, `pnpm typecheck`, and `pnpm build`.
- [x] In Browser, add one component from each category, edit its properties, reload it, export/import it, and inspect it through WebMCP.
- [x] Repeat the original deterministic judging flow and confirm no privacy or behavior regression.
