# Autonomous Reuse, Repair, and Hardening Implementation Plan

**Status:** Complete in the local workspace on 2026-08-29.

**Goal:** Complete Phases 2 through 4 of the approved capability lifecycle remediation design after the Golden Manual lifecycle.

**Spec:** `docs/superpowers/specs/2026-08-29-complete-capability-lifecycle-remediation-design.md`

## Task 1: Autonomous agent entry and mixed provenance

- [x] Expand `capability_forge` with operation-specific fields.
- [x] Start Automatic learning from the trusted page sender and agent task goal.
- [x] Persist successful `forge_interact` events in the background session.
- [x] Derive Hybrid mode when Human and Agent events share one trace.
- [x] Finalize an agent trace through the same durable Review pipeline.
- [x] Prove autonomous and mixed-provenance journeys in loaded Chromium.

## Task 2: Trusted learned-tool reuse

- [x] Register eligible active definitions through `LearnedToolRuntime`.
- [x] Send only tool name and inputs from the page runtime.
- [x] Load the authoritative active definition in the background.
- [x] Validate scope and inputs before packaged content execution.
- [x] Persist outcomes and update health after failures.
- [x] Restore and invoke a learned tool after reload.

## Task 3: Failure, navigation continuation, and reviewed repair

- [x] Create same-origin checkpoints before navigation workflows and resume them on PageReady.
- [x] Mark missing-target failures stale without deleting working history.
- [x] Expose failures through bootstrap inspection and Evidence.
- [x] Start repairs through `request_repair`.
- [x] Compile a new revision from a fresh Changed DOM trace.
- [x] Keep failed replacements from superseding the active revision.
- [x] Prove Changed DOM failure, reviewed revision 2, and successful reuse.

## Task 4: Extension-owned confirmation

- [x] Persist expiring confirmation requests in `chrome.storage.local`.
- [x] Ignore agent-provided confirmation booleans.
- [x] Show action, origin, path, effect, and target in Review.
- [x] Consume a matching side-panel approval once.
- [x] Prove that the action does not run before approval and resumes after approval.

## Task 5: Tool management and evidence

- [x] Add enable, disable, export, reviewed import, and explicit delete actions.
- [x] Support current Capability Forge and legacy Adaptive WebMCP tool packs.
- [x] Render chronological trace, proposal decisions, confirmation decisions, verification attempts, failures, outcomes, and revision lineage.
- [x] Prove disable/enable, export/delete, and reviewed import in loaded Chromium.

## Task 6: Hardening and release evidence

- [x] Apply session expiry on reads and scheduled alarms.
- [x] Pause collecting sessions when their tab closes.
- [x] Reject silent replacement of an active collecting session.
- [x] Add message-specific payload validation for every retained bridge message.
- [x] Reconcile the Session UI, website source, Store copy, reviewer instructions, README, and status files.
- [x] Run `pnpm verify`: 31 core tests and 60 extension tests pass.
- [x] Run `pnpm test:e2e`: 25 journeys pass across desktop and mobile; one duplicate mobile Store screenshot is intentionally skipped.
- [x] Rebuild `output/webmcp-capability-forge-extension.zip`.

No commit, deployment, Store upload, or challenge submission is included.
