# Persistent Site Access Design

Date: 2026-08-29

Status: Superseded during implementation-plan review by `docs/superpowers/specs/2026-08-29-site-access-bridge-fix-design.md`. The observed persistence failure was caused by a strict bridge payload mismatch, not Chrome host-access persistence.

## Goal

Make per-site enablement survive side-panel closure and reopening while keeping HTTP/HTTPS host access optional, origin-scoped, and explicitly approved by the user. The Session learning-mode buttons must unlock only after Chrome confirms active access.

## Problem

The current flow calls `chrome.permissions.request()` and immediately combines `permissions.contains()` with dynamic content-script registration. In real Chrome, the first request displays an Allow/Deny prompt, later requests do not display it, and reopening the side panel still reports Disabled. The UI then correctly locks all learning modes because `siteEnabled` is false.

The implementation also collapses permission, registration, and background failures into one Disabled state. That hides the failing boundary and makes repeated reconciliation guesses unsafe.

## Selected approach

Use `chrome.permissions.addHostAccessRequest()` as the user-facing request mechanism. Chrome 149 is the project baseline, so the Chrome 133+ API is available. A background-owned coordinator will persist the request state, consume permission events, reconcile dynamic content registration, and expose one typed site-access state to every UI surface.

Broad required host permissions remain forbidden. `activeTab` remains absent.

## State model

Add a string enum `SiteAccessStatus` with four states:

- `Disabled`: no active Chrome permission and no pending request.
- `AwaitingApproval`: Chrome has been asked to surface a host-access request for the current tab and origin.
- `Enabled`: Chrome confirms the origin permission and the packaged content script is registered.
- `Failed`: reconciliation failed; the user receives a concise retryable diagnostic instead of a false Disabled state.

Persist one origin-scoped record in `chrome.storage.local`:

- origin;
- match pattern;
- status;
- pending tab ID when applicable;
- last failure code when applicable;
- updated timestamp.

The stored record represents Capability Forge intent and reconciliation history. Chrome permission state remains authoritative for whether execution is allowed.

## Background architecture

Create a `SiteAccessCoordinator` in the background layer. It owns:

- `SitePermissions` for Chrome permission and content-registration operations;
- a small `SiteAccessRepository` backed by the existing storage abstraction;
- current-tab injection after access becomes active;
- reconciliation triggered by messages and Chrome permission events.

The background service worker registers listeners for `chrome.permissions.onAdded` and `chrome.permissions.onRemoved`.

### Request access

When the Site tab receives **Enable on this site**:

1. Validate the active page and derive the exact scheme/host match pattern.
2. Call `chrome.permissions.addHostAccessRequest({ tabId, pattern })`.
3. Persist `AwaitingApproval` for the exact origin.
4. Return the pending state immediately; do not register scripts or unlock Session yet.
5. Show plain guidance that Chrome must approve the request.

### Approval event

When `permissions.onAdded` includes an origin matching a pending record:

1. Confirm access with `permissions.contains()`.
2. Idempotently register the packaged `content.js` script.
3. Inject the packaged content script into the matching current tab so a reload is not required.
4. Let the existing PageReady flow inject the packaged main-world runtime.
5. Persist `Enabled` and notify the side panel.

Concurrent reconciliation calls for the same origin must share one in-flight registration promise so Strict Mode or repeated events cannot create duplicate-registration races.

### Removal event

When access is removed:

1. Unregister the origin's dynamic content script.
2. Persist `Disabled`.
3. Notify the side panel.
4. Keep existing reviewed capability definitions but prevent their execution until access is enabled again.

### Reopen reconciliation

When the side panel opens:

1. Load the persisted origin record.
2. Read Chrome's active permission state.
3. If permission exists, ensure registration and return `Enabled`.
4. If permission is absent and the stored state is `AwaitingApproval`, return `AwaitingApproval`.
5. Otherwise return `Disabled`.
6. Return `Failed` with a typed failure code if Chrome permission or registration APIs reject.

No error path may silently become Disabled.

## Side-panel behavior

The Site tab displays:

- current origin;
- `Disabled`, `Awaiting Chrome approval`, `Enabled`, or `Access check failed`;
- **Enable on this site** when Disabled;
- **Cancel request** when AwaitingApproval;
- **Disable on this site** when Enabled;
- **Retry access check** when Failed.

The Session mode buttons are enabled only when:

- site access is `Enabled`;
- the workflow goal is non-empty;
- no panel operation is busy.

When access is not Enabled, Session explains the exact reason and links the user back to Site. It must not imply that an empty goal and a permission failure are the same condition.

## Bridge and type changes

- Replace the boolean site-enabled UI contract with a typed `SiteAccessStatus` response.
- Keep deterministic string values in enums.
- Add bridge events for site-access state updates rather than making the panel poll continuously.
- Preserve concrete types throughout; `any`, `unknown`, and string-literal unions remain forbidden.

## Error handling

Use typed failures for:

- unsupported or restricted URL;
- host-access request rejected by Chrome;
- permission-state read failure;
- dynamic registration failure;
- current-tab injection failure.

The background logs the underlying Chrome error for developer inspection while the UI shows a short actionable message. A registration failure must not erase a confirmed permission grant.

## Testing

No UI component tests will be added.

Add domain and integration coverage for:

- Disabled to AwaitingApproval;
- AwaitingApproval to Enabled after `onAdded`;
- Enabled surviving coordinator and panel recreation;
- concurrent reconciliation sharing one registration operation;
- `onRemoved` returning the origin to Disabled;
- failed registration preserving the confirmed permission and exposing Failed;
- Session remaining locked until Enabled.

Loaded-extension Playwright journeys will continue to use a test-granted fixture host and must verify the Site tab, direct toolbar-to-panel configuration, all learning modes, reload, and repair. A real-Chrome checklist must separately verify the native approval UI and close/reopen persistence because Playwright cannot approve Chrome's native host-access surface.

## Documentation and release artifacts

Update the manifest disclosures, permission justification, Lab Guide, reviewer instructions, and release ZIP. The official website source may be updated, but Firebase deployment remains a separate explicitly authorized action.

## Non-goals

- Required access to all websites.
- Reintroducing the old toolbar popup.
- Enabling Session based only on stored intent.
- Treating a Chrome API error as Disabled.
- Adding UI component tests.
