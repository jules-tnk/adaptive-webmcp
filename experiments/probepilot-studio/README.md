# ProbePilot Studio

ProbePilot Studio is a WebMCP-native circuit workspace for designing an ideal low-voltage circuit and diagnosing the imperfect version that gets built on a virtual bench.

The agent can create, edit, validate, and simulate the intended circuit. Once the human creates a bench, the control model changes: the agent can request measurements, inspect human-produced evidence, publish hypotheses, and stage a repair. It cannot take the measurement, reveal the hidden fault, create the bench, or apply the repair.

> The agent plans and reasons. The human senses and authorizes. The application enforces the boundary.

## WebMCP Challenge submission

- Live app: [probepilot.jules-tnk.com](https://probepilot.jules-tnk.com)
- Public demo: [ProbePilot Studio: Human-in-the-Loop Circuit Diagnosis with WebMCP](https://youtu.be/k9X7zKR62BA)
- Submission brief: [`docs/submission.md`](docs/submission.md)
- Source repository: [`jules-tnk/adaptive-webmcp`](https://github.com/jules-tnk/adaptive-webmcp)

## Product journey

```text
Design → Simulate → Build on bench → Measure → Diagnose → Stage repair → Human approves → Verify
```

The deterministic demo uses a 9 V switched LED circuit. The intended design passes. The virtual bench contains an internal open-wire fault between the resistor and LED. That fault exists only inside a private bench engine and is excluded from Zustand, the DOM, persistence, project exports, and every WebMCP response.

## Stack

- React 19.1 and TypeScript
- Vite and pnpm
- Zustand vanilla store with React bindings
- shadcn/ui-style Radix primitives
- Tailwind CSS
- Zod input validation
- Vitest

The board is a purpose-built semantic SVG/DOM editor. The reasoning is documented in [`docs/architecture/board-decision.md`](docs/architecture/board-decision.md).

The same project now drives three workspace views: the interactive circuit canvas, a tsCircuit PCB SVG preview, and an interactive WebGL assembly preview powered by `@tscircuit/3d-viewer`. The 3D camera starts stationary and moves only in response to manual camera controls or a selected preset. PCB and 3D use deterministic generic footprints and are labelled as non-fabrication previews. If WebGL or the viewer module fails, ProbePilot falls back to its local six-angle SVG renderer.

Compatible analog designs run locally through bundled ngspice WASM. Verified mappings cover sources, passive components, diode families, LEDs, and switch variants. BJT, MOSFET, and op-amp symbols remain design-only until verified models are available. The guided Bench still requires the deterministic engine.

## tsCircuit foundation

ProbePilot remains the canonical project model. The tsCircuit boundary supplies the registry-backed catalog, Circuit JSON, local SPICE execution, PCB SVG, and interactive 3D output without replacing projects with tsCircuit source files.

Core direct dependencies are installed without version ranges:

- `schematic-symbols@0.0.244` — symbol primitives and ports;
- `@tscircuit/props@0.0.645` — property parsers;
- `circuit-json@0.0.480` — Circuit JSON runtime schemas;
- `format-si-unit@0.0.14` — SI-value parsing and display normalization.
- `@o.z/ngspice-wasm@0.0.0` and `@tscircuit/ngspice-spice-engine@0.0.21` — fetch-independent local simulation;
- `circuit-to-svg@0.0.411` — read-only PCB rendering;
- `@tscircuit/3d-viewer@0.0.597`, `@tscircuit/core@0.0.1830`, and `three@0.165.0` — lazy interactive WebGL rendering;
- `circuit-json-to-simple-3d@0.0.10` and `@tscircuit/simple-3d-svg@0.0.41` — lazy six-angle failure fallback.

The project is licensed under the [MIT License](LICENSE), copyright 2026 ProbePilot contributors. The installed `schematic-symbols`, `@tscircuit/props`, and `format-si-unit` distributions include MIT license notices from tscircuit; `circuit-json` declares `ISC` in its installed package metadata. Preserve those upstream notices when redistributing their code.

The catalog has 21 components across Power, Passive, Semiconductor, Control, and Integrated Circuit categories. The full capability matrix is in [`docs/product/experience-spec.md`](docs/product/experience-spec.md#catalog-and-capabilities).

`Design` means the registry can render, add, edit, persist, export, and convert that component. It does **not** by itself imply simulation. A `SPICE` label means the mapping passed the local ngspice fixtures. `Bench` remains a narrower capability and requires the original deterministic engine for every placed component.

## Run locally

```bash
pnpm install
pnpm dev
```

Open the displayed local URL, then choose **Open deterministic demo**. ProbePilot creates an editable project copy and opens `/studio/:projectId`.

Workspace navigation is encoded in canonical query parameters. For example, `?view=3d&panel=activity&left=collapsed` restores the 3D view, Activity tab, and collapsed Components rail after reload. Defaults stay out of the URL. A project URL still requires that project ID to exist in the same browser’s local project library.

## Local projects and JSON files

The launchpad lists every project saved in the current browser. You can create, open, rename, duplicate, export, import, and delete projects. The studio saves edits automatically and reports the local save state in its toolbar.

Each version-2 project file contains project metadata, circuit design, physical-preview metadata, revision, and the newest 100 public activity entries. Version-1 files migrate automatically. ProbePilot excludes simulations, undo history, selections, active bench sessions, and hidden faults. Importing a file always creates a new local ID, so it cannot overwrite an existing project.

## Verify

```bash
pnpm typecheck
pnpm test
pnpm build
```

GitHub Actions runs the same gate for every push and pull request.

## Suggested WebMCP demo prompt

```text
Inspect this ProbePilot project. Verify the intended circuit, then help me diagnose the virtual bench without guessing. Request the measurements you need, cite the measurement IDs in your hypotheses, and stage—but do not apply—the repair.
```

For an empty project:

```text
Build and simulate a 9 V switched red LED circuit with a 330-ohm resistor. Then help me diagnose the virtual bench without guessing: request the measurements you need, cite the evidence, and stage—but do not apply—the repair.
```

## WebMCP tools

| Tool | Responsibility |
|---|---|
| `studio_inspect` | Inspect exact public design, simulation, and bench state without revealing the private fault. |
| `design_build_circuit` | Atomically add supported components and semantic terminal connections. |
| `design_update_components` | Update labels, values, or positions with revision and protection checks. |
| `design_remove_elements` | Remove design elements while respecting human-owned agent locks. |
| `design_validate_and_simulate` | Validate and run the selected deterministic or local SPICE engine. |
| `bench_request_measurement` | Ask the human to operate the virtual meter at exact test points. |
| `bench_update_hypotheses` | Publish evidence-linked diagnostic hypotheses into the shared UI. |
| `bench_stage_repair` | Stage an evidence-backed repair for human review. |
| `bench_verify` | Compare the repaired bench against the intended design. |

Intentionally absent:

- `reveal_fault`
- `take_measurement`
- `start_bench`
- `apply_repair`
- arbitrary JavaScript or DOM actuation

## Deterministic Bench surface

- one DC voltage source;
- resistors;
- LEDs;
- switches;
- ground;
- semantic wires;
- DC voltage and continuity measurements;
- open-wire, open-component, wrong-value, and reversed-LED bench models.

The challenge demo deliberately exercises one complete, reliable vertical slice rather than pretending to be a professional ECAD platform.

The separate SPICE engine supports operating-point, DC sweep, AC sweep, and transient requests for the verified sources, passives, diode families, LEDs, and switches listed in the capability matrix. BJT, MOSFET, and op-amp entries remain design-only. PCB and 3D remain generic previews rather than routing, DRC, Gerber, or manufacturing tools.

Circuit JSON is a derived, validated interchange view of the public design. It contains no active bench session, hidden fault, measurement, repair, agent-lock, or actor-provenance data. Conversion diagnostics are public; partial Circuit JSON is not returned when conversion has an error.

## Repository map

```text
src/domain       circuit, simulation, and private bench logic
src/state        revision-aware shared command/store layer
src/webmcp       schemas, public DTOs, and tool registration
src/features     visual studio, board, inspector, meter, and activity UI
src/projects     local repository, validation, autosave, JSON, and project library
src/activity     shared 100-entry activity retention policy
docs/product     product thesis, user experience, challenge positioning
docs/architecture system, board, WebMCP, and safety decisions
docs/research    ecosystem and concept evaluation that led to ProbePilot
```

## Documentation

Start with [`docs/README.md`](docs/README.md). The repository contains the complete product thesis, white-space research, evaluated concepts, architecture, WebMCP contract, security boundary, implementation plan, judging demo, review checklist, test strategy, and known limitations.

## Safety

ProbePilot is an educational low-voltage simulation. It is not professional electrical advice, field-repair guidance, or a safety certification tool.

## License

MIT.
