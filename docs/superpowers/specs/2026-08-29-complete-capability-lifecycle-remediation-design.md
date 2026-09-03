# Complete Capability Lifecycle Remediation Design

Date: 2026-08-29

## Status

Approved direction. This design converts the current component-tested prototype into one connected user and agent lifecycle. It supersedes lifecycle-completeness claims in `STATUS.md` until every phase below passes its acceptance gate.

## Goal

Deliver a truthful end-to-end workflow:

```text
site access
  -> human demonstration or autonomous agent task
  -> one persisted provenance trace
  -> deterministic draft
  -> durable human review
  -> risk-appropriate verification
  -> active WebMCP tool
  -> reuse after reload
  -> structured failure
  -> reviewed repair
```

## Product UX correction

The Session tab exposes one explicit start action:

- **Teach a workflow** starts a Manual demonstration.

Remove **Let the agent explore** and **Build together**. Automatic learning starts through the stable `capability_forge` bootstrap tool when an agent cannot reuse a suitable tool for its current task. Hybrid is derived when both human and agent events exist in the same trace; it is not a separate start button.

The Session tab also displays agent activity as state rather than as a command:

- Idle;
- Exploring;
- Drafting;
- Awaiting review;
- Verifying;
- Active;
- Paused or failed.

Human decisions remain explicit for site access, risky actions, proposal approval/rejection, replacement, import, deletion, and other externally consequential operations.

## Cross-phase invariants

- Chrome optional origin permission remains required before page access.
- The background service worker is the source of truth for sessions, proposals, confirmations, capability revisions, execution outcomes, and repair state.
- Content and main-world code cannot activate, replace, delete, or approve a capability.
- Agent-supplied booleans never count as human confirmation.
- Definitions are declarative data. Generated or imported executable code remains forbidden.
- Every bridge message has a message-specific schema.
- Every session state change is persisted before the UI or agent is notified.
- One active verified revision remains available until a replacement verifies successfully.
- Tests must exercise the public UI/WebMCP boundary; helper-only coordinator tests are necessary but insufficient.

## Phase 1: Golden Manual lifecycle

### Live trace persistence

Manual events must be appended to the background session as they occur instead of being stored only inside `ManualRecorder` until Stop. Add a typed `SessionAppend` bridge message carrying one validated `TraceEvent` and the tab ID. The background loads the current session, calls `SessionMachine.append`, persists the result, and emits `SessionStateChanged`.

`ManualRecorder` accepts an event sink dependency. It still stores parameter references rather than entered values and still blocks sensitive targets.

### Stop and draft

Replace `ManualStop` semantics with a mode-independent `SessionStop` flow:

1. Stop active page listeners when Manual recording is present.
2. Load the authoritative background session.
3. Transition Collecting to Drafting.
4. Compile the persisted trace into a declarative capability draft.
5. Persist the proposal and transition Drafting to AwaitingReview.
6. Notify the side panel and select Review.

Automatic sessions use the same stop/finalize service and never call `ManualRecorder.stop()` when no recorder exists.

### Deterministic trace compiler

Create `TraceCompiler` in the core package with:

```ts
TraceCompiler.compile(input: {
  readonly session: LearningSession
  readonly nextRevision: number
}): ValidationResult<CapabilityDefinition>
```

Rules:

- reject an empty trace;
- derive a stable tool name from the goal with a deterministic collision suffix supplied by the caller;
- set title and description from the reviewed goal;
- scope to the exact origin and the session's observed paths;
- convert parameterized Fill/Select events into named input fields;
- preserve Check, Click, Keypress, ScrollIntoView, WaitFor, WaitForUrl, and Extract actions when present;
- classify with `RiskPolicy.classify` rather than trusting a caller-provided classification;
- derive provenance counts from actual trace sources;
- create a Proposed verification record;
- attach a clearly labelled weak expected effect based on the final resolvable target or final route until richer outcome marking is implemented.

Review must state when an expected effect verifies replayability rather than business-task success.

### Durable proposal repository

Replace `ProposalCoordinator`'s in-memory-only pending map with `ProposalRepository` in `chrome.storage.local`. Persist:

- request ID;
- session ID;
- origin;
- status;
- definition;
- created and expiry timestamps.

Review survives service-worker restart and side-panel recreation. Add approve and reject actions. Approval revalidates the definition and current scope before verification. Rejection transitions the session to Rejected without activating a tool.

### Phase 1 acceptance gate

A loaded-extension test must perform the real lab workflow through the side panel:

```text
Teach a workflow
  -> search notebook in Office
  -> shortlist Field Notebook
  -> Stop and save trace
  -> Review appears without reload
  -> Approve and verify
  -> active revision appears in Tools
```

The test must assert Drafting, AwaitingReview, Verifying, and Active transitions rather than only a non-empty trace.

## Phase 2: Autonomous agent and mixed provenance

### Stable bootstrap contract

The bootstrap input schema must expose operation-specific fields required by implemented operations. `begin_session` accepts a goal derived from the agent's current task; origin and path come from the trusted sender, not agent input. `inspect`, `begin_session`, `join_session`, `list_tools`, `report_failure`, and `request_repair` must each have a production handler or be removed from the advertised enum.

The bootstrap inspect response tells an unfamiliar agent:

1. reuse a healthy matching tool when available;
2. otherwise begin Automatic learning;
3. stay inside the bounded temporary-tool budget;
4. propose a declarative workflow;
5. wait for human review before activation;
6. report failures and request reviewed repair when reuse fails.

### Agent trace persistence

Successful `forge_interact` calls append their returned TraceEvent through `SessionAppend`. Observations used for drafting remain bounded. Agent action count and trace source are derived by the background.

The agent cannot set `confirmed: true`. A risky learning action creates a confirmation request owned by Phase 4.

### Mode derivation and handoff

`LearningMode` remains persisted provenance metadata:

- Human-only trace: Manual.
- Agent-only trace: Automatic.
- Both sources: Hybrid.

`SessionMachine.append` derives Hybrid when the second actor contributes. Human handoff starts/stops ManualRecorder without replacing the background session. Agent join uses the same session ID and trace.

### Phase 2 acceptance gate

- Automatic: an agent starts from `capability_forge`, explores the lab, proposes a draft, and reaches Review without a user clicking an Automatic button.
- Hybrid: a human starts teaching, the agent joins, both sources appear chronologically, and one draft contains accurate provenance counts.

## Phase 3: Tool registration, execution, failure, and repair

### Learned tool registration

Instantiate `LearnedToolRuntime` from `main-world/index.ts` beside `BootstrapRuntime`. Protocol inspect and `RuntimeSync` include active, scope-matching capability definitions. The runtime registers only eligible verified definitions and removes registrations when permission, scope, health, or status changes.

### Trusted execution mediation

The agent invokes a learned WebMCP tool by name and input. The background loads the active definition from `CapabilityRepository`; it never executes a definition supplied by the agent. It validates inputs and current scope, creates an execution ID, and dispatches the packaged executor to the isolated content script.

Execution results return to the background before reaching the agent. The background stores the outcome and updates tool health.

### Navigation continuation

Wire `ExecutionCoordinator` into navigation-producing steps and PageReady. Checkpoints are created before full-document navigation, validated on the next page, resumed only on matching origin/path, and removed after completion or failure.

### Failure and repair

Wire `RepairCoordinator` to real execution failures. A stale or missing target:

1. records failure against the active revision;
2. marks health stale/failed without deactivating working history;
3. exposes the failure through bootstrap inspect, Tools, and Evidence;
4. starts a repair session through `request_repair`;
5. creates a revision-numbered replacement proposal;
6. activates the replacement only after review and verification.

A failed replacement remains Failed and cannot supersede the active revision.

### Phase 3 acceptance gate

The loaded lab test must invoke the learned tool, reload and invoke it again, switch to Changed DOM, invoke the old tool to obtain a structured failure, propose a repair through the real repair route, verify it, and successfully invoke the new active revision. Tests may not inject handcrafted revisions directly into `forge_propose_workflow` as a shortcut.

## Phase 4: Confirmation, management, evidence, and hardening

### Extension-owned confirmations

Create `ConfirmationCoordinator` with durable, expiring requests. Risky learning or execution returns `RiskConfirmationRequired` and a request ID. The side panel shows the exact action, origin, target, effect, and scope. Only a side-panel decision can resolve the request. Resumption uses the stored decision and request ID; agent payload fields cannot bypass it.

### Tool management

Tools provides typed actions:

- inspect revision;
- enable/disable;
- export selected verified definitions;
- reviewed import;
- begin repair;
- delete after explicit confirmation.

Connect `LegacyToolpackImporter` and `ToolpackExporter` through background routes. Imports are validated, origin-bound, reviewed, and never auto-activated.

### Evidence

Evidence displays real persisted data:

- chronological trace entries and sources;
- proposal history and decisions;
- verification attempts with timestamps and outcomes;
- executions and failures;
- repair lineage and revision comparison;
- clear labels for replay verified, reviewed-not-replay-verified, and failed.

`VerificationCoordinator` must perform a real selector/input preflight, use supplied fixture inputs for replay, and store non-empty attempt records. The UI must not call a constant `true` preflight honest verification.

### Session and bridge hardening

- Apply `SessionMachine.expire` on read and scheduled wakeups.
- Pause or finalize collecting sessions when their tab closes.
- Prevent silent replacement when starting a second session.
- Add schemas for every bridge message.
- Use `try/finally` for side-panel busy state and expose actionable errors.
- Log developer diagnostics without leaking page data.

### Claim reconciliation

Until each acceptance gate passes, `STATUS.md`, website copy, Lab Guide, demo script, Store listing, and reviewer instructions must distinguish implemented behavior from planned behavior. Firebase deployment and Chrome Web Store submission remain separately authorized external actions.

## Required golden journeys

1. Manual record -> draft -> review -> verify -> activate -> reuse.
2. Autonomous agent explore -> draft -> review -> activate.
3. Hybrid human/agent trace -> accurate provenance -> activation.
4. Active tool reload restoration and execution.
5. Changed DOM failure -> reviewed repair -> new active revision.
6. Sensitive target blocked.
7. Risky action blocked until extension-owned human confirmation.
8. Proposal and confirmation survive service-worker restart.
9. Import/export/delete require explicit review.
10. Tab-specific panel and site-access persistence remain intact.

All journeys run on desktop and mobile where the surface applies. Native WebMCP-enabled Chrome evidence remains required in addition to the faithful fake ModelContext suite.

## Non-goals

- Remote code or agent-generated JavaScript.
- Broad required host permissions.
- Automatic approval, repair, import, replacement, or deletion.
- YouTube automation without a documented permission basis.
- Firebase deployment, Store upload, or Devpost submission without explicit authorization.
