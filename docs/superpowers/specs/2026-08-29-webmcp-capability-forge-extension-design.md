# WebMCP Capability Forge Extension Design

## Summary

WebMCP Capability Forge will merge the manual Capability Forge prototype and the automatic Adaptive WebMCP prototype into one Manifest V3 browser extension. A person can demonstrate a workflow, an agent can explore the page, or both can contribute to one learning session. The extension converts the evidence into a declarative workflow, asks the person to review it, verifies it according to its risk, registers it as a WebMCP tool, restores it after navigation or reload, and supports reviewed repair.

The merged product will live in `experiments/webmcp-capability-forge`. It contains the Chrome extension, its official website, the deterministic lab within that website, and a shared domain core. The existing prototypes will remain unchanged as reference implementations and regression evidence.

## Product name

- Official name: **WebMCP Capability Forge**
- Compact extension label: **Capability Forge**
- Subtitle: **Teach, discover, and reuse workflows as WebMCP tools.**

## Goals

- Let an unfamiliar WebMCP agent discover the complete learning protocol without a pasted prompt.
- Support Manual, Automatic, and Hybrid workflow learning through one session model.
- Let a person and an agent contribute evidence to the same immutable trace.
- Run on enabled, unmodified HTTP and HTTPS websites.
- Support same-origin route changes in the current tab.
- Require human approval before activation and before consequential actions.
- Store workflows as bounded declarative data without executing agent-supplied code.
- Verify each workflow at the strongest level its risk and website state permit.
- Restore approved tools after reload and report stale targets with repair evidence.
- Give judges deterministic lab evidence and separate native WebMCP evidence from public websites.
- Publish the official extension website at `https://webmcp-forge.jules-tnk.com`.
- Provide Chrome Web Store installation disclosure, privacy, terms, support, permissions, and release information.

## Non-goals

Version one will not support:

- Cross-origin iframe workflows.
- Closed Shadow DOM.
- Cross-origin navigation continuation.
- Multiple tabs, popup windows, or browser-internal pages.
- Authentication flows, CAPTCHAs, native dialogs, or page-workflow uploads and downloads.
- Arbitrary network requests, generated JavaScript, or direct browser API access in learned workflows.
- Cloud sync, accounts, a backend service, or remote workflow execution.
- Silent approval, silent repair, or automatic replacement of a verified revision.
- Website analytics, advertising, tracking cookies, accounts, telemetry, contact forms, or mailing lists.

## Repository layout

```text
adaptive-webmcp/
  experiments/
    capability-forge/              manual prototype
    automatic-tool-extension/      automatic prototype
    webmcp-capability-forge/
      extension/                    Chrome extension
      website/                      official website and deterministic lab
      packages/core/                shared contracts and policy
```

The website package replaces the initial `lab` scaffold. The deterministic lab remains available through `/lab/*` routes inside the official website.

## Unified lifecycle

Manual and Automatic learning collect evidence through different actors. They use the same lifecycle after collection starts.

```text
discover site
  -> begin session
  -> collect human and/or agent evidence
  -> compile capability draft
  -> human review
  -> policy check
  -> verification
  -> WebMCP registration
  -> reuse
  -> health monitoring
  -> reviewed repair
```

The extension preserves the source of each event. The agent may interpret an event or exclude it from a draft, but it cannot rewrite the original trace.

## Runtime architecture

WebMCP Capability Forge uses four extension surfaces and a shared TypeScript domain core.

```text
WebMCP agent
     <->
main-world runtime
     <-> versioned message bridge
background service worker
     <->
isolated recorder and explorer
     <->
active website

side panel <-> background service worker <-> local repository
```

### Main-world runtime

The main-world runtime owns:

- Stable bootstrap-tool registration.
- Temporary exploration-tool registration.
- Approved learned-tool registration.
- Declarative workflow execution.
- Execution cancellation and tool lifecycle.
- Structured health and failure reporting.

The extension packages all executable code. The runtime treats agent proposals, imports, page content, and tool outputs as untrusted data.

### Isolated recorder and explorer

The isolated content script owns:

- Manual interaction recording.
- Semantic inventory of visible controls.
- Safe agent interactions within the approved exploration boundary.
- DOM-change observation and bounded outcomes.
- Selector candidate generation.
- Sensitive-target detection and redaction.
- Current route and document-lifecycle reporting.
- Standard DOM and open Shadow DOM traversal.

The content script cannot approve a proposal or change stored policy.

### Background service worker

The background service worker acts as the trusted control plane. It owns:

- Optional site permission and persistent content registration.
- One active learning session per tab.
- Session recovery after same-origin navigation.
- Risk and policy enforcement.
- Proposal validation and approval coordination.
- Verification orchestration.
- Revision persistence and restoration.
- Import, export, enablement, deletion, and health state.
- Communication among the page runtime, content script, and side panel.

The service worker repeats trust-sensitive validation even when another surface has checked the same message.

### Side panel

The Chrome side panel provides the primary workspace. It lets the person:

- Enter a goal.
- Start Manual, Automatic, or Hybrid learning.
- Inspect the combined trace.
- Hand control between the person and agent.
- Approve navigation and risk boundaries.
- Review capability contracts and provenance.
- Run verification.
- Manage tools, revisions, failures, and repairs.

### Shared domain core

Pure TypeScript modules define:

- Session and trace schemas.
- Capability definitions.
- Workflow actions and value expressions.
- Risk policy.
- Selector scoring.
- Verification states.
- Error codes.
- Revision and repository contracts.

These modules do not depend on Chrome APIs or React.

## Learning session model

One session belongs to one browser tab and one exact origin. The background worker persists enough state to resume after a same-origin route change or extension service-worker restart.

### States

```text
idle
  -> collecting
  -> drafting
  -> awaiting_review
  -> verifying
  -> active

collecting, drafting, awaiting_review, and verifying
  -> paused | rejected | failed
```

Closing the tab pauses the session. The extension does not activate an incomplete proposal.

### Session fields

A session contains:

- Session ID and protocol version.
- Natural-language goal.
- Exact origin, starting path, and current path.
- Learning mode and current actor.
- Approved exploration and navigation boundaries.
- Risk state and pending confirmations.
- Immutable evidence trace.
- Capability drafts and revision links.
- Verification attempts.
- Bounded failures and recovery requests.
- Creation and update timestamps.

The agent can supply the goal through the bootstrap tool. The person can enter or edit the goal before evidence collection begins. The side panel mirrors the active goal.

## Evidence trace

Each trace event uses a versioned schema similar to:

```ts
type TraceEvent = {
  id: string
  source: 'human' | 'agent' | 'verifier'
  action: WorkflowActionName
  target?: SemanticTarget
  selectorCandidates?: SelectorEvidence[]
  inputReference?: ValueExpression
  outcome?: BoundedObservation
  origin: string
  path: string
  timestamp: number
}
```

The recorder stores parameter references instead of sensitive values. It rejects password, payment, authentication-code, file, and hidden inputs. It limits observation text and serialized trace size.

### Manual learning

The person starts recording and performs the task in the active page. The recorder captures approved actions and bounded observations. The person stops recording or hands control to the agent.

### Automatic learning

The agent starts or joins a session through the bootstrap protocol. Temporary exploration tools let it inspect visible controls, perform safe actions, observe bounded changes, read the trace, and propose a workflow.

### Hybrid learning

The person and agent contribute to one chronological trace. The side panel shows the current actor and the source of each event. Either actor can pause and hand control to the other. The compiler can use evidence from both sources in one draft.

## WebMCP bootstrap and exploration tools

### Stable bootstrap tool

The main-world runtime registers one stable tool named `capability_forge` on an enabled site. Its description tells an unfamiliar agent to call `inspect` first.

The bootstrap operations cover:

- `inspect`: return protocol version, page scope, phases, limits, active session, learned tools, failures, and valid next calls.
- `begin_session`: start Automatic or Hybrid learning with a goal.
- `join_session`: join a person-started Manual or Hybrid session.
- `list_tools`: return current-origin tool health.
- `report_failure`: record an execution or semantic failure.
- `request_repair`: begin a reviewed replacement for a stale or wrong tool.

### Temporary exploration tools

The runtime registers these tools only during an approved Automatic or Hybrid session:

- `forge_inspect_page`
- `forge_interact`
- `forge_observe_changes`
- `forge_read_trace`
- `forge_propose_workflow`

The extension removes them when the session ends, pauses, expires, or loses permission.

`forge_interact` accepts semantic target handles from the latest page inspection. The extension checks freshness, visibility, uniqueness, target type, and policy before each action. It does not accept executable selectors or JavaScript from the agent.

## Automatic exploration boundary

Automatic exploration can inspect, fill, click, select, check, press approved keys, scroll targets into view, wait, and extract bounded text within the current page.

The side panel asks the person to confirm before the agent:

- Crosses a same-origin route boundary during learning.
- Submits a form.
- Sends a message.
- Purchases, deletes, publishes, subscribes, or changes an account.
- Performs another action that the policy classifies as an external effect.

The extension blocks authentication, credential, payment, file, CAPTCHA, and other sensitive targets. Reaching the 20-action, 10-minute, or observation-size limit pauses the agent and offers stop, human handoff, or an approved extension of the session.

## Capability contract

The extension stores each learned capability as declarative, versioned data:

```ts
type CapabilityDefinition = {
  schemaVersion: number
  name: string
  title: string
  description: string
  scope: {
    origin: string
    pathPatterns: string[]
  }
  inputSchema: RestrictedJsonSchema
  classification: CapabilityClassification
  steps: WorkflowStep[]
  expectedEffects: ExpectedEffect[]
  provenanceSummary: ProvenanceSummary
  verification: VerificationRecord
  revision: number
}
```

### Workflow actions

Version one supports:

- `fill`
- `click`
- `select`
- `check`
- `keypress`
- `scrollIntoView`
- `waitFor`
- `waitForURL`
- `extract`

Steps can reference validated capability inputs through bounded value expressions. Definitions cannot include generated JavaScript, arbitrary URLs, arbitrary network requests, browser APIs, uploads, or downloads.

### Route continuation

A route-changing action uses a following `waitForURL` checkpoint. The background worker stores the continuation before the document changes. The new content script and main-world runtime validate the same origin, expected path, session ID, next step, and policy before resuming.

The workflow stops with `ROUTE_MISMATCH` when the route does not match. It does not search other tabs or origins.

## Target evidence and resolution

Each interactive step stores a ranked target strategy. Candidate evidence can include:

- Accessible role and name.
- Associated label.
- Stable `name`, ID, or semantic attribute.
- Stable `data-*` attribute.
- Element type and nearby semantic context.
- Bounded structural fallback.

The compiler rejects generated class names and weak positional selectors when no corroborating evidence exists.

At runtime, the resolver scores candidates for:

- Visibility.
- Uniqueness.
- Expected element type.
- Accessible identity.
- Current route.
- Agreement with the recorded evidence.

Missing or ambiguous targets stop execution. The executor does not click an approximate first match.

## Risk policy

Each capability receives one classification:

- `read`
- `local-ui`
- `navigation`
- `external-write`
- `blocked-sensitive`

Read and harmless local UI tools can run after approval and replay verification. The review surface shows navigation steps and path scope. External-write tools require confirmation at the consequential step on each execution. The extension refuses to activate blocked-sensitive capabilities.

The policy engine validates a proposal when the agent submits it, when the person approves it, and before each execution. Stored approval does not bypass a new runtime risk.

## Review

The side panel shows:

- Goal, name, title, and description.
- Inputs and required values.
- Exact origin and path patterns.
- Risk classification.
- Ordered workflow steps.
- Ranked target evidence.
- Expected route changes and effects.
- Human, agent, and verifier provenance.
- Extracted or modified information.
- Current verification state.

The agent can submit, revise, or withdraw a proposal. A direct human action must approve a new capability or replacement.

## Verification

The extension reports one of these states:

- `preflight-passed`
- `replay-verified`
- `reviewed-not-replay-verified`
- `failed`
- `stale`

### Read and harmless workflows

The verifier runs target preflight, replays the workflow, checks expected effects, and records bounded evidence. Successful workflows receive `replay-verified`.

### Navigation workflows

The verifier runs preflight and asks for confirmation before the route-changing replay. It checks the expected route and final effects.

### External-write workflows

The verifier performs structural checks without triggering the consequential action. The workflow receives `reviewed-not-replay-verified`. A deliberate, confirmed execution can add real execution evidence without changing the historical verification record.

The UI and tool descriptions must distinguish preflight, review, replay, and real execution.

## Activation and registration

The extension registers an approved capability when:

- Its scope matches the current exact origin and path.
- Its classification permits activation.
- Its verification state meets the classification requirement.
- The current extension policy still permits its actions.

Read, local UI, and navigation capabilities require `replay-verified`. External-write capabilities may register in a guarded state after human approval and structural verification; the runtime requests confirmation at the consequential step on each execution. The runtime does not register blocked-sensitive capabilities.

The runtime unregisters tools when permission disappears, scope stops matching, the person disables the tool, or a revision becomes stale. It restores eligible tools after reload and same-origin navigation.

## Failure and repair

A structured failure records:

- Tool name and revision.
- Failed step.
- Current path.
- Target candidates attempted.
- Failure code.
- Bounded visible outcome.
- Actions completed before failure.
- Whether the workflow may have changed external state.

The bootstrap protocol exposes failures to the agent. The agent can inspect the current page and propose a replacement. The person reviews the replacement, and the verifier checks it under the same policy as a new capability.

The repository retains the last verified revision until a replacement passes. A failed repair cannot replace working history.

## Error model

The extension uses stable codes with a safe next action:

- `PERMISSION_REQUIRED`
- `SESSION_LIMIT_REACHED`
- `RISK_CONFIRMATION_REQUIRED`
- `SENSITIVE_TARGET_BLOCKED`
- `TARGET_MISSING`
- `TARGET_AMBIGUOUS`
- `ROUTE_MISMATCH`
- `NAVIGATION_INTERRUPTED`
- `EXPECTED_EFFECT_MISSING`
- `OUTPUT_LIMIT_EXCEEDED`
- `STALE_REVISION`

Errors can recommend a fresh inspection, human handoff, return to the expected route, reviewed repair, or stop. They cannot instruct the agent to weaken policy.

## Storage and privacy

The extension uses `chrome.storage.local` and keys capabilities by exact origin, path scope, and tool name. It stores:

- Capability definitions and revisions.
- Enabled state and health.
- Selector evidence.
- Provenance summaries.
- Verification records.
- Bounded failures.
- Active session continuation state.

It does not store page snapshots, credentials, cookies, complete agent conversations, or browsing history. Trace and observation limits apply before serialization.

The extension sends no telemetry or workflow data to Kibalo Jules Tinaka or another remote service. It processes website content, form data, route information, and interactions on the user's device because those inputs are required to record, inspect, verify, and replay workflows.

Tool-pack import and export remain available. The merged extension can import an existing Adaptive WebMCP tool pack when every action and schema passes the new validator. It will not migrate old extension storage or modify either prototype.

## Official website and compliance

The canonical website origin is `https://webmcp-forge.jules-tnk.com`.

### Routes

- `/`: product homepage and extension single-purpose disclosure.
- `/how-it-works`: Manual, Automatic, and Hybrid learning.
- `/install`: Chrome Web Store release status and installation disclosure.
- `/lab/guide`: guided deterministic demonstration.
- `/lab/workflow`: deterministic learning fixture.
- `/lab/evidence`: evidence and limitations.
- `/privacy`: Privacy Policy.
- `/terms`: Terms of Service.
- `/support`: support instructions and contact email.

The first Chrome Web Store link must state in readable text that the user will install a Chrome extension and that its single purpose is to teach, discover, verify, and reuse browser workflows as WebMCP tools. Until the Store URL exists, `/install` shows `Chrome Web Store release in progress` and collects no email address.

Every website page includes links to Privacy, Terms, Support, and the MIT license. Until a public repository exists, it shows `Source repository release in progress` without a link. The site also publishes canonical metadata, social-preview metadata, `robots.txt`, and `sitemap.xml`.

### Privacy Policy requirements

The Privacy Policy names **Kibalo Jules Tinaka** as the individual publisher and data controller and provides `julestnk.dev@gmail.com` as the contact address. It explains:

- Website content, form data, route information, and interactions processed by the extension.
- Capability definitions, traces, selector evidence, revisions, verification, and bounded failures stored in `chrome.storage.local`.
- Sensitive values that the extension blocks.
- Absence of remote telemetry, analytics, advertising, tracking cookies, accounts, and data sales.
- Local retention, user deletion controls, import/export behavior, security boundaries, policy changes, and contact rights.
- Chrome Web Store Limited Use compliance.
- Standard request and security logs that Google Firebase Hosting may process.

The website uses classic Google Firebase Hosting with Analytics and every other Firebase product disabled. The Privacy Policy must name Google/Firebase as the hosting provider and describe standard request and security logs. Reconfirming Firebase's current subprocessors and terms remains a publication gate.

### Terms of Service requirements

The Terms name **Kibalo Jules Tinaka** as publisher, use Moroccan law as the governing law, and preserve mandatory consumer protections. They cover eligibility, the under-13 restriction, acceptable use, workflow and agent responsibility, consequential-action confirmations, third-party websites, selector compatibility, intellectual property, the MIT-licensed source, availability, warranty disclaimers, liability limits, suspension, termination, changes, and contact.

The website presents the Privacy Policy and Terms as release-ready drafts that require professional legal review before publication.

### Chrome Web Store release requirements

The release package includes:

- Accurate single-purpose listing copy.
- Permission justifications for `scripting`, `storage`, `tabs`, `sidePanel`, and optional site access.
- A privacy-practices questionnaire draft consistent with runtime behavior and website policy.
- Official website, privacy, and support URLs on `webmcp-forge.jules-tnk.com`.
- Extension icon files, at least one current 1280x800 screenshot, and a 440x280 promotional tile.
- A production ZIP generated without changing the source manifest.

## User experience

### Side panel

Clicking the toolbar icon opens the side panel directly. The side panel contains five sections:

The panel is tab-specific rather than window-global. Switching away from a tab hides its panel; returning to that tab restores the same panel. Selected section and workflow goal are persisted by tab ID so state also survives panel recreation. Same-tab navigation refreshes the bound origin and path without leaking another tab's state.

1. **Site**: current origin, permission status, and enable or disable action.
2. **Session**: goal, mode, current actor, route, trace, risk boundary, pause, stop, and handoff.
3. **Review**: capability contract, provenance, target evidence, risk, approval, and verification.
4. **Tools**: active, paused, stale, and draft tools with inspect, disable, export, repair, and delete actions.
5. **Evidence**: trace, verification attempts, execution history, failures, repairs, and revision comparison.

The panel exposes explicit states: recording, agent exploring, waiting for confirmation, awaiting review, verifying, active, paused, failed, and stale.

### Public website and lab

The official website will explain Manual, Automatic, and Hybrid learning, architecture, safety, privacy, permissions, installation, support, and evidence. The deterministic lab will cover all three learning modes, reuse, route continuation, stale-target detection, and repair.

The lab will reuse the merged extension schemas and runtime modules where the browser boundary permits. The website remains a presentation and test surface rather than a separate workflow engine.

## Testing

The project will not add component-level UI tests. Browser journeys will validate direct side-panel entry, site settings, the remaining panel sections, official website routes, policy links, installation disclosure, and lab.

### Domain tests

Tests cover:

- Session state and provenance.
- Capability and trace schemas.
- Sensitive-target redaction.
- Risk classification and execution gates.
- Selector ranking and ambiguity.
- Route continuation.
- Workflow execution and cancellation.
- Verification-state accuracy.
- Repository revision rules.
- Bridge envelope validation.
- Tool-pack compatibility.

### Loaded-extension browser tests

Playwright journeys cover:

- Site permission and bootstrap discovery.
- Manual learning.
- Automatic exploration.
- Hybrid handoff.
- Human review and replay.
- Same-origin route continuation.
- Reload restoration.
- Consequential-action confirmation.
- Stale-target diagnosis and reviewed repair.

### Native WebMCP evidence

The submission will record separate native browser evidence for:

- The controlled lab in Manual, Automatic, and Hybrid modes.
- One unmodified, terms-compatible public website learned through Automatic mode; Wikipedia is the selected candidate.
- A YouTube read-oriented Hybrid workflow only after written permission or another documented exception under YouTube's current Terms.
- Real-site reload restoration.
- Real-site stale-target failure and reviewed repair.

Live public websites will not become CI dependencies. Each manual evidence record will include the browser version, extension build, date, goal, trace summary, verification state, and screen recording reference.

The team will choose the second public website after a compatibility assessment of semantic markup, route behavior, sensitive actions, and test reproducibility.

## Challenge demonstration

The submission demo should show:

1. An unfamiliar agent discovers `capability_forge` and calls `inspect`.
2. A person teaches part of a workflow.
3. The agent explores and completes the same session.
4. The side panel shows mixed provenance.
5. The person reviews and approves the capability.
6. The verifier replays the safe workflow.
7. The agent reuses the registered tool after reload.
8. A changed target produces a structured failure and reviewed repair.

The deterministic lab provides reproducible evidence. The public-site run demonstrates that the extension works outside its fixture.

## Completion criteria

The merged prototype is complete when:

- An unfamiliar WebMCP agent discovers the protocol without a pasted prompt.
- Manual, Automatic, and Hybrid sessions produce the same capability contract.
- The system preserves provenance for each event.
- The agent completes a bounded automatic exploration without native browser-control assumptions.
- A same-origin route-changing workflow resumes in the current tab.
- The person can inspect and approve the complete contract.
- Verification states match the evidence collected.
- A verified tool returns after reload.
- A stale target produces a structured failure.
- A reviewed repair activates without displacing working history on failure.
- The extension blocks sensitive targets and agent-supplied executable code.
- Automated domain and loaded-extension suites pass.
- Native WebMCP evidence covers the lab and at least one terms-compatible public site. YouTube compatibility is not claimed without a documented permission basis.
- The official website builds with canonical metadata, Terms, Privacy, Support, Install, and deterministic lab routes.
- Website and Store disclosures match extension behavior and permissions.
- Google Firebase Hosting and its current log/subprocessor handling appear in the final Privacy Policy before publication.
- The Store release package contains the required icon, screenshot, promotional tile, permission justifications, and production ZIP.

## Approved decisions

- Use a modular hybrid extension architecture.
- Use WebMCP Capability Forge as the official name.
- Build the merged product in `experiments/webmcp-capability-forge`.
- Keep both existing prototypes unchanged.
- Use the side panel as the primary workspace.
- Combine human and agent evidence in one immutable trace.
- Expose bounded temporary exploration tools.
- Support current-tab same-origin navigation in version one.
- Use local storage without a backend.
- Preserve import compatibility when the new validator accepts the tool pack.
- Use browser-level tests for UI instead of component tests.
- Publish the official website at `webmcp-forge.jules-tnk.com` on classic Firebase Hosting and keep the deterministic lab under `/lab/*`.
- Publish as the individual Kibalo Jules Tinaka with `julestnk.dev@gmail.com` as the public contact.
- Use Moroccan governing law and an under-13 restriction.
- Keep the website and extension free of analytics, advertising, tracking cookies, accounts, telemetry, and remote workflow storage for the first release.
- Publish English-only Terms, Privacy, Support, install disclosure, and source/MIT links.
