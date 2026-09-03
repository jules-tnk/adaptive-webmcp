# Capability Forge Home and Tabbed Lab Design

## Summary

Capability Forge will separate project explanation from prototype operation. A new homepage at `/` will explain the problem, human-agent value, technical architecture, safety boundaries, and common questions for a mixed audience. The lab will use three shareable nested routes—Workflow, Review, and Evidence—under one persistent session provider.

## Goals

- Make the difference between the project, the test fixture, and capability revisions immediately understandable.
- Give judges and developers a concise homepage with an obvious path into the working prototype.
- Give every lab section a shareable URL and one clear job.
- Preserve catalog, teaching, proposal, revision, metrics, repair, and WebMCP state while navigating between lab tabs.
- Keep learned-tool execution bound to the visible Workflow surface.
- Preserve the approved institutional editorial visual system and all implemented security constraints.

## Non-goals

- No authentication, backend, cloud persistence, benchmark claims, or deployment work.
- No changes to the automatic-tool-extension prototype.
- No hidden catalog DOM to support execution on non-Workflow pages.
- No new workflow actions or expanded capability permissions.

## Routes

```text
/                  HomePage
/lab               Navigate to /lab/guide
/lab/guide         LabGuidePage
/lab/workflow      WorkflowPage
/lab/review        ReviewPage
/lab/evidence      EvidencePage
*                  Navigate to /
```

`LabLayout` remains mounted while child routes change. It owns `LabSessionProvider`, the product header, and the sticky tab navigation. Direct loading, refresh, browser back/forward, and copied links must work for every route.

## Homepage

The homepage contains no WebMCP tool registration. Its sections are:

1. Dark full-bleed hero with project name, one-sentence explanation, primary `Open the Lab` link to `/lab/workflow`, and secondary architecture anchor.
2. Problem/value section explaining repeated browser rediscovery and the reviewed capability lifecycle.
3. Five-step lifecycle: Teach, Model, Review, Verify, Reuse.
4. Technical architecture covering the five stable forge tools, declarative workflow schema, origin/path scope, local revision storage, AbortSignal registration lifecycle, preflight, and replay.
5. Safety section covering bounded actions, no generated JavaScript, human approval, output limits, and visible replay.
6. FAQ implemented with native `details`/`summary` elements:
   - What is Capability Forge?
   - What is WebMCP?
   - How does teaching work?
   - Does it execute generated JavaScript?
   - What requires human approval?
   - Where are capabilities stored?
   - What happens when a website changes?
   - How can the prototype be tested?
7. Final CTA linking to `/lab/workflow`.

Copy must distinguish implemented behavior from unmeasured claims. It must not mention Coinbase or use generic trading content.

## Lab information architecture

### Workflow `/lab/workflow`

- Dark operational hero and live WebMCP state.
- Fixture state labelled `Baseline DOM` and `Changed DOM`; the ambiguous `v1`/`v2` labels disappear from user-facing controls.
- Catalog search, results, shortlist, teaching start/stop, and trace summary.
- Verified compiled tools are registered only while this route has a visible lab root.

### Lab Guide `/lab/guide`

- First and default lab tab.
- Plain-language setup, end-to-end walkthrough, sample agent prompt, direct tab links, and success checklist.
- Guides judges and new visitors without duplicating advanced architecture documentation.

### Review `/lab/review`

- Selected proposal or revision contract.
- Scope, classification, inputs, workflow, expected effect, and status.
- Approval/rejection actions.
- Preflight failure, repair guidance, and revision history.
- Empty state links back to Workflow.

Successful `forge_propose_capability` and `forge_open_review` calls navigate here. `Approve and verify` transitions to Workflow for visible replay, completes verification when the lab root mounts, then returns to Review with the final state.

### Evidence `/lab/evidence`

- First-run/reuse metrics with explanatory labels.
- Current preflight, replay, and repair status.
- Evidence-bound note explaining that values are local-session prototype measurements, not general performance claims.

## Persistent session provider

`LabSessionProvider` owns:

- `LabStore`
- `MetricsStore`
- `CapabilityRepository`
- fixture version
- current lab container/root
- teaching recorder and trace
- selected revision
- revision refresh counter
- preflight failure
- pending verification
- forge and compiled-tool registrations

`useLabSession()` exposes a typed context to route pages. Navigating tabs does not recreate stores or discard trace, proposal, metrics, or selected revision state. Leaving Workflow during an active recording stops the recorder and preserves the resulting trace.

## WebMCP behavior

- No forge tools are registered on `/`.
- Five stable forge tools are registered by `LabSessionProvider` on every `/lab/*` route.
- `forge_start_teaching` and `forge_run_preflight` return `WORKFLOW_TAB_REQUIRED` with `/lab/workflow` guidance when the visible lab root is unavailable.
- `forge_get_trace`, `forge_propose_capability`, and `forge_open_review` remain useful across lab tabs.
- Verified compiled tools register only when `/lab/workflow` has a visible lab root and unregister when that root unmounts.
- Capability definitions use scope pathname `/lab/workflow` instead of `/lab`.
- Proposal creation and review opening navigate to `/lab/review`.

## Error handling

- Unknown routes redirect to `/`.
- `/lab` redirects to `/lab/workflow`.
- Direct Review access without a proposal shows an empty state and Workflow link.
- Approval without a valid revision returns without state mutation.
- Replay failure remains visible on Review after the provider returns from Workflow.
- Learned-tool execution is unavailable outside Workflow because the tool registration is removed, not because it targets hidden DOM.

## Visual and interaction design

- Preserve the existing near-black, white, soft-gray, Coinbase Blue, pill, 24px radius, display-weight, and mono-number system.
- Homepage uses dark hero, white/soft editorial bands, divider-led technical content, and native FAQ disclosure controls.
- Lab tabs are sticky below the header, keyboard accessible, use real links, show `aria-current="page"`, and scroll horizontally on mobile.
- Workflow, Review, and Evidence pages each have one dominant task and no forced single-page stacking.
- Existing reduced-motion behavior remains.

## Testing

- No component-level UI tests. Homepage, tabs, routes, responsive behavior, and visible state are validated through Playwright.
- Logic tests cover provider Workflow-required errors and proposal navigation.
- Domain tests cover schema scope, registration lifecycle, execution, persistence, recording, preflight, and replay.
- Playwright journeys start at `/lab/workflow`, navigate to Review for approval, return through visible replay, inspect Evidence, test reload restoration, switch to Changed DOM, and verify repair.
- Desktop and mobile projects retain overflow and console checks.
