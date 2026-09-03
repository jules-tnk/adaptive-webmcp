# Capability Forge Design

**Status:** Awaiting user review

**Date:** 2026-08-27

**Target folder:** `experiments/capability-forge/`

## Goal

Build a judge-accessible WebMCP web application where a browser agent and a person turn one successful interaction with a controlled legacy interface into a constrained, reviewed, tested, and reusable WebMCP capability.

The prototype tests this product claim:

> A learned browser capability becomes trustworthy when the user can inspect its contract, replay it against a known state, and approve it before the browser exposes it for reuse.

## Challenge fit

Capability Forge will run as one hosted web app. Judges can open it in ChatGPT's in-app browser or WebMCP-enabled Chrome without installing an extension.

The app exercises WebMCP through a persistent forge tool surface and through dynamically registered compiled capabilities. The visible UI keeps the human involved in recording, review, approval, repair, and result inspection.

## Scope

### Included

- A controlled legacy catalog interface with two DOM versions.
- A teaching mode that records bounded `fill`, `click`, `waitFor`, and `extract` interactions.
- Forge WebMCP tools that let the agent read the trace and propose a declarative capability.
- A JSON Schema validator and constrained workflow executor.
- A human review gate that the agent cannot approve.
- Preflight and replay tests against resettable fixture state.
- Dynamic registration of approved capabilities through `document.modelContext.registerTool()`.
- Local persistence of approved capability definitions.
- Failure detection when the legacy UI changes.
- A repair proposal and revalidation flow.
- A comparison panel for first-run exploration and capability reuse.

### Excluded

- Arbitrary third-party websites.
- Browser-extension installation.
- Generated or imported JavaScript.
- Network inspection or replay.
- Purchases, messages, account changes, deletion, or other consequential actions.
- Automatic approval or silent repair.
- Public registries, signing infrastructure, teams, accounts, and billing.
- An embedded LLM or server-side AI API. The browser agent supplies reasoning.

## Users

### Primary user

A product owner or operations specialist who wants to teach an agent one repeatable workflow while retaining control over what the learned tool can do.

### Agent

A WebMCP-aware browser agent that explores the legacy interface, reads the recorded trace, proposes a constrained capability, and invokes the approved capability later.

## Demo scenario

The legacy interface is a small catalog and shortlist application. A person or agent can:

1. Enter a search query.
2. Select a category.
3. Submit the search.
4. Inspect structured results.
5. Add one result to a shortlist.

The first target capability is `find_and_shortlist_item`. It accepts a query and category, performs the search, waits for results, chooses a deterministic fixture result, and adds it to the shortlist.

Version 2 changes element names and structure while preserving visible labels and behavior. The old capability must fail preflight instead of reporting success. The agent can propose repaired selectors, but the person must review and approve the revision.

## Experience flow

### 1. Teach

- The person opens the legacy lab and selects **Start teaching**.
- The agent completes the catalog workflow through ordinary browser interaction.
- The recorder captures allowed interaction events and stable element evidence.
- The person stops recording.

### 2. Compile

- The agent calls `forge_get_trace`.
- The agent constructs a declarative capability and calls `forge_propose_capability`.
- The validator rejects unknown actions, invalid inputs, unsafe selectors, excessive steps, and unsupported scopes.

### 3. Review

- The proposed capability appears in a visible review panel.
- The panel shows its name, description, schema, steps, selectors, read/write classification, expected result, and origin scope.
- The agent may request that the panel open, but only the person can approve or reject.

### 4. Verify

- Approval starts a resettable replay test.
- The executor runs the workflow against fixture state.
- The verifier checks both the returned result and the resulting shortlist state.
- A passing capability becomes eligible for registration.

### 5. Reuse

- The app registers the approved capability through WebMCP.
- The agent calls it with new fixture input.
- The metrics panel compares exploration and reuse.

### 6. Repair

- The person switches the lab to version 2.
- Preflight identifies the first broken step and records evidence.
- The agent reads the failure and proposes a revised capability.
- The person reviews and approves the revision.
- The verifier reruns the complete capability before replacing the active registration.

## WebMCP tool surface

The app registers these stable forge tools:

### `forge_start_teaching`

Starts or resets a teaching session.

Input:

```ts
{
  workflowName: string;
}
```

Result includes the session identifier and recording state.

### `forge_get_trace`

Returns the current bounded trace and the allowed action vocabulary.

Annotations:

```ts
{ readOnlyHint: true }
```

### `forge_propose_capability`

Submits a new or revised declarative capability for validation and human review.

Input:

```ts
{
  capability: CapabilityDefinition;
  replacesCapabilityId?: string;
}
```

The tool cannot approve, register, or execute the proposal.

### `forge_run_preflight`

Checks whether an approved capability can resolve its targets against the current lab version without executing mutations.

### `forge_open_review`

Opens the human review panel for a proposal or failure report. It changes client UI state but does not approve the capability.

### Compiled capabilities

Each approved definition registers a WebMCP tool with its declared name, description, input schema, `readOnlyHint`, and executor callback. An `AbortController` owns its lifecycle. Replacing a capability aborts the prior registration before registering the verified revision.

## Capability definition

```ts
type CapabilityDefinition = {
  format: "capability-forge";
  version: 1;
  name: string;
  description: string;
  scope: {
    origin: string;
    pathname: "/lab";
  };
  inputSchema: JsonSchemaObject;
  classification: "read" | "client-write";
  workflow: WorkflowStep[];
  expected: ExpectedEffect;
};

type WorkflowStep =
  | { action: "fill"; selector: string; value: ValueExpression }
  | { action: "click"; selector: string }
  | { action: "waitFor"; selector: string; timeoutMs: number }
  | { action: "extract"; selector: string; fields: ExtractField[]; saveAs: string };

type ValueExpression =
  | { source: "input"; name: string }
  | { source: "literal"; value: string }
  | { source: "step"; step: string; path: string };

type ExtractField = {
  name: string;
  source: "text" | "value" | "attribute";
  attribute?: string;
};

type ExpectedEffect =
  | { kind: "shortlist-size-delta"; delta: 1 }
  | {
      kind: "element-value";
      selector: string;
      value: ValueExpression;
    };
```

The first version accepts at most 12 steps, a 5-second timeout per wait, 20 extracted items, and 32 KB of serialized output.

## Architecture

### Stack

- Vite
- React
- TypeScript
- Tailwind CSS
- Vitest
- Testing Library
- Playwright
- Browser `localStorage` for prototype persistence

The application has no required backend.

### Modules

```text
src/
├── app/                  routes, shell, and shared providers
├── lab/                  controlled legacy application and fixture state
├── recorder/             DOM event capture and trace normalization
├── capability/           types, schema, validation, and persistence
├── executor/             constrained workflow execution
├── verifier/             preflight, fixture reset, and outcome checks
├── webmcp/               feature detection and tool lifecycle
├── review/               proposal, approval, rejection, and repair UI
└── metrics/              first-run and reuse measurements
```

### Data flow

```text
browser interaction
    -> recorder
    -> normalized trace
    -> agent proposal through WebMCP
    -> validator
    -> human review
    -> replay verifier
    -> approved registry
    -> dynamic WebMCP registration
    -> agent reuse
```

## State model

```ts
type CapabilityStatus =
  | "proposed"
  | "rejected"
  | "approved"
  | "verifying"
  | "verified"
  | "failed"
  | "superseded";
```

The registry stores definitions, status history, validation findings, replay results, and the active revision identifier. It does not store arbitrary code, credentials, or agent conversation data.

## Error handling

- Unsupported WebMCP shows setup instructions while preserving manual UI operation.
- Invalid proposals return structured field errors.
- Missing selectors fail at the exact workflow step.
- Timeouts abort execution and leave fixture state resettable.
- A replay mismatch records expected and observed effects.
- A failed revision never replaces the last verified registration.
- Duplicate tool names require an explicit replacement proposal.
- Tool callbacks return failure details and never report success after a partial run.

## Security boundaries

- The executor uses an allowlist of four actions.
- Selectors may target the controlled lab root only.
- `script`, `iframe`, password, file, and hidden inputs are forbidden targets.
- URL navigation and network requests are outside the DSL.
- Capability approval requires a direct UI action.
- The app labels extracted page data as untrusted content.
- The app validates tool inputs inside the callback instead of relying on browser schema enforcement.
- Repair proposals pass the same review and replay gates as new capabilities.

## Metrics

The app records:

- browser interaction count during teaching
- compiled capability step count
- tool calls during reuse
- execution duration
- preflight and replay outcome
- repair attempts

Token measurement appears only when the agent environment provides trustworthy usage data. The app must not invent token counts.

## Testing

### Unit tests

- Capability schema and limits.
- Selector policy.
- Value-expression resolution.
- Workflow executor success and failure behavior.
- Registry revision transitions.
- Preflight and replay outcome comparison.
- Metric aggregation.

### Component tests

- Review panel renders full capability details.
- Approve and reject actions require direct user input.
- Failed verification does not expose registration controls.
- Version-switch failure shows the exact broken step.

### Browser tests

- Record the version 1 workflow.
- Submit a capability through a mocked `document.modelContext`.
- Approve and replay it.
- Confirm dynamic registration.
- Invoke the compiled tool and assert shortlist state.
- Reload and confirm the verified capability returns.
- Switch to version 2, observe preflight failure, approve a repair, and rerun.

### Real WebMCP verification

Run the final deployed app in both:

- ChatGPT's in-app browser.
- Chrome 149 or later with `chrome://flags/#enable-webmcp-testing` enabled.

Record tool discovery, invocation, UI state change, result inspection, and tool lifecycle behavior.

## Acceptance criteria

- A judge can open one live URL and understand the product without installing software.
- The initial lab exposes forge tools but no compiled catalog capability.
- The agent can read a recorded trace and submit a valid capability proposal.
- The person can inspect and approve the proposal in the visible UI.
- The app verifies the expected result before registration.
- The approved tool survives reload through local persistence.
- The agent can use the compiled tool for a new fixture task.
- Version 2 causes an honest preflight failure.
- A repaired revision cannot activate until it passes review and replay.
- Automated tests cover validation, execution, lifecycle, and the primary browser flow.

## Submission evidence

The prototype must retain:

- screenshots of teach, review, verification, reuse, and repair
- a concise architecture diagram
- automated test results
- real-browser compatibility notes
- first-run and reuse metrics
- dated implementation history after the challenge start

## Comparison gate

After both prototypes work, score Capability Forge from 1 to 5 on:

- WebMCP leverage
- execution and setup friction
- specific user impact
- creativity relative to prior art
- clarity within a three-minute demo
- reliability in ChatGPT and Chrome

Only the stronger prototype receives submission polish.
