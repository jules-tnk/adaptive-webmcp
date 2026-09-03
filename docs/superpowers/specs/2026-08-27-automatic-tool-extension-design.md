# Automatic Tool Extension Design

**Status:** Awaiting user review

**Date:** 2026-08-27

**Target folder:** `experiments/automatic-tool-extension/`

## Goal

Build a Manifest V3 Chrome extension that adds one self-describing bootstrap WebMCP tool to an enabled website. An unfamiliar browser agent calls its `inspect` operation to receive a complete structured learning protocol, explores the website through ordinary browser capabilities, proposes a constrained capability definition, and reuses the newly registered tool during later visits.

The prototype tests the original product claim:

> An agent should pay the cost of understanding an unsupported website once, compile that understanding into a site-scoped WebMCP tool, and reuse the tool without another DOM exploration pass.

## Challenge fit

The extension ships with a hosted demo website and reproducible installation instructions. The website supplies the required live URL. The extension provides the real injection, validation, persistence, restoration, import, and export behavior.

The demo targets WebMCP-enabled Chrome because ChatGPT's in-app browser does not provide a documented path for installing arbitrary Chrome extensions. The submission video must show the complete installation and execution path, while the hosted site explains the experiment and remains usable without the extension.

## Scope

### Included

- A Manifest V3 Chrome extension.
- Per-origin user enablement from the extension popup.
- Optional host permission requested through a user gesture.
- Main-world injection of a packaged WebMCP runtime.
- One bootstrap tool named `adaptive_webmcp`.
- A versioned structured learning protocol returned by its `inspect` operation.
- A constrained declarative workflow format.
- Validation before registration and persistence.
- An extension-owned human approval gate for every new or replacement definition.
- Origin and pathname scoping.
- Persistence through `chrome.storage.local`.
- Restoration on later matching page loads.
- A popup dashboard for enabling sites and managing learned tools.
- JSON tool-pack export and import through the popup.
- A hosted unsupported-site demo with two layout versions.
- Honest selector and execution failures.
- Before-and-after metrics on the demo site.

### Excluded

- Generated or imported JavaScript.
- Automatic crawling of whole sites.
- Network interception or API synthesis.
- Automatic selector repair.
- Background execution without an open matching page.
- Chrome Web Store publication during the prototype stage.
- Firefox, Safari, and Edge packaging.
- Purchases, messages, deletion, authentication changes, or cross-origin workflows.
- A public tool registry.

## Users

### Primary user

A browser user who wants an agent to retain a reusable semantic capability for a website that has not implemented WebMCP.

### Agent

A WebMCP-aware browser agent with no prior knowledge of the extension. It discovers `adaptive_webmcp` from the page's tool list, reads the structured protocol, explores the page, proposes a constrained definition, and invokes the approved learned tool later.

## Demo scenario

The hosted demo is an unsupported catalog and shortlist application. It contains no native WebMCP registration code.

The demonstration follows this sequence:

1. Open the page without the extension and confirm that no site-specific catalog tool exists.
2. Enable the extension for the demo origin.
3. Confirm that `adaptive_webmcp` appears.
4. Give the agent a catalog task without explaining the extension.
5. Confirm that the agent calls `adaptive_webmcp` with `operation: "inspect"` and receives the learning protocol.
6. Let the agent search the interface and shortlist an item through ordinary browser actions.
7. Let the agent call `adaptive_webmcp` with `operation: "propose"` and a `find_and_shortlist_item` definition.
8. Approve the pending definition in the extension-owned review panel.
9. Confirm that the learned tool appears.
10. Reload the page.
11. Ask for a new item and confirm that the agent invokes the restored tool without another exploration pass.
12. Export the site tool pack.
13. Delete local learned tools, import the pack, reload, and invoke the restored tool.
14. Switch the demo to layout version 2 and show an honest stale-selector failure with recovery guidance.

The extension does not repair the version 2 failure. That boundary distinguishes this prototype from Capability Forge.

## Structured bootstrap protocol

The extension injects one tool:

### Tool metadata

```ts
{
  name: "adaptive_webmcp",
  title: "Adaptive site capability manager",
  description:
    "Use this tool when the current page lacks a suitable site tool for the user's task. " +
    "Start with operation 'inspect' to receive the page-specific learning protocol, " +
    "existing learned tools, supported workflow actions, safety constraints, and detected failures. " +
    "After exploring the page, use operation 'propose' to submit a declarative tool for human review. " +
    "Use operation 'report_failure' when a learned tool no longer works."
}
```

The description explains when to call the tool and directs an unfamiliar agent to progressive disclosure through `inspect`. It does not claim system authority, ask the agent to ignore other instructions, or grant permission for unrelated actions.

### Input

```ts
type AdaptiveWebMcpInput = {
  operation: "inspect" | "list" | "propose" | "report_failure";
  definition?: LearnedToolDefinition;
  replaceExisting?: boolean;
  toolName?: string;
  failure?: ToolFailureReport;
};

type ToolFailureReport = {
  code: "STALE_TARGET" | "TIMEOUT" | "RESULT_MISMATCH" | "EXECUTION_ERROR";
  failedStep?: number;
  message: string;
};
```

The callback rejects missing or unrelated fields for each operation.

| Operation | Required fields | Allowed optional fields |
|---|---|---|
| `inspect` | none | none |
| `list` | none | none |
| `propose` | `definition` | `replaceExisting` |
| `report_failure` | `toolName`, `failure` | none |

### `inspect`

Returns the versioned page-specific protocol, allowed actions, limits, current learned tools, recent failure evidence, and the next valid calls. This is the canonical onboarding channel for an unfamiliar agent.

```ts
type LearningProtocol = {
  protocolVersion: 1;
  purpose: string;
  page: {
    origin: string;
    pathname: string;
  };
  phases: Array<{
    phase: "reuse" | "explore" | "model" | "propose" | "improve";
    instruction: string;
  }>;
  allowedActions: Array<"fill" | "click" | "waitFor" | "extract">;
  constraints: {
    maximumSteps: 12;
    maximumWaitMs: 5000;
    maximumExtractedItems: 20;
    maximumOutputBytes: 32768;
    sameOriginOnly: true;
    executableCodeAllowed: false;
    humanApprovalRequired: true;
  };
  existingTools: LearnedToolSummary[];
  failedTools: LearnedToolFailureSummary[];
  nextCalls: Array<{
    operation: AdaptiveWebMcpInput["operation"];
    when: string;
    requiredFields: string[];
  }>;
};

type LearnedToolSummary = {
  id: string;
  name: string;
  revision: number;
  classification: "read" | "client-write";
  pathMatch: string;
  health: "healthy" | "unhealthy" | "unknown";
};

type LearnedToolFailureSummary = {
  toolId: string;
  toolName: string;
  revision: number;
  code: ToolFailureReport["code"];
  failedStep?: number;
  message: string;
  recordedAt: string;
  source: "executor" | "agent-report";
};
```

The phase instructions tell the agent to check existing tools first, use normal browser interaction only when no tool fits, model the successful workflow, submit a declarative proposal, and report stale tools for improvement.

### `list`

Returns current learned tools, their scopes, revisions, classifications, health state, and last failure without repeating the complete protocol.

### `propose`

Accepts a `definition` and optional `replaceExisting` flag:

1. Confirm that the requested origin equals the active document origin.
2. Validate the format, schema, scope, limits, action vocabulary, selectors, and value references.
3. Run selector preflight against the active document.
4. Send the validated definition through the extension bridge as a pending proposal.
5. Show an extension-owned review panel in an isolated-world Shadow DOM.
6. Reject or expire the proposal unless the person approves it.
7. Persist the approved definition in `chrome.storage.local`.
8. Register it in the active document.
9. Return the stored tool identifier, revision, and preflight result.

### `report_failure`

Accepts `toolName` and bounded `failure` evidence. The extension verifies that the named learned tool exists, adds its own timestamp, stores the report, marks the tool unhealthy, and returns the replacement process. A later `inspect` call includes the failure so the agent can explore the changed page and submit a reviewed replacement.

The executor records selector, timeout, and execution failures without waiting for the agent to report them. `report_failure` covers semantic failures the executor cannot prove, such as a result that completed but did not satisfy the user's intent.

### Instruction boundary

The extension does not inject an invisible prompt, hidden element, accessibility-only instruction, document metadata instruction, or off-screen text. Agents may omit hidden DOM content, and any page instruction remains untrusted content. The complete protocol travels through the WebMCP tool contract and structured `inspect` result.

The bootstrap cannot accept source code, remote URLs, inline functions, cross-origin scopes, or operations outside the four declared values.

## Learned tool definition

```ts
type LearnedToolDefinition = {
  format: "adaptive-webmcp-tool";
  version: 1;
  name: string;
  description: string;
  scope: {
    origin: string;
    pathMatch: string;
  };
  inputSchema: JsonSchemaObject;
  classification: "read" | "client-write";
  workflow: WorkflowStep[];
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

type LearnedToolResult =
  | { ok: true; data: unknown }
  | {
      ok: false;
      failure: ToolFailureReport;
      recovery: {
        tool: "adaptive_webmcp";
        arguments: {
          operation: "report_failure";
          toolName: string;
          failure: ToolFailureReport;
        };
      };
    };
```

Limits match Capability Forge so both prototypes receive a fair comparison:

- at most 12 steps
- at most 5 seconds per wait
- at most 20 extracted items
- at most 32 KB of serialized output
- exact active origin
- one pathname match pattern, either an exact pathname or a pathname ending in `*`

## Tool-pack format

```ts
type ToolPack = {
  format: "adaptive-webmcp-toolpack";
  version: 1;
  exportedAt: string;
  origin: string;
  tools: LearnedToolDefinition[];
};
```

Import behavior:

- Parse JSON without evaluation.
- Validate every definition.
- Reject mixed-origin packs.
- Show the origin, paths, classifications, and steps before installation.
- Require a direct user confirmation.
- Preflight matching tools when a corresponding tab is available.
- Preserve existing tools unless the person approves replacement.

## Architecture

### Stack

- TypeScript
- Manifest V3
- Vite for extension and demo builds
- React for popup and demo UI
- Tailwind CSS
- Vitest
- Testing Library
- Playwright with Chromium extension loading

The prototype has no required backend.

### Folder structure

```text
experiments/automatic-tool-extension/
├── extension/
│   ├── manifest.json
│   └── src/
│       ├── background/       permissions, storage, and tab lifecycle
│       ├── content/          isolated-world bridge
│       ├── main-world/       packaged WebMCP runtime and executor
│       ├── approval/         isolated-world proposal review panel
│       ├── popup/            enablement, tools, import, and export
│       ├── domain/           definitions, validation, and matching
│       └── shared/           typed bridge messages
├── demo-web/
│   └── src/                  unsupported catalog fixture and metrics UI
└── tests/
    ├── unit/
    └── extension/
```

No code will be shared with Capability Forge during the exploration phase. Independent implementations make the comparison more honest and prevent one prototype from dictating the other's architecture.

## Extension lifecycle

### Site enablement

1. The person opens the popup and selects **Enable on this site**.
2. The popup requests optional permission for the exact origin pattern.
3. The background worker stores the enabled origin.
4. The extension injects the packaged main-world runtime into the active tab.

### Page load

1. The background worker observes a completed navigation on an enabled origin.
2. It loads matching definitions from extension storage.
3. It injects the main-world runtime and definitions.
4. The runtime registers the bootstrap tool and matching learned tools.
5. The runtime reports registration outcomes to the isolated content bridge.

### Bootstrap operation flow

1. The agent discovers `adaptive_webmcp` from the WebMCP tool list.
2. The agent calls `inspect` without needing prior extension knowledge.
3. The main-world callback requests protocol state through the bridge.
4. The background worker returns page scope, learned tools, failure evidence, limits, and valid next calls.
5. The agent reuses an existing suitable tool or explores the page through ordinary browser interaction.
6. The agent calls `propose` with a declarative definition.
7. The main-world callback validates page-specific preconditions.
8. A request identifier crosses the `window.postMessage` bridge.
9. The isolated content script forwards the request to the background worker.
10. The background worker validates again and marks the proposal pending.
11. The isolated content script renders the extension-owned review panel.
12. The person approves or rejects the proposal within 120 seconds.
13. The background worker persists an approved definition.
14. The response returns through the bridge.
15. The main-world runtime registers the learned tool and resolves the bootstrap call.

All bridge messages include a version, request identifier, message type, and serializable payload. The content script requires `event.source === window`, accepts only allowlisted message types, validates every payload, and ignores unrelated messages. Page scripts can observe or imitate DOM messages, so the bridge treats each request as untrusted and grants no persistence or registration without the extension-owned approval gate.

## Main-world executor

The executor is packaged with the extension. Imported and generated definitions provide data only.

Execution behavior:

- Confirm current origin and pathname.
- Validate tool inputs inside the callback.
- Resolve variables from inputs and prior extraction steps.
- Restrict DOM queries to the active document.
- Apply step and time limits.
- Dispatch browser-compatible input and change events.
- Abort on the first failed step.
- Return bounded structured results.
- Record executor-detected failures and mark the learned tool unhealthy.
- Return `adaptive_webmcp` recovery arguments with every learned-tool failure.
- Never claim success after partial execution.

## Popup experience

The popup contains:

- current site and enablement state
- bootstrap injection status
- structured-protocol version
- learned tools for the origin
- tool name, path scope, classification, revision, and last preflight result
- enable, disable, and delete controls
- JSON export
- JSON import with a review dialog
- pending bootstrap proposals and their expiration state
- recent failure reports and unhealthy learned tools
- a link to setup and demo instructions

The popup does not expose raw code execution or selector editing in version one.

## Demo website

The hosted demo includes:

- the unsupported catalog and shortlist flow
- layout version 1 and version 2
- resettable local fixture state
- a neutral extension-detection indicator
- a metrics panel for manual actions and learned-tool execution
- setup instructions for Chrome 149 or later and the WebMCP testing flag

The demo must remain functional for a person without the extension. It must not register the learned catalog tool itself.

## Error handling

- Missing WebMCP support produces a clear popup diagnostic.
- Denied host permission leaves the site disabled.
- A missing content bridge triggers one bounded reinjection attempt.
- Invalid definitions return structured field errors.
- Duplicate names require `replaceExisting: true` and user policy approval from the popup if the existing definition differs.
- Bootstrap proposals expire after 120 seconds and return a structured timeout error.
- Unknown bootstrap operations and operation-specific field mismatches return validation errors.
- Failure reports for unknown tools are rejected.
- Storage failures prevent registration from reporting success.
- Stale selectors identify the exact failed step.
- A page navigation aborts pending tool executions.
- Import failures do not install a partial pack.

## Security boundaries

- Use optional host permissions requested per origin.
- Inject only packaged JavaScript.
- Keep imported and generated artifacts declarative.
- Reject script, iframe, password, file, and hidden-input targets.
- Reject cross-origin navigation and network operations.
- Cap steps, waits, extracted items, and output size.
- Validate in both main-world and extension contexts.
- Treat page content and tool outputs as untrusted.
- Keep bootstrap descriptions and protocol instructions bounded to extension usage; never present them as system or user authority.
- Never inject invisible or accessibility-hidden instructions into the host page.
- Require direct user actions for enabling an origin, accepting a bootstrap proposal, importing a pack, replacing a tool, and deleting stored tools.
- Store no page text, credentials, cookies, or agent conversation content.

Chrome Web Store publication remains out of scope because policy review may treat a complex remotely supplied workflow interpreter as remote logic. The hackathon prototype runs as an unpacked extension built from the public repository.

## Testing

### Unit tests

- Definition and tool-pack schemas.
- Bootstrap operation validation and structured protocol generation.
- Origin and path matching.
- Selector policy.
- Value-expression resolution.
- Workflow execution success, abort, and failure behavior.
- Storage serialization and revision replacement.
- Bridge message validation.
- Pending-proposal approval, rejection, and expiration.
- Failure-report storage and unhealthy-state transitions.
- Import atomicity.

### Component tests

- Enablement and permission states.
- Learned tool list and status.
- Import review details.
- Replacement and deletion confirmations.
- Unsupported-browser diagnostics.

### Extension browser tests

- Load the unpacked extension in Chromium.
- Enable the demo origin.
- Confirm bootstrap registration through a test `document.modelContext` surface.
- Call `inspect` from an agent with no extension-specific prompt and assert the complete protocol shape.
- Register a learned tool through the main-world bridge.
- Approve the pending proposal through the isolated-world panel.
- Invoke it and assert shortlist state.
- Reload and confirm restoration.
- Export, delete, import, and restore the tool pack.
- Switch to version 2 and assert an honest stale-selector failure.

### Real WebMCP verification

Use Chrome 149 or later with `chrome://flags/#enable-webmcp-testing` enabled. Record:

- bootstrap discovery
- `inspect` selection without a user-provided extension prompt
- structured protocol comprehension
- `propose` invocation and human approval
- same-session learned-tool discovery behavior
- learned-tool invocation
- reload restoration
- import/export restoration
- failure behavior on layout version 2

If Chrome does not expose the newly registered tool to the same active agent task, document the required new prompt or observation boundary instead of hiding it.

## Acceptance criteria

- The demo website exposes no catalog WebMCP tool without the extension.
- Enabling the origin injects exactly one bootstrap tool before learning.
- The bootstrap description directs an unfamiliar agent to `inspect` without hidden DOM instructions.
- `inspect` returns the complete versioned learning protocol, current tool health, and valid next calls.
- The bootstrap rejects executable code and invalid scopes.
- A valid learned definition remains pending until the person approves it.
- An approved learned definition registers on the active page.
- The extension persists the definition by origin and path.
- Reloading the page restores the learned tool.
- Invoking the learned tool changes the demo shortlist as expected.
- Export, delete, import, and restore works without evaluating code.
- Layout version 2 produces an honest, step-specific failure.
- A reported stale-tool failure appears in the next `inspect` result with replacement guidance.
- Automated tests cover validation, storage, bridge behavior, execution, and the primary extension flow.
- A judge can follow the public repository instructions to load and test the extension.

## Submission evidence

The prototype must retain:

- extension installation instructions
- packaged build artifact or reproducible build command
- hosted demo URL
- screenshots of enablement, bootstrap discovery, structured inspection, registration, reuse, reload, import/export, and failure
- automated test results
- Chrome version and flag details
- first-run and reuse metrics
- dated implementation history after the challenge start

## Comparison gate

After both prototypes work, score the automatic-tool extension from 1 to 5 on:

- WebMCP leverage
- execution and setup friction
- specific user impact
- creativity relative to prior art
- clarity within a three-minute demo
- reliability in WebMCP-enabled Chrome

Only the stronger prototype receives submission polish.
