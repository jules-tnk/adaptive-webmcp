# ProbePilot Studio implementation plan

## Risk-ordered sequence

### Milestone 1 — domain contract

- define typed components, terminals, wires, revisions, measurements, repairs, and activities;
- implement component catalog;
- write validation tests;
- establish public/private state split.

Exit: circuit state can be manipulated without React.

### Milestone 2 — simulation

- build terminal graph;
- validate source, ground, connections, and component ranges;
- find conductive path;
- calculate current, drops, and output state;
- model open-path diagnostic voltages;
- test deterministic demo.

Exit: intended LED is on; private open wire makes it off and yields expected measurements.

### Milestone 3 — shared store and commands

- create vanilla Zustand store;
- add revision checks;
- enforce human-owned locks;
- create grouped history;
- invalidate stale simulations;
- record activity provenance;
- test stale mutation and undo behavior.

Exit: human and agent can call the same commands safely.

### Milestone 4 — WebMCP handshake

- construct public DTO;
- register read-only inspection;
- register design build and simulation;
- prove top-level browser registration;
- ensure private state does not serialize.

Exit: agent can build and simulate without DOM automation.

### Milestone 5 — visual studio

- launchpad and direct demo route;
- semantic SVG/DOM board;
- palette, selection, wiring, drag, zoom;
- component inspector;
- simulation overlay;
- activity panel.

Exit: complete human design workflow.

### Milestone 6 — private bench

- create private engine and deterministic fault;
- freeze design snapshot;
- render mismatch;
- implement meter request and human completion;
- store evidence provenance.

Exit: agent request stops in awaiting-human state and produces no reading.

### Milestone 7 — repair protocol

- hypotheses;
- evidence gate;
- staged repair;
- human approval/rejection;
- wrong repair behavior;
- verification;
- final success state.

Exit: complete golden path passes integration tests.

### Milestone 8 — hardening and submission

- direct launch route;
- reset behavior;
- responsive desktop guard;
- accessibility labels;
- docs, license, review checklist;
- CI;
- repeated challenge-browser run;
- sub-three-minute video.

## Scope-cut order

Cut first:

1. project import/export;
2. continuity mode;
3. automatic layout;
4. multiple cases;
5. multi-selection alignment;
6. random faults;
7. light theme;
8. mobile editing.

Never cut:

- design/bench separation;
- private fault boundary;
- human-only measurement;
- evidence gate;
- human-only repair approval;
- verification;
- visible provenance.
