# tsCircuit integration design

## Goal

Use tsCircuit as ProbePilot’s reusable component, property, interchange, simulation, PCB, and 3D foundation while preserving ProbePilot’s WebMCP collaboration model, deterministic challenge path, private bench, evidence gate, and human approval boundary.

## Product decisions

- ProbePilot remains the canonical editable project model.
- All tsCircuit packages sit behind `src/tscircuit/`; no feature imports them directly.
- The first release exposes a broad catalog with explicit Design, SPICE, and Bench capability labels.
- The deterministic simulator remains the authoritative engine for the original five-component demo.
- ngspice becomes a second engine for circuits whose complete component set has verified SPICE mappings.
- PCB and 3D are read-only derived views, not independent project states.
- Generic footprints and deterministic placement create an `Auto-layout preview`, never a fabrication claim.
- Active bench state, private faults, and measurements remain absent from Circuit JSON, PCB previews, 3D previews, persistence, and exports unless already public under the existing project contract.

## Pinned package baseline

Versions were resolved from npm on 2026-09-01 and must be installed exactly, without caret ranges.

### Component foundation

- `schematic-symbols@0.0.244`
- `@tscircuit/props@0.0.645`
- `circuit-json@0.0.480`
- `format-si-unit@0.0.14`

The actual npm symbol package is unscoped `schematic-symbols`; `@tscircuit/schematic-symbols` does not exist in the npm registry.

### SPICE

- `spicets@0.0.5`
- `circuit-json-to-spice@0.0.46`
- `@tscircuit/ngspice-spice-engine@0.0.21`

### PCB and 3D

- `circuit-to-svg@0.0.411`
- `@tscircuit/alphabet@0.0.26`
- `@tscircuit/circuit-json-util@0.0.111`
- `@tscircuit/core@0.0.1816`
- `@tscircuit/3d-viewer@0.0.597`
- `circuit-json-to-simple-3d@0.0.10`
- `@tscircuit/simple-3d-svg@0.0.41`

Implementation note (2026-09-03): `@tscircuit/3d-viewer` and `@tscircuit/core` were evaluated after the React 19 upgrade, but their browser bundle introduced an open-ended undeclared peer dependency chain in this application. They were removed rather than shipping a fragile or network-dependent viewer. The completed release lazy-loads the local `circuit-json-to-simple-3d` renderer directly, provides six angles and zoom, and uses only generated CAD bounding boxes. Full WebGL `CadViewer` remains a future enhancement, not a hidden fallback claim.

`@tscircuit/3d-viewer@0.0.597` requires React and React DOM 19.1.0. The third stage upgrades ProbePilot from React 18.3.1 to 19.1.0 only after the first two stages pass their complete gates.

## Initial component catalog

| Component | Design | SPICE | Bench | Default footprint |
|---|---:|---:|---:|---|
| DC source | yes | yes | yes | terminal block |
| Ground | yes | yes | yes | test point |
| Resistor | yes | yes | yes | 0805 |
| LED | yes | yes | yes | 0805 |
| SPST switch | yes | yes | yes | SW_THT |
| Battery | yes | yes | no | battery connector |
| Current source | yes | yes | no | test point pair |
| Capacitor | yes | yes | no | 0805 |
| Inductor | yes | yes | no | 0805 |
| Diode | yes | yes | no | SOD-123 |
| Zener diode | yes | yes | no | SOD-123 |
| Schottky diode | yes | yes | no | SOD-123 |
| Fuse | yes | yes | no | 1206 |
| Potentiometer | yes | yes | no | POT_THT |
| Push button | yes | yes | no | SW_THT |
| SPDT switch | yes | yes | no | SW_THT |
| NPN BJT | yes | no | no | TO-92 |
| PNP BJT | yes | no | no | TO-92 |
| N-channel MOSFET | yes | no | no | TO-220 |
| P-channel MOSFET | yes | no | no | TO-220 |
| Op-amp | yes | no | no | DIP-8 |

The SPICE column becomes true only after fixture tests prove the exact mapping. A missing model downgrades the component at runtime instead of running a partial simulation.

## Architecture

### Component registry

`ComponentDefinitionRegistry` replaces scattered switch statements. Each definition contains:

```ts
interface ComponentDefinition {
  readonly kind: ComponentKind;
  readonly name: string;
  readonly category: ComponentCategory;
  readonly prefix: string;
  readonly symbolName: string;
  readonly terminals: readonly TerminalDefinition[];
  readonly propertySchema: z.ZodType<ComponentProperties>;
  readonly defaultProperties: ComponentProperties;
  readonly defaultFootprint: string;
  readonly capabilities: ReadonlySet<ComponentCapability>;
}
```

Deterministic string sets use string enums. Runtime input reaches application logic only after a concrete Zod schema parses it.

### tsCircuit adapter

`TscircuitAdapter.toCircuitJson(design, physicalDesign?)` returns a derived `AnyCircuitElement[]` plus structured diagnostics. Stage one omits physical data; stage three supplies it. `TscircuitSymbolAdapter` converts tsCircuit symbol primitives and ports into themed React SVG without `dangerouslySetInnerHTML`.

### Simulation engines

```ts
interface SimulationEngine {
  readonly id: SimulationEngineId;
  canSimulate(design: CircuitDesign): SimulationCompatibility;
  simulate(design: CircuitDesign, request: SimulationRequest): Promise<SimulationResult>;
}
```

`DeterministicSimulationEngine` wraps the current synchronous solver. `TscircuitSpiceSimulationEngine` creates a complete SPICE netlist, runs ngspice, and maps results into the existing public result structure plus optional waveform series. `SimulationCoordinator` selects deterministic parity for the challenge fixture and SPICE only when every component mapping is verified.

### Physical preview

Project schema version 2 adds optional public physical metadata:

```ts
interface PhysicalDesign {
  readonly board: { widthMm: number; heightMm: number; thicknessMm: number };
  readonly placements: Readonly<Record<string, PhysicalPlacement>>;
  readonly placementMode: PhysicalPlacementMode;
}
```

Version-1 projects migrate by generating deterministic placements. Circuit, PCB Preview, and 3D Preview all derive from the same design revision. Physical metadata never affects electrical simulation.

### UI

- The palette gains search, categories, and capability badges.
- The inspector renders schema-backed property controls and footprint metadata.
- A secondary workspace switcher provides `Circuit`, `PCB Preview`, and `3D Preview`.
- PCB uses `circuit-to-svg` with no editing.
- 3D lazy-loads `circuit-json-to-simple-3d` with six angle presets, zoom, and an error boundary.
- Simulate explains the selected engine and lists exact unsupported components.
- Bench stays disabled unless every component in the active circuit is Bench-capable.

### WebMCP

Inspection returns component capability levels, selected simulation engine, compatibility diagnostics, footprints, and preview availability. Build/update schemas accept the expanded catalog and validated properties. Existing human-only exclusions remain unchanged. No WebMCP tool edits PCB or 3D state directly.

## Error handling

- Adapter failures return typed diagnostics and preserve the editable project.
- A missing symbol uses a labelled generic rectangle and reports a catalog error in development tests.
- A missing SPICE model blocks SPICE execution before the engine runs.
- ngspice load or execution failure leaves the deterministic challenge engine available and shows a retryable failure.
- Missing CAD assets use generic package geometry; external asset URLs do not load unless explicitly allowed by the resolver.
- A 3D module or render failure leaves Circuit and PCB views usable and shows an explicit local-preview error.
- Version-1 imports migrate without losing IDs, activities, or circuit revisions.

## Test strategy

- Snapshot every mapped symbol, terminal, property schema, and capability level.
- Round-trip all expanded project properties through persistence and JSON import/export.
- Compare deterministic and SPICE results for voltage-divider, RC, switched-LED, diode, and open-path fixtures within stated tolerances.
- Verify unsupported components prevent partial simulation.
- Prove hidden bench faults remain absent from Circuit JSON and all preview payloads.
- Snapshot PCB and simplified 3D output; run browser interaction tests for lazy view loading and switching.
- Run all existing 44 tests, new tests, TypeScript, production build, and the complete WebMCP demo after every stage.

## Non-goals

- Fabrication-ready PCB editing, routing, DRC sign-off, or manufacturing export;
- automatic SPICE models for arbitrary manufacturer parts;
- MCU firmware or digital logic simulation;
- bench fault models for every new catalog item;
- replacing ProbePilot projects with tsCircuit TSX source;
- exposing private bench faults through Circuit JSON or 3D.
