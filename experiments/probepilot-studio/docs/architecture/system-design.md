# System design

## Architectural goal

Human UI events and WebMCP tool handlers must operate on the same domain commands and state. The application must not contain a hidden “agent implementation” that bypasses validation, revision protection, history, activity logging, or human-only controls.

## Layers

```text
React visual shell
       │
       ▼
Zustand vanilla store + shared commands
       │
       ├── ComponentDefinitionRegistry and typed properties
       ├── Circuit validation and deterministic DC simulation
       ├── Semantic history and activity provenance
       └── Public bench state

tsCircuit adapters
       ├── symbol primitives → themed SVG
       └── canonical design → validated Circuit JSON + diagnostics

WebMCP schemas and thin handlers
       │
       └── same Zustand commands

PrivateBenchEngine
       ├── immutable intended-design snapshot
       ├── hidden fault and applied repair state
       ├── measurement calculation
       └── output verification
```

## Circuit domain model

The business model is independent of the visual board:

- components have stable IDs, kinds, labels, positions, typed properties, terminal definitions, provenance, and a human-owned agent lock;
- wires connect two semantic terminal references;
- the design has a monotonically increasing revision;
- simulation results are associated with a specific revision.

The UI does not infer circuit meaning from pixel positions or DOM relationships.

## Component registry and tsCircuit boundary

`ComponentDefinitionRegistry` is the one source for the 21 catalog entries. A definition owns the kind, category, symbol name, terminals, property schema and fields, default footprint, and Design/SPICE/Bench capabilities. Palette, inspector, persistence, WebMCP schemas, and the adapter consume the registry instead of maintaining parallel component lists.

All direct tsCircuit foundation imports are isolated to `src/tscircuit/`. The registry consumes ProbePilot-owned symbol, property-parser, and unit-formatting APIs from that boundary. ProbePilot projects remain canonical. `TscircuitAdapter.toCircuitJson(design)` derives source components, ports, traces, schematic components, schematic ports, and schematic traces from a public design with stable IDs. It validates the complete element collection through `circuit-json`; any error diagnostic produces no elements rather than a partial interchange payload.

Circuit JSON is neither persisted project state nor a bench payload. It omits active benches, hidden faults, measurements, repairs, agent locks, and actor provenance. Public inspection exposes conversion diagnostics only, not a raw element array.

## Store model

A vanilla Zustand store is used because WebMCP handlers execute outside React. React components subscribe through selectors, while tools call `store.getState()`.

Store responsibilities:

- project and mode state;
- design mutation commands;
- revision conflicts;
- agent locks;
- grouped history;
- simulation invalidation;
- public bench lifecycle;
- evidence and repair gates;
- activity provenance.

## Revision protocol

Every semantic design mutation increments `design.revision`. Agent mutations include `expectedRevision`.

```text
Agent inspects revision 7
Human changes R1 → revision 8
Agent submits a revision-7 mutation
Application rejects REVISION_CONFLICT
Agent reinspects before retrying
```

This prevents a stale agent plan from overwriting a newer human decision.

## History

History stores semantic snapshots rather than pointer-motion events. A multi-component agent build is one undo entry. Node drag creates one entry on pointer release. Viewport, hover, selection, and animation are not history state.

## Workspace URL state

`WorkspaceUrlState` parses and serializes a bounded set of reloadable presentation state. React Router query parameters drive Design/Simulate mode, Circuit/PCB/3D view, Inspector/Activity selection, and the two panel rails. Store subscriptions update mode and view parameters when UI or WebMCP commands change them. Navigation tabs create browser-history entries, while panel expansion uses replacement navigation to avoid noisy Back/Forward history. Defaults and invalid combinations are canonicalized away.

## Simulation

The Stage-one deterministic solver supports a single low-voltage DC path with:

- one source;
- resistors;
- switches;
- LEDs;
- ground;
- wires;
- open-wire, open-component, resistor-value, and LED-orientation overrides.

The engine builds a terminal graph, finds a conductive source-to-return path, computes total resistance and LED drops, derives current, assigns terminal voltages, and produces observable LED states. An open-path model estimates high-side and ground-side test-point voltages for diagnostic measurements.

The deterministic solver is intentionally educational and does not claim production-grade electrical accuracy. A separate asynchronous coordinator selects bundled local ngspice WASM when the complete circuit has verified SPICE mappings. Operating-point, DC, AC, and transient results are normalized into one public result model. Engine attribution belongs to the coordinator, superseded results cannot enter state, and the large WASM runtime loads only after a SPICE request. A component's `Design` capability permits catalog and interchange behavior; it does not add electrical behavior.

## Private bench engine

The private engine owns a module-level map keyed by opaque bench session IDs. Its private record contains the hidden fault. Zustand receives only:

- source design snapshot;
- visible symptoms;
- pending request;
- measurements;
- hypotheses;
- staged repair;
- verification result.

The hidden record is not persisted, exported, attached to `window`, rendered into the DOM, or serialized by public DTOs.

## UI board

The board is a semantic DOM/SVG implementation:

- component cards are accessible HTML groups;
- terminals are real buttons;
- wires are SVG paths derived from terminal geometry;
- component IDs and terminal IDs remain stable;
- HTML drag/drop and click-to-add are supported;
- node movement commits only on pointer release;
- a zoomed fixed work surface avoids a large generic canvas dependency.

## Persistence

The local repository stores public version-2 project records in localStorage: project metadata, electrical design, physical preview metadata, revision, and the newest 100 public activities. Version-1 records receive deterministic physical placement during migration. Import always creates a fresh local ID. Active private bench sessions are intentionally not persisted, so reopening starts in Design mode.

`SimulationCoordinator` selects the deterministic engine or bundled local ngspice WASM, owns executed-engine attribution, and prevents stale results from entering state. Only fixture-tested mappings advertise SPICE support. `PhysicalPreviewAdapter` derives validated board, package, pad, port, trace, CAD bounding-box, and SVG elements from public design data. `CadViewerScene` lazy-loads `@tscircuit/3d-viewer`, forces its bundled JSCAD engine to avoid the optional Manifold CDN loader, and denies every static model URL. A local six-angle SVG renderer remains the error fallback. Physical edits never change electrical revision.

The viewer package imports `@tscircuit/core` at module load for an optional JSX-children conversion path. ProbePilot never uses that path because it supplies Circuit JSON directly, so Vite aliases that import to a narrow `Circuit` compatibility shim. This avoids bundling the core compiler and its undeclared peer chain while preserving the viewer’s Circuit JSON mode.
