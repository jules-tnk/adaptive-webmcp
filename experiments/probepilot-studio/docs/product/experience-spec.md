# Experience specification

## Routes

| Route | Purpose |
|---|---|
| `/` | Product explanation, local project library, FAQ, demo template, and blank-project entry points. |
| `/studio/:projectId` | Saved project workspace for Design, Simulate, and Bench modes. |

Unknown project IDs return to the launchpad with an explanatory message. Opening the deterministic demo creates a normal editable project copy with a new ID.

The studio uses canonical query parameters for reloadable UI state: `mode=simulate`, `view=pcb|3d`, `panel=activity`, and `left=collapsed` or `right=collapsed`. Design, Circuit, Inspector, and expanded panels are defaults and are omitted. Simulation always resolves to the Circuit view. Invalid values and non-persistent `mode=bench` requests are removed. Selection, zoom, dialogs, undo history, simulation results, and private Bench state remain ephemeral.

## Local project library

The launchpad lists projects by most recent update. Each row shows component, wire, and activity counts and supports open, rename, duplicate, export, and confirmed deletion. Import accepts validated ProbePilot JSON and always creates a new ID.

ProbePilot stores the project name, design, versioned physical-preview metadata, revision, and newest 100 public activity entries. Version-1 files receive deterministic physical placement during migration. It does not store simulations, active bench sessions, hidden faults, selection, zoom, or undo history. Reopening a project starts in Design mode.

## Main layout

Desktop-first full-height application:

```text
Top bar: project, revision, Design / Simulate / Bench, undo, reset, WebMCP status
Left: component palette, simulation summary, or bench case summary
Center: semantic circuit board
Right: Inspector / Activity tabs
Bottom: design collaboration hint, simulation metrics, or virtual multimeter
Status: tool readiness, counts, revision, hidden-state boundary
```

The center workspace also provides `Circuit`, `PCB Preview`, and `3D Preview`. PCB and 3D derive from the same revision, use local generic physical packages, and do not expose the private bench fault. The 3D tab lazy-loads `CadViewer` for mouse pan, zoom, rotation, camera presets, layer controls, and GLTF export. Automatic rotation is disabled, so the camera stays stationary until the user manipulates it or selects a preset. A local six-angle SVG renderer appears if the WebGL path fails. The physical inspector edits board dimensions, footprint, X/Y placement, rotation, and board side without incrementing the electrical revision. Reset restores deterministic auto-layout.

The Components and Inspector/Activity side panels collapse independently into narrow labelled rails. Their state is reflected in the URL so reload preserves the available center-workspace width. While CadViewer prepares its controller and geometry, an accessible centered spinner covers the otherwise empty dark canvas.

## Design mode

The human can add, drag, connect, edit, protect, delete, undo, and redo components. The agent uses the same command layer through WebMCP.

## Catalog and capabilities

The searchable palette contains 21 registry-backed components. Every entry has a typed property schema, stable terminals, a default footprint, and three explicit capability labels:

- **Design** — ProbePilot can render, add, edit, persist, export, and derive Circuit JSON for the component.
- **SPICE** — ProbePilot has a verified local ngspice mapping for the component.
- **Bench** — the component is eligible for the guided deterministic bench workflow. Bench creation requires every placed component to have this capability.

Design does **not** imply simulation. The deterministic solver remains the original educational DC path and the guided Bench requires it. Verified analog components can instead use local ngspice; BJT, MOSFET, and op-amp entries remain editable and exportable without a verified model.

| Category | Component | Design | SPICE | Bench | Default footprint |
|---|---|---:|---:|---:|---|
| Power | DC source | yes | yes | yes | terminal block |
| Power | Ground | yes | yes | yes | test point |
| Power | Battery | yes | yes | no | battery connector |
| Power | Current source | yes | yes | no | test point pair |
| Passive | Resistor | yes | yes | yes | 0805 |
| Passive | Capacitor | yes | yes | no | 0805 |
| Passive | Inductor | yes | yes | no | 0805 |
| Passive | Fuse | yes | yes | no | 1206 |
| Passive | Potentiometer | yes | yes | no | POT_THT |
| Semiconductor | LED | yes | yes | yes | 0805 |
| Semiconductor | Diode | yes | yes | no | SOD-123 |
| Semiconductor | Zener diode | yes | yes | no | SOD-123 |
| Semiconductor | Schottky diode | yes | yes | no | SOD-123 |
| Semiconductor | NPN BJT | yes | no | no | TO-92 |
| Semiconductor | PNP BJT | yes | no | no | TO-92 |
| Semiconductor | N-channel MOSFET | yes | no | no | TO-220 |
| Semiconductor | P-channel MOSFET | yes | no | no | TO-220 |
| Control | SPST switch | yes | yes | yes | SW_THT |
| Control | Push button | yes | yes | no | SW_THT |
| Control | SPDT switch | yes | yes | no | SW_THT |
| Integrated Circuit | Op-amp | yes | no | no | DIP-8 |

Clicking one terminal starts a wire. Clicking a second terminal completes it. The application rejects invalid, self, or duplicate connections.

## Simulation mode

Validation runs before either engine. The interface displays:

- pass, warning, or fail;
- requested and executed engine IDs, analysis, and duration;
- node voltages, component voltage/current/state, and waveform tables;
- exact compatibility blockers and diagnostics;
- active LED state;
- visible current animation;
- actionable validation issues.

Any design edit invalidates the previous simulation revision.

Unsupported circuit behavior is blocked rather than silently approximated. Verified SPICE circuits can run operating-point, DC sweep, AC sweep, and transient analyses. BJT, MOSFET, and op-amp components remain design-only. PCB and 3D are read-only previews and do not provide routing, DRC, fabrication output, or electrical simulation by appearance.

## Bench creation

Creating the bench is human-only. It requires a non-failing simulation of the current design revision. The design is frozen into an immutable snapshot and a private bench engine creates a compatible hidden implementation fault.

The deterministic challenge case uses an internally open wire between `R1.b` and `LED1.anode`.

## Bench mode

The board keeps the design layout but becomes read-only. It shows the intended output and visible bench symptom, never the hidden cause.

The agent can request a voltage or continuity measurement between exact test-point IDs. The application opens the meter and highlights the requested points. The human may follow the request or select different points; the stored evidence records what was actually measured.

## Evidence gate

A repair proposal is rejected until:

- at least two measurements exist;
- each cited evidence ID exists;
- every measurement was requested by the agent and performed by the human;
- the repair target exists;
- the repair action is supported.

The gate does not guarantee that a diagnosis is correct. An evidence-backed wrong repair can be approved and fail verification.

## Repair review

The agent stages a proposal with:

- target;
- action;
- evidence IDs;
- expected outcome.

The human sees the proposal in a modal and may reject it or approve and apply it. No agent tool can apply the repair.

## Verification

After human approval, the agent or human invokes verification. ProbePilot compares observable bench outputs against the intended design. A wrong repair preserves the unresolved symptom and allows diagnosis to continue. A correct repair makes the LED illuminate and marks the bench as matching the design.

## Accessibility

- semantic component and terminal labels;
- keyboard-focusable board and controls;
- non-color state labels;
- native property inputs and test-point selects;
- reduced-motion support;
- accessible expanded/collapsed state on both workspace side-panel controls;
- a polite loading status for the delayed 3D renderer;
- desktop size guard rather than a broken mobile editor.
