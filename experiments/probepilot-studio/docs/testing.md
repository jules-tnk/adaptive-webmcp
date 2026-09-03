# Test strategy

## Verification gate

```bash
pnpm typecheck
pnpm test
pnpm build
```

The same commands run in GitHub Actions.

## Circuit validation tests

- complete demo validity;
- missing source;
- duplicate connection rejection;
- terminal integrity;
- current-limiting constraints.

## Component foundation tests

- exact installed dependency contracts for `schematic-symbols@0.0.244`, `@tscircuit/props@0.0.645`, and `circuit-json@0.0.480`;
- all 21 registry entries: kind, category, terminals, defaults, footprint, symbol, and capability matrix;
- all 50 terminal identities: exact normalized symbol coordinates and numeric Circuit JSON pin aliases;
- tsCircuit foundation import isolation plus warning-free production chunk sizes;
- accessible palette search, category filtering, count, and non-color capability labels;
- schema-backed property editing, SI-unit normalization, switch state, transistor/MOSFET metadata, and agent-lock preservation;
- round trip of every registered component and normalized version-1 property through project serialization;
- all-or-nothing Circuit JSON conversion, strict terminal aliases, diagnostics, unique IDs, and private-field stripping.

## Simulation tests

- switched LED output and current;
- expected terminal voltage after resistor;
- open-wire bench behavior;
- high-side and ground-side open-path voltage readings;
- short path rejection.

## Private bench tests

- hidden fault does not appear in public session serialization;
- measurements use the faulty bench model;
- wrong repair fails verification;
- matching repair passes verification.

## Store and command tests

- stale revision rejection;
- human-owned agent protection;
- atomic build history;
- human-only bench creation;
- human-only measurement completion;
- evidence gate before repair;
- agent cannot approve a repair;
- complete two-measurement repair journey.

## Project persistence tests

- newest-first 100-entry activity retention;
- repository create, read, rename, duplicate, and delete;
- newest-project ordering;
- import receives a new ID and cannot overwrite;
- duplicate import names receive an imported suffix;
- malformed and over-limit files fail without creating a project;
- export/import round trip;
- autosave success and storage-failure status;
- saved route hydration clears transient workspace and bench state.

## SPICE and physical preview tests

- fetch-independent local ngspice operating-point, DC, AC, and transient execution;
- deterministic/SPICE switched-LED parity and private-data serialization scans;
- strict vector coverage, complex AC subtraction, colon-safe IDs, and bounded 1,000-point grids;
- version-1 to version-2 migration and deterministic physical placement reconciliation;
- bounded physical import schemas plus persisted board and per-component placement edits;
- schema-valid PCB board, package, pad, port, trace, CAD bounding-box, and SVG output for all 21 catalog components;
- lazy six-angle simplified 3D rendering with zoom, error containment, and no external assets;
- accessible Circuit, PCB Preview, and 3D Preview switching.

The production build keeps both optional runtimes out of initial module preloads. The verified build produced a 118.98 kB raw (42.11 kB gzip) lazy 3D chunk and a 7.20 MB raw (2.46 MB gzip) lazy local-ngspice chunk.

## Launchpad tests

- project library empty state and management actions;
- valid and invalid JSON import feedback;
- product workflow, human-control, WebMCP, FAQ, and final actions;
- missing project route notice.

## WebMCP tests

- required semantic tools exist;
- forbidden human-only tools do not exist;
- public DTO does not contain private fault markers;
- a measurement request returns no reading and leaves `awaiting_human` state.
- build/update schemas cover the full registry and reject properties that do not belong to a component kind;
- design inspection returns footprints, capability levels, and conversion diagnostics without returning raw Circuit JSON elements.
- all nine runtime inputs reject undeclared properties in parity with their published schemas; removal bounds and `bench_verify` annotations match execution behavior.

## Manual challenge verification

Before recording the submission video:

1. open `/` and create the deterministic demo project;
2. add one catalog entry from Power, Passive, Semiconductor, Control, and Integrated Circuit; edit a property on each, reload, and inspect the persisted public values through `studio_inspect`;
3. export the project and import that JSON from the launchpad; confirm the import has a different local ID and retains only public project data;
4. confirm all nine tools register in the project page and that design inspection exposes capabilities and conversion diagnostics without raw Circuit JSON;
5. run the exact prompt from the README;
6. verify that the agent does not obtain a reading from `bench_request_measurement`;
7. complete two measurements in the UI;
8. confirm premature repair staging is rejected in a separate reset;
9. approve a correct repair and verify the LED and activity history;
10. inspect the launchpad in light and dark themes at desktop and mobile widths.
11. switch through Circuit, PCB Preview, and 3D Preview; edit and reset physical placement, then confirm the electrical revision does not change.

The complete gate remains `pnpm test`, `pnpm typecheck`, and `pnpm build`. Browser checks complement these tests; they do not replace the private-boundary or serialization assertions.
