# Security and safety

## Threat model

The challenge prototype must prevent accidental leakage or bypass of the product’s central control boundary. It is not designed to resist a malicious user with local source-code and browser-debugger access.

## Hidden-fault isolation

The hidden bench fault is stored only in a private module-level engine. It is absent from:

- Zustand;
- public bench objects;
- React props;
- DOM attributes;
- localStorage;
- project exports;
- tool schemas;
- `studio_inspect` output;
- activity events.

Automated tests serialize public state and assert that private fault markers are absent.

SPICE netlists, waveforms, PCB Circuit JSON, PCB SVG, and 3D scenes derive only from public electrical and physical project fields. They never receive private bench engine state, hidden fault overrides, pending measurements, or repair internals. Physical previews use local generic geometry and do not load external CAD asset URLs.

## Action separation

The application, not the prompt, enforces:

- only a human can create the bench;
- only a human can complete a measurement;
- only a human can approve or reject a repair;
- only a human can change agent-protection locks;
- only an agent can publish diagnostic hypotheses and stage repair proposals;
- the agent must wait while a measurement is pending.

## Stale-state protection

Agent design mutations carry `expectedRevision`. A mismatch is rejected before any mutation occurs.

## Input validation

WebMCP inputs are parsed through Zod and constrained by hand-authored JSON Schema:

- enums for component and action types;
- bounded arrays;
- length-limited explanations;
- exact test-point and target validation;
- no arbitrary code, HTML, selector, URL, or file input.

## UI text

Agent-provided purpose, explanation, and expected-outcome text is rendered as React text content. It is never interpreted as HTML.

## Electrical safety scope

ProbePilot is a simulated educational environment limited to nominal sources up to 24 V. It does not provide instructions for live hardware, mains voltage, industrial equipment, medical devices, vehicles, or safety-critical systems.

The interface and README explicitly avoid professional diagnosis or certification claims.
