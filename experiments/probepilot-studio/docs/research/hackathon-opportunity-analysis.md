# WebMCP Challenge opportunity analysis

This document preserves the research and concept evaluation that led to ProbePilot Studio.

## Challenge interpretation

The WebMCP Challenge rewards products that become meaningfully better when a person and an agent share a live website. The official rubric gives equal nominal weight to:

- WebMCP leverage;
- execution;
- potential impact;
- creativity and ambition.

WebMCP leverage is the first tie-break criterion. The practical implication is that WebMCP cannot be a thin automation layer around a normal SaaS application.

A strong WebMCP-native product combines:

```text
semantic access to live application state
+ bounded domain actions
+ visible UI consequences
+ meaningful human control
```

Current challenge constraints also favor a deterministic, freely accessible application with a concise public demo, public source code under an open-source license, no required authentication, and a journey that judges can understand from a sub-three-minute video.

Primary challenge sources:

- https://openai.com/webmcp-challenge/
- https://webmcp.devpost.com/
- https://webmcp.devpost.com/rules
- https://developers.openai.com/codex/webmcp
- https://webmachinelearning.github.io/webmcp/

## What WebMCP is especially good at

1. **A shared live artifact.** The agent acts on the page’s current object rather than generating disconnected output in chat.
2. **Semantic operations.** Tools expose `request_measurement` or `validate_layout`, not `click_button` or `set_input`.
3. **Transient browser state.** The agent can work with the user’s unsaved selection, viewport, annotations, locks, simulation, or local draft.
4. **Mixed initiative.** Control can alternate among agent, user, and application state machine.
5. **Visible verification.** A graph, schematic, timeline, map, canvas, or instrument lets the human judge the result.
6. **Bounded authority.** The page can make some operations tool-accessible while retaining human-only approvals.

## Existing application patterns

Official showcase applications established several recurring patterns:

| Application | Pattern |
|---|---|
| Cubecade | Agent reads complete structured puzzle state and submits semantic moves; human sees the spatial result. |
| WanderNote | Agent and human co-edit a live itinerary while preserving manual changes. |
| Paperie | Agent creates content directly on a reviewable visual card. |
| Codex Modeling Studio | Agent edits geometry and materials while the human judges the 3D viewport. |
| Margin | Agent participates under a distinct identity in local document comments. |
| Fieldwork | Agent changes a high-dimensional musical artifact while the human supplies auditory judgment. |
| Webroom | Semantic image-editing operations act on the same visual canvas. |
| Sunday Table | Agent coordinates related meal, recipe, and grocery views. |
| Verdant | Agent manipulates structured commerce state. |
| Crossword | Agent works inside a constrained, directly playable generated artifact. |

Official showcase:

- https://developers.openai.com/showcase?view=webmcp-apps
- https://developers.openai.com/showcase/cubecade-rubiks
- https://developers.openai.com/showcase/wandernote
- https://developers.openai.com/showcase/paperie
- https://developers.openai.com/showcase/codex-modeling-studio
- https://developers.openai.com/showcase/margin-editor

Broader ecosystem examples already cover ecommerce, travel, booking, dashboards, games, canvases, tool registries, developer utilities, and conventional MCP bridges:

- https://github.com/GoogleChromeLabs/webmcp-tools
- https://github.com/webmachinelearning/awesome-webmcp

## White spaces

The strongest underexplored interaction was **mixed-initiative diagnosis**:

```text
Agent decides which observation is needed
→ asks the human to perform it in the application
→ waits
→ consumes the new structured evidence
→ revises a hypothesis
→ stages a bounded action
→ returns control to the human
```

The human is not merely an approver. The human becomes a sensor, operator, witness, or adjudicator whose action creates information the agent cannot obtain by itself.

Other opportunity spaces considered:

1. mixed-initiative diagnosis;
2. minimal-change constraint repair;
3. evidence-gated action staging;
4. counterfactual policy rehearsal;
5. human-labeled anomaly investigation;
6. temporal dependency negotiation;
7. spatial allocation with personal constraints;
8. provenance and rights reconciliation.

## Evaluated concepts

### 1. ProbePilot

A circuit diagnostic bench where the agent chooses a test, the human operates the virtual meter, and repair staging remains locked until enough evidence exists.

Distinctive WebMCP property: the agent cannot complete the observation itself.

### 2. AccessPlan

An accessible event-floor planner that repairs seating and route conflicts while preserving human-locked placements and minimizing disruption.

Distinctive WebMCP property: live spatial state, user locks, and constraint repair on the same floor plan.

### 3. DataBoundary

A visual data-flow graph where the agent traces policy violations and stages minimal changes to fictional region, retention, and consent rules.

Distinctive WebMCP property: graph-level counterfactual policy rehearsal with visible human exceptions.

### 4. SignalGarden

A sensor-analysis workbench where the agent identifies suspicious intervals and asks the human to classify ambiguous operational events.

Distinctive WebMCP property: human labels change the agent’s investigation in the same live chart.

### 5. Protocol Loom

A laboratory scheduler that repairs dependent experiment timelines around instrument delays and user-locked steps.

Distinctive WebMCP property: semantic dependencies plus visual negotiation of unavoidable tradeoffs.

### 6. CareShift

A roster-repair board that minimizes staff disruption while respecting qualifications, rest constraints, and manager locks.

Risk: established scheduling category and healthcare credibility burden.

### 7. Consent Canvas

A campaign board that assembles creative assets while respecting fictional rights, territories, and expiry metadata.

Risk: visual creative tools are already heavily represented.

### 8. ColdChain Relay

A map-and-timeline planner that reallocates perishables after delays while respecting expiry and refrigeration constraints.

Risk: route optimization complexity and collision with map-based agent applications.

### 9. PartWeaver

A bill-of-materials graph that proposes component substitutions and traces downstream compatibility consequences.

Risk: established enterprise engineering category.

### 10. Changeover Forge

A production-sequence tool that reduces setup changes while respecting rush jobs and maintenance locks.

Risk: generic scheduling and optimization appearance.

### 11. GrantBalance

A funding-allocation board for budget, category, geography, and concentration constraints.

Risk: generic optimization dashboard and policy/fairness concerns.

### 12. ArchiveLineage

A provenance graph where an agent and curator reconcile duplicate entities without erasing conflicting claims or source uncertainty.

Distinctive WebMCP property: evidence-preserving staged merge with deliberate unresolved states.

### 13. StatePath

A UI state-machine debugger that generates failing traces and stages minimal transition repairs.

Risk: crowded developer-tool and diagram-editor category.

### 14. OpsWeave

An incident-response topology and runbook environment.

Rejected because close WebMCP incident-command concepts were already publicly visible and the infrastructure required to feel credible was too large.

## Score matrix

The first four columns map directly to the official rubric on a 1–10 scale.

| Concept | WebMCP | Execution | Impact | Creativity | Official /40 | Composite /100 |
|---|---:|---:|---:|---:|---:|---:|
| ProbePilot | 9.5 | 8.5 | 7.5 | 9.5 | 35.0 | 87.2 |
| AccessPlan | 9.0 | 9.0 | 8.5 | 8.5 | 35.0 | 86.9 |
| DataBoundary | 9.0 | 8.5 | 8.5 | 8.5 | 34.5 | 84.5 |
| SignalGarden | 8.5 | 8.0 | 8.0 | 8.5 | 33.0 | 81.6 |
| ArchiveLineage | 8.0 | 8.0 | 7.5 | 8.5 | 32.0 | 78.4 |
| Consent Canvas | 8.0 | 8.5 | 8.0 | 8.0 | 32.5 | 78.4 |
| Protocol Loom | 8.5 | 8.0 | 8.0 | 7.5 | 32.0 | 77.8 |
| CareShift | 8.5 | 8.5 | 9.0 | 6.5 | 32.5 | 77.4 |
| ColdChain Relay | 8.5 | 7.0 | 9.0 | 7.5 | 32.0 | 77.4 |
| Changeover Forge | 8.0 | 8.0 | 8.5 | 6.5 | 31.0 | 73.8 |
| GrantBalance | 7.5 | 8.5 | 8.0 | 7.0 | 31.0 | 73.7 |
| StatePath | 8.0 | 8.0 | 7.0 | 7.0 | 30.0 | 72.8 |
| PartWeaver | 8.5 | 7.5 | 8.5 | 6.0 | 30.5 | 72.5 |
| OpsWeave | 8.5 | 6.5 | 8.5 | 4.5 | 28.0 | 65.5 |

Additional dimensions included WebMCP necessity, originality, usefulness, technical impressiveness, demo clarity, visual potential, buildability, collision risk, and the probability of a memorable “this is what WebMCP is for” moment.

## Why ProbePilot won

ProbePilot had the strongest answer to the first tie-break criterion: removing WebMCP collapses the central interaction into manual transcription between chat and a simulator. Removing the human collapses the evidence-collection protocol.

The initial idea was a prepared debugging exercise. It was then expanded into a focused studio after evaluating the product-completeness argument. The final strategic decision was:

> The studio is the container. Human-agent debugging is the thesis.

A generic AI circuit studio would collide with existing projects such as tscircuit, Circuitiny, CircuitAI, and MCP-based simulation tooling. The design-versus-bench split preserves originality:

- the agent can directly edit the ideal design;
- it cannot directly inspect the unknown implementation difference;
- the human must produce observations;
- the application must enforce evidence and approval boundaries.

## Skeptical-judge test

### Is WebMCP forced into the product?

No. The agent repeatedly consumes and changes live application state, and the key measurement call must synchronize with a human action inside that same page.

### Is the value understandable quickly?

Yes:

> The agent chooses the next diagnostic test, you take the measurement, and it cannot propose a repair until there is enough evidence.

### Could browser automation do it?

It could click a meter, but that would eliminate the human-as-sensor role. It would also act through inferred interface mechanics rather than an explicit diagnostic protocol.

### Is there product value beyond novelty?

Yes. The application teaches test selection, evidence tracking, avoidance of guess-based replacement, and verification of the result.

### What would produce a mediocre score?

- hidden fault leaks through inspection;
- agent fabricates a measurement;
- agent applies the repair;
- evidence gate is only a prompt instruction;
- WebMCP actions are invisible in the demo;
- the circuit editor is broad but unreliable;
- the product is framed as generic “AI for electronics.”

### Highest-leverage improvement

Make the evidence gate visible and enforceable:

```text
before evidence: stage repair → INSUFFICIENT_EVIDENCE
after evidence: stage repair → awaiting human approval
```

## Supporting ecosystem and adjacent references

- Chrome WebMCP overview: https://developer.chrome.com/docs/ai/webmcp
- Tool design guidance: https://developer.chrome.com/docs/ai/webmcp/best-practices
- Security guidance: https://developer.chrome.com/docs/ai/webmcp/secure-tools
- Evaluation guidance: https://developer.chrome.com/docs/ai/webmcp/evals
- tscircuit: https://github.com/tscircuit/tscircuit
- GoogleChromeLabs demos: https://github.com/GoogleChromeLabs/webmcp-tools
- Community catalog: https://github.com/webmachinelearning/awesome-webmcp
