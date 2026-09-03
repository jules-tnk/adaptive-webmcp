# Golden Manual Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect Manual recording to durable drafting, Review, approval, verification, and an active capability record.

**Architecture:** The background session repository becomes authoritative. Manual events append through typed bridge messages, `TraceCompiler` creates a deterministic declarative draft, and a storage-backed proposal repository survives service-worker or panel recreation. Stop finalizes the session and pushes the panel to Review without reload.

**Tech Stack:** TypeScript 6, Zod 4, React 19, Chrome Manifest V3, chrome.storage.local, Vitest 4, Playwright 1.62, pnpm.

**Spec:** `docs/superpowers/specs/2026-08-29-complete-capability-lifecycle-remediation-design.md` Phase 1.

## Global Constraints

- Remove the Automatic and Hybrid start buttons; keep `LearningMode` as internal provenance metadata.
- Do not add UI component tests.
- No `any`, `unknown`, or string-literal unions.
- Every new deterministic string set uses an enum.
- Keep generated artifacts declarative and packaged-code-only.
- Do not create a branch, worktree, commit, deployment, Store upload, or submission.

---

### Task 1: Deterministic trace compiler

Execution status: Complete.

**Files:**
- Create: `experiments/webmcp-capability-forge/packages/core/src/compiler/trace-compiler.ts`
- Create: `experiments/webmcp-capability-forge/packages/core/src/compiler/trace-compiler.test.ts`
- Modify: `experiments/webmcp-capability-forge/packages/core/src/index.ts`

**Interfaces:**
- Consumes: `LearningSession`, `TraceEvent`, `RiskPolicy`, workflow contracts.
- Produces: `TraceCompiler.compile(input: TraceCompilerInput): ValidationResult<CapabilityDefinition>`.

- [ ] Write failing tests for empty-trace rejection and conversion of Fill, Select, and Click events into a revision-1 capability with two required inputs, exact origin/path scope, human provenance count, Proposed verification, and final target-visible expected effect.
- [ ] Run `pnpm --filter webmcp-capability-forge-core test -- src/compiler/trace-compiler.test.ts`; expect RED because `TraceCompiler` is absent.
- [ ] Implement `TraceCompilerInput`, deterministic goal slugging, unique path/input collection, event-to-step conversion, provenance derivation, classification with `RiskPolicy.classify`, and validation with `CapabilityValidator.validate`.
- [ ] Export the compiler from `packages/core/src/index.ts`.
- [ ] Run the focused compiler test and core typecheck; expect GREEN.

The compiler must produce this value shape:

```ts
{
  schemaVersion: 1,
  name: normalizedGoal,
  title: session.goal,
  description: `Replay the reviewed workflow: ${session.goal}`,
  scope: { origin: session.origin, pathPatterns },
  inputSchema: {
    type: JsonSchemaType.Object,
    properties,
    required,
    additionalProperties: false,
  },
  classification: RiskPolicy.classify(draft),
  steps,
  expectedEffects: [{ kind: ExpectedEffectKind.ElementVisible, target: finalTarget }],
  provenanceSummary,
  verification: { status: VerificationStatus.Proposed, attempts: [] },
  revision: input.nextRevision,
}
```

### Task 2: Live Manual trace append

Execution status: Complete.

**Files:**
- Modify: `packages/core/src/contracts/protocol-contracts.ts`
- Modify: `extension/src/bridge/bridge-envelope.ts`
- Modify: `extension/src/bridge/bridge-envelope.test.ts`
- Modify: `extension/src/content/manual-recorder.ts`
- Modify: `extension/src/content/manual-recorder.test.ts`
- Modify: `extension/src/content/content-controller.ts`
- Modify: `extension/src/content/index.ts`
- Modify: `extension/src/background/chrome-platform.ts`

**Interfaces:**
- Produces: `BridgeMessageType.SessionAppend` and `BridgeMessageType.SessionStop`.
- Produces: `ManualTraceSink.append(event: TraceEvent): Promise<void>`.
- Changes: `ManualRecorder.stop(): Promise<void>` flushes queued appends.

- [ ] Add failing bridge tests requiring strict `{ tabId, event }` SessionAppend and `{ tabId }` SessionStop payloads.
- [ ] Add a failing ManualRecorder test whose async sink receives recorded events in order and is fully flushed before `stop()` resolves.
- [ ] Run focused tests; expect RED.
- [ ] Add `SchemaCatalog.parseTraceEvent(value: JsonValue): ValidationResult<TraceEvent>` using the existing `traceEventSchema`. In `BridgeEnvelopeCodec.payloadMatches`, require SessionAppend to contain a numeric tab ID and an event accepted by `parseTraceEvent`; require SessionStop to contain only a numeric tab ID.
- [ ] Add `ManualTraceSink`, queue appends inside ManualRecorder, and make stop asynchronous.
- [ ] Configure the content runtime sink to send SessionAppend to background.
- [ ] Handle SessionAppend by loading the tab session, appending through `SessionMachine.append`, and saving it before responding.
- [ ] Make the content ManualStop handler await listener shutdown and return `{ ok: true }` instead of a second session copy.
- [ ] Run focused recorder, bridge, and session tests; expect GREEN.

### Task 3: Durable proposals

Execution status: Complete.

**Files:**
- Create: `extension/src/storage/proposal-repository.ts`
- Create: `extension/src/storage/proposal-repository.test.ts`
- Modify: `extension/src/background/proposal-coordinator.ts`
- Modify: `extension/src/background/proposal-coordinator.test.ts`
- Modify: `extension/src/background/index.ts`

**Interfaces:**
- Produces: `ProposalRepository.save(record)`, `get(requestId)`, `listPending(origin)`, and `resolve(requestId, status)`.
- Changes: `ProposalCoordinator.listPending(origin): Promise<readonly ProposalRecord[]>`.
- Adds to ProposalRecord: `sessionId`, `createdAt`, `expiresAt`.

- [ ] Write repository tests proving pending proposals survive a fresh repository instance and resolved proposals are excluded from `listPending`.
- [ ] Update coordinator tests to use repository persistence and approval-time revalidation.
- [ ] Run focused tests; expect RED.
- [ ] Implement storage parsing with concrete enum validation and `JsonCodec`.
- [ ] Refactor ProposalCoordinator to remove the in-memory timeout map, persist expiry timestamps, and revalidate on resolve.
- [ ] Pass the shared `ChromeStorageArea` repository from background/index.
- [ ] Make proposal listing asynchronous throughout ChromePlatform and BackgroundServices.
- [ ] Run focused repository/coordinator tests and extension typecheck; expect GREEN.

### Task 4: Stop, draft, and notify Review

Execution status: Complete.

**Files:**
- Modify: `extension/src/background/chrome-platform.ts`
- Modify: `extension/src/background/index.ts`
- Modify: `extension/src/storage/capability-repository.ts`
- Modify: `extension/src/storage/capability-repository.test.ts`
- Modify: `extension/src/ui/extension-client.ts`
- Modify: `extension/src/sidepanel/SidePanelApp.tsx`
- Modify: `extension/src/sidepanel/review/ReviewPage.tsx`
- Modify: `extension/src/sidepanel/SidePanelRouter.tsx`
- Modify: `packages/core/src/contracts/protocol-contracts.ts`

**Interfaces:**
- `ExtensionClient.stopSession(page)` sends SessionStop.
- SessionStop returns `{ ok, session, proposal }`.
- Review gains approve and reject handlers.

- [ ] Extend the Manual loaded-browser test to require Stop -> Review without reload and visible Human provenance; run it and verify RED.
- [ ] Add `CapabilityRepository.nextRevision(origin: string, name: string): Promise<number>` with a test proving revisions 1 and 3 yield next revision 4 for the same origin/name while another origin is ignored.
- [ ] In SessionStop: stop page listeners, load authoritative session, transition to Drafting, compile with the next revision, persist proposal, transition to AwaitingReview, save, and return both session and proposal.
- [ ] Update SidePanelApp.stop to dispatch the returned session/proposal and select Review.
- [ ] Add a Reject button and background resolution path that transitions the session to Rejected.
- [ ] Wrap stop/approve/reject busy state in `try/finally` and show a concrete panel error string.
- [ ] Run focused Manual E2E; expect Review without panel reload.

### Task 5: Approval, verification, and active Tools record

Execution status: Complete.

**Files:**
- Modify: `extension/src/background/index.ts`
- Modify: `extension/src/background/chrome-platform.ts`
- Modify: `extension/src/background/verification-coordinator.ts`
- Modify: `extension/src/sidepanel/SidePanelApp.tsx`
- Modify: `extension/src/sidepanel/tools/ToolsPage.tsx`
- Modify: `extension/e2e/manual-learning.spec.ts`

**Interfaces:**
- ProposalResolve returns `{ record, verification, session }`.
- Session transitions AwaitingReview -> Verifying -> Active or Failed.

- [ ] Extend Manual E2E to click Approve and verify, assert Verifying/Active transitions, open Tools, and require revision 1 with active status; verify RED.
- [ ] Transition and persist the session around verification.
- [ ] Preserve actual verification status in CapabilityRepository and return the final session.
- [ ] Refresh tools and switch Tools after successful approval.
- [ ] Render typed tool status/title/revision instead of only an opaque JSON blob while retaining a JSON details block.
- [ ] Run focused Manual E2E; expect GREEN through active Tools record.

### Task 6: Session UX correction and phase verification

Execution status: Complete.

**Files:**
- Modify: `extension/src/sidepanel/session/SessionPage.tsx`
- Modify: `extension/src/sidepanel/SidePanelApp.tsx`
- Modify: `extension/e2e/support/side-panel-page.ts`
- Modify: Automatic/Hybrid E2E fixtures only where they depended on removed UI buttons.
- Modify: `STATUS.md`
- Modify: `deployment/STATUS.md`

**Interfaces:**
- Side panel exposes `onStartManual()` rather than `onStart(mode)`.
- Automatic and Hybrid remain internal session values used by later agent-driven phases.

- [ ] Change loaded UI expectations to one **Teach a workflow** button and an agent activity status; verify existing three-button expectations fail.
- [ ] Remove the Automatic and Hybrid buttons and start Manual mode directly.
- [ ] Update side-panel test helpers to start Manual only; preserve lower-level Automatic/Hybrid tests until Phase 2 replaces their startup path.
- [ ] Run `pnpm verify`.
- [ ] Run `pnpm test:e2e`; the new golden Manual flow must pass on desktop/mobile, while existing non-Manual journeys must not regress.
- [ ] Regenerate the release ZIP and update exact test totals without claiming later phases complete.

No commit step is permitted in this plan.
