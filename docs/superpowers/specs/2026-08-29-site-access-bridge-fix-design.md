# Site Access Bridge Fix Design

Date: 2026-08-29

## Goal

Preserve the enabled site state across side-panel closure and reopening, and unlock Session learning modes when the workflow goal is present.

## Root cause

`ExtensionClient.siteStatus()` and `ExtensionClient.disableSite()` send `{ url, tabId }`. `BridgeEnvelopeCodec` validates `SiteStatus` and `SiteDisable` with a strict schema that accepts only `{ url }`. The background therefore rejects each status request as `BRIDGE_INVALID`. The panel interprets the error response as not enabled, and Session intentionally disables all three mode buttons.

`SiteEnable` does not exhibit the problem because its payload schema already accepts both `url` and `tabId`.

## Fix

Use one strict site-page payload schema containing:

- `url`: valid URL string;
- `tabId`: non-negative integer.

Apply it consistently to `SiteEnable`, `SiteDisable`, and `SiteStatus`. Keep the current optional-host permission flow, registration reconciliation, direct toolbar-to-panel entry, and Site tab.

## Verification

Add bridge tests that round-trip the exact `SiteStatus` and `SiteDisable` payloads emitted by `ExtensionClient`. Add a loaded-extension journey that enables the fixture origin, closes the side panel, opens a new side-panel instance, verifies Enabled remains visible, enters Session, fills a goal, and confirms all three learning-mode buttons are enabled.

No UI component tests, broad host permissions, new permission APIs, commits, or Firebase deployment are part of this fix.
