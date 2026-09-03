# WebMCP contract

## Design principle

Expose application semantics, not replicated clicks.

Strong operations:

- build a circuit from typed components and terminal references;
- inspect current revision and exact topology;
- run circuit validation and simulation;
- request a specific measurement for a stated diagnostic purpose;
- cite evidence in a hypothesis or repair proposal;
- verify intended versus actual output.

Excluded operations:

- click button;
- move pointer;
- execute JavaScript;
- read arbitrary DOM;
- reveal private fault;
- fabricate measurement;
- approve repair.

## Registration

Tools are registered imperatively from the top-level document through `document.modelContext.registerTool`. The application remains fully usable in a browser without this API.

## Tool table

### `studio_inspect`

Read-only. Returns a purpose-built public DTO for summary, design, simulation, or bench scope. Inspection includes registry-derived terminal labels, default footprints, Design/SPICE/Bench capability booleans, simulation attribution, and read-only physical-preview placement and diagnostics. It never returns raw Zustand state, Circuit JSON elements, viewer internals, or private bench state.

### `design_build_circuit`

Adds up to 20 components and 30 semantic connections atomically. Its generated schema covers all 21 registry kinds and their editable validated properties. Temporary keys allow components created in the same request to reference one another. The entire build is one undo checkpoint.

### `design_update_components`

Updates supported labels, properties, and positions. The first mutation checks the revision observed by the agent. Human-protected components are rejected.

### `design_remove_elements`

Removes components or wires. Removing a component removes attached wires. Wires touching human-protected components cannot be removed by the agent.

### `design_validate_and_simulate`

Runs validation against an expected design revision, then asynchronously executes the coordinator-selected deterministic or local ngspice engine. The final result records requested and executed engine IDs, analysis type, compatibility blockers, duration, readings, and waveforms in the same visual state seen by the user. Only verified component mappings can enter SPICE; only a passing deterministic result can unlock Bench.

### `bench_request_measurement`

Validates exact test-point IDs, stores a pending request, opens the virtual meter, and returns without a reading. A second request is rejected while the first waits for the human.

### `bench_update_hypotheses`

Publishes concise user-facing hypotheses. Targets and evidence IDs must exist. This is not a hidden chain-of-thought store.

### `bench_stage_repair`

Requires at least two completed human measurements and at least two valid cited evidence IDs. Creates a proposal but cannot apply it.

### `bench_verify`

Available after human approval. Compares observable bench outputs with the intended design.

## Human-only operations

These are deliberately omitted from WebMCP:

- create bench;
- select probes;
- take measurement;
- approve or reject repair;
- change agent-protection locks.

## Deliberate exclusions

WebMCP has no tool to return raw Circuit JSON, mutate PCB/3D metadata, fabricate a simulation result, load an external CAD asset, or bypass a Bench capability check. Circuit JSON conversion errors are exposed as typed public diagnostics through `studio_inspect`; malformed conversion never yields a partial element collection. Physical preview metadata is inspectable but human-editable only.

## Structured errors

Important failures include:

- `REVISION_CONFLICT` — design changed after inspection;
- `AGENT_LOCKED` — human-protected component or attached wire;
- `SIMULATION_REQUIRED` — bench cannot start from a stale or failing design;
- `MEASUREMENT_PENDING` — agent must wait for the human;
- `INSUFFICIENT_EVIDENCE` — repair staging is still locked;
- `HUMAN_ACTION_REQUIRED` — tool attempted a protected human operation.

## Provenance

Every meaningful action records `human`, `agent`, or `system`. Measurements are hard-coded as `requestedBy: agent` and `performedBy: human`; they are not accepted through an agent tool.
