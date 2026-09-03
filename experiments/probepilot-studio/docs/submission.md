# ProbePilot Studio submission

## Project name

ProbePilot Studio

## Tagline

Design the ideal circuit. Diagnose the imperfect one with WebMCP.

## Public links

- Live application: https://probepilot.jules-tnk.com
- Demo video: https://youtu.be/k9X7zKR62BA
- Source code: https://github.com/jules-tnk/adaptive-webmcp

## What it does

ProbePilot Studio is a browser-native circuit workspace where a person and an agent share one live design, simulation, and diagnostic bench.

The agent can inspect exact circuit state, add or update components, create semantic terminal-to-terminal connections, validate the design, and run deterministic or local SPICE simulations. The same project renders as an interactive circuit, a PCB preview, and a 3D assembly preview.

Diagnosis changes the control model. The person creates a faulty virtual bench. The agent can request measurements between exact test points, but ProbePilot stops until the person operates the virtual meter. Each reading becomes evidence with a stable ID. After two readings, the agent can publish evidence-linked hypotheses and stage a repair. Only the person can approve and apply that repair. The agent can then verify the repaired bench against the intended design.

ProbePilot keeps the hidden fault outside the DOM, Zustand state, local project files, JSON exports, Circuit JSON, and every WebMCP response. The agent must diagnose from observations instead of reading the answer.

## Why WebMCP fits

A circuit editor exposes structured concepts that coordinate-based browser automation handles poorly: components, terminals, wires, revisions, test points, measurement modes, evidence, and repair targets. ProbePilot registers nine narrow WebMCP tools that operate on those concepts directly.

The agent does not need to infer a resistor from pixels or guess which terminal a click represents. Tool schemas describe supported component kinds, strict inputs, revision requirements, and human-owned boundaries. The browser UI and agent use the same command layer, so each action updates the circuit, inspector, activity history, and project persistence together.

## Better human-agent experience

The agent handles repetitive construction, validation, simulation, and diagnostic reasoning. The person supplies the evidence that a software agent should not invent and controls the consequential repair decision.

Before this workflow, a browser agent could click through a circuit interface, but it could not establish whether a reading came from a person, whether a repair cited that reading, or whether a hidden fault leaked through page state. ProbePilot enforces those distinctions in application code:

- WebMCP can request a measurement but cannot take one.
- The agent cannot create the bench or reveal its private fault.
- Hypotheses cite completed human measurements.
- A repair needs at least two measurements.
- The agent stages a repair; the person applies it.
- Verification compares the repaired bench with the frozen intended design.

## WebMCP implementation

ProbePilot registers these tools through `document.modelContext.registerTool(...)`:

1. `studio_inspect`
2. `design_build_circuit`
3. `design_update_components`
4. `design_remove_elements`
5. `design_validate_and_simulate`
6. `bench_request_measurement`
7. `bench_update_hypotheses`
8. `bench_stage_repair`
9. `bench_verify`

Zod validates each tool input. Mutation tools enforce expected revisions, component support, agent locks, and bench lifecycle rules. The public inspection DTO includes only the information the agent should see. A private bench engine owns the implementation fault and computes measurements and verification results without serializing the fault into public state.

## Built with

React 19, TypeScript, Vite, Zustand, Zod, WebMCP, Vitest, Tailwind CSS, Radix UI, tsCircuit, Circuit JSON, ngspice WASM, `@tscircuit/3d-viewer`, Firebase Hosting, and GitHub Actions.

## Challenges

The hardest problem was preserving a useful shared workspace without turning the agent into an unrestricted UI robot. ProbePilot needed one command model for the UI and WebMCP, strict stale-revision handling, and a private bench state that could produce measurements without leaking the answer.

The 3D viewer also needed a compatibility boundary. ProbePilot converts its project model into Circuit JSON, lazy-loads `@tscircuit/3d-viewer`, keeps the camera stationary until the person moves it, and falls back to a six-angle SVG preview when WebGL fails.

## Accomplishments

- Nine working WebMCP tools with strict schemas and revision checks.
- A complete design, simulation, diagnosis, repair, and verification journey.
- Human-only measurement and repair approval enforced below the UI.
- A hidden deterministic fault excluded from every agent-visible surface.
- Twenty-one catalog components with honest Design, SPICE, and Bench capability labels.
- Local ngspice WASM plus circuit, PCB, and interactive 3D views.
- Local project CRUD, JSON import and export, URL-restored workspace state, and a 100-entry activity history.
- Automated tests covering the domain, UI, persistence, WebMCP contract, and viewer adapters.

## What I learned

WebMCP works best when a site exposes domain decisions instead of mirroring every button. The useful boundary was not “agent versus human UI.” It was authority: which facts the agent may inspect, which evidence only a person can produce, and which actions require human approval.

Circuit JSON and tsCircuit provided a practical rendering and interoperability layer, but simulation support still needed explicit verification. ProbePilot labels each catalog item by capability rather than implying that every rendered component has a trusted behavioral model.

## What's next

The next step is to add reusable diagnostic cases, richer SPICE models, and a portable evidence bundle that can be reviewed outside the browser. A future hardware bridge could let a person collect readings from a physical instrument while keeping the same WebMCP request, evidence, approval, and verification contract.

## Testing instructions

1. Open https://probepilot.jules-tnk.com in ChatGPT's in-app browser or Chrome with WebMCP enabled.
2. Choose **Open deterministic demo**.
3. Ask the agent: “Inspect this ProbePilot project. Verify the intended circuit, then help me diagnose the virtual bench without guessing. Request the measurements you need, cite the measurement IDs in your hypotheses, and stage but do not apply the repair.”
4. Start **Bench** after simulation passes.
5. When the agent requests a measurement, choose the shown test points and press **Take measurement**.
6. Complete the second requested measurement.
7. Review the agent's evidence-linked repair, approve it, and ask the agent to verify the bench.

No account, credentials, extension, or paid service is required.

## License and third-party work

ProbePilot Studio is available under the MIT License. The repository includes license and attribution details for the tsCircuit packages used by the application. The submission video uses original application footage, generated narration, and no copyrighted music.
