# Project status

Status date: 2026-09-03

ProbePilot Studio is the active project in this repository. The extension-based Capability Forge work is archived under `experiments/deprecated`.

## Release state

- Source implementation: complete
- Automated verification: 337 tests across 45 files
- TypeScript: passing
- Production build: passing
- Chrome verification: passing with no console errors or warnings
- GitHub repository: private at `https://github.com/jules-tnk/adaptive-webmcp`
- GitHub Actions: ProbePilot CI passing on `main`
- Firebase Hosting: deployed to site `probepilot-jules-tnk` in project `jules-tnk-space-web`
- Public domain: `https://probepilot.jules-tnk.com` returns the production build over HTTPS

## Implemented surface

- 21-component searchable catalog
- deterministic educational Bench workflow
- local ngspice WASM simulation
- PCB and local 3D previews
- local project CRUD, import, export, and 100-entry activity history
- light and dark themes
- nine bounded WebMCP tools
- private fault isolation and human measurement and repair gates

## Current limits

ProbePilot does not provide fabrication-ready routing, DRC, Gerber output, arbitrary manufacturer models, MCU simulation, or a full WebGL CAD viewer. BJT, MOSFET, and op-amp entries remain design-only until their SPICE models pass verification.
