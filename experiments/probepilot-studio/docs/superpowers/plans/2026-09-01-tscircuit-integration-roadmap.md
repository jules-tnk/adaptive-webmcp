# tsCircuit Integration Roadmap

**Spec:** `docs/superpowers/specs/2026-09-01-tscircuit-integration-design.md`

The integration is split into three sequential plans because the component model, simulation runtime, and physical viewers have independent risk and verification boundaries.

1. [`2026-09-01-tscircuit-component-foundation.md`](2026-09-01-tscircuit-component-foundation.md) expands the catalog, replaces manual SVGs, adds capability labels, and produces validated Circuit JSON.
2. [`2026-09-01-tscircuit-spice-simulation.md`](2026-09-01-tscircuit-spice-simulation.md) introduces the engine interface, verified SPICE mappings, ngspice execution, and compatibility UI.
3. [`2026-09-01-tscircuit-pcb-3d-preview.md`](2026-09-01-tscircuit-pcb-3d-preview.md) adds physical metadata, PCB SVG, React 19 migration, interactive 3D, and SVG fallback.

Each plan must pass the complete suite, typecheck, build, Browser validation, and deterministic WebMCP judging path before the next begins. Repository instructions prohibit commits unless the user separately authorizes them.
