# ProbePilot Studio implementation design

## Objective

Deliver a reliable desktop-first WebMCP application that demonstrates two distinct agent roles on one circuit artifact:

1. direct co-creation of the ideal design;
2. evidence-limited collaboration on the faulty bench.

## Required golden path

```text
Open project
→ agent inspects or builds circuit
→ validate and simulate
→ human creates bench
→ bench output differs
→ agent requests measurement
→ human completes measurement
→ repeat for second evidence item
→ agent publishes hypothesis
→ agent stages repair
→ human approves
→ verify bench matches design
```

## Functional requirements

### Design

- five component types;
- stable component and terminal IDs;
- click/drag component placement;
- node movement;
- semantic terminal wiring;
- property editing;
- agent-protection locks;
- deletion;
- grouped undo and redo;
- design revision.

### Simulation

- preflight validation;
- one low-voltage DC source;
- resistor current limiting;
- LED forward drop and visible state;
- switch state;
- terminal voltage calculation;
- warnings and errors;
- simulation revision tracking.

### Bench

- human-only creation;
- immutable source-design snapshot;
- private hidden fault;
- visible output mismatch;
- human-only meter operation;
- structured evidence history;
- agent hypotheses;
- evidence gate;
- staged repair review;
- human-only apply/reject;
- output verification.

### WebMCP

- top-level imperative registration;
- nine narrow tools;
- hand-authored JSON schemas plus Zod runtime validation;
- explicit public DTO;
- revision conflicts;
- visible activity provenance;
- no generic DOM or JavaScript tool.

## Quality requirements

- no account or external API;
- deterministic demo reset;
- private fault absent from public serialization;
- automated type, unit, integration, and production-build gate;
- desktop guard below 1024 pixels;
- semantic control labels;
- reduced-motion support;
- MIT license and complete documentation.

## Non-goals

- professional ECAD parity;
- PCB design;
- real hardware;
- SPICE accuracy;
- arbitrary imports;
- multiplayer;
- embedded chat;
- safety-critical guidance.
