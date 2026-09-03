# Permission Justifications

Reconcile this file against the production manifest before uploading an item. Remove permissions that the finished extension does not use.

## `scripting`

Capability Forge uses `scripting` to inject packaged recorder, explorer, bridge, and WebMCP runtime files into a site that the user enables. It does not inject agent-generated code.

## `storage`

Capability Forge uses `storage` to retain approved capability definitions, revisions, enabled state, verification records, bounded traces, and failure summaries in Chrome local storage.

## `tabs`

Capability Forge uses `tabs` to identify the enabled tab, track its current route and lifecycle, restore scope-matching tools, and coordinate the side panel with the active document.

## `sidePanel`

Capability Forge uses `sidePanel` to display learning controls, the combined trace, human review, risk confirmations, saved tools, verification evidence, and repairs beside the active website.

## Optional HTTP/HTTPS host access

Capability Forge requests optional HTTP/HTTPS host access only after the user selects **Enable on this site**. The access lets packaged content and runtime scripts inspect and execute reviewed workflows on that host. The production manifest must not require broad host access at install time.

## Remote code

No remote code. The extension packages all executable JavaScript and CSS. Tool definitions, imported packs, page content, and AI-agent proposals remain validated declarative data and are never evaluated as code.
