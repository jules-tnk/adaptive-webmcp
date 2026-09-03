# ProbePilot Studio

ProbePilot Studio is a WebMCP circuit workspace for designing an intended low-voltage circuit and diagnosing a faulty virtual bench with a browser agent.

The agent can build, edit, inspect, and simulate the circuit. You create the bench, take measurements, and approve repairs. ProbePilot keeps the bench fault outside the public page state, project files, and WebMCP responses.

The hosted application lives at [probepilot.jules-tnk.com](https://probepilot.jules-tnk.com).

Watch the [two-minute WebMCP demo on YouTube](https://youtu.be/k9X7zKR62BA) or read the [challenge submission brief](experiments/probepilot-studio/docs/submission.md).

## Current application

Source: [`experiments/probepilot-studio`](experiments/probepilot-studio)

```powershell
cd experiments\probepilot-studio
pnpm install
pnpm dev
```

Run the release checks with:

```powershell
pnpm test
pnpm typecheck
pnpm build
```

ProbePilot includes:

- 21 registry-backed circuit components with explicit Design, SPICE, and Bench support;
- local ngspice WASM for verified operating-point, DC, AC, and transient simulations;
- Circuit, PCB Preview, and six-angle 3D Preview workspace views;
- local project history with create, open, rename, duplicate, delete, import, and export;
- nine WebMCP tools with revision checks, agent locks, evidence gates, and human-only repair approval.

Read the [application documentation](experiments/probepilot-studio/docs/README.md) for the product model, architecture, safety boundary, test strategy, and demo flow.

## Repository history

The earlier WebMCP Capability Forge extension remains under [`experiments/deprecated`](experiments/deprecated) as reference material. ProbePilot Studio is the active hackathon project.

## License

MIT. See [`LICENSE`](LICENSE).
