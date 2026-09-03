# WebMCP Capability Forge

WebMCP Capability Forge is a Manifest V3 Chrome extension and official website that turn successful browser work into reviewed, verified, reusable WebMCP tools.

## Learning paths

- **Teach a workflow:** a person starts a demonstration from the Session tab.
- **Agent discovery:** an agent calls `capability_forge` when no healthy tool fits its task.
- **Mixed provenance:** the session becomes Hybrid after both Human and Agent events enter the trace.

Every proposed capability remains declarative data. A person reviews the origin, paths, inputs, targets, actions, provenance, risk, and expected effects before activation.

## Workspace

- `packages/core`: enum-backed contracts, schemas, policy, sessions, selectors, and protocol.
- `extension`: background worker, content recorder/explorer, main-world WebMCP runtime, direct-opening side panel, site settings, storage, and browser tests.
- `website`: official product, legal, support, install, and deterministic lab routes.
- `docs`: release, privacy, Store, native-browser, demo, and comparison records.

## Commands

```powershell
pnpm install
pnpm check:rules
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Create the Store ZIP after release assets exist:

```powershell
pwsh -File scripts/package-extension.ps1
```

## Evidence boundary

Vitest covers domain and extension integration behavior. Loaded Playwright Chromium covers human teaching, autonomous agent discovery, mixed provenance, reload, sensitive targets, confirmations, stale handles, reviewed repair, tool management, and official website routes with a faithful fake ModelContext. Native Chrome/WebMCP and public-site evidence remain separate release gates.

Official website: `https://webmcp-forge.jules-tnk.com`

Publisher: Kibalo Jules Tinaka

Support: `julestnk.dev@gmail.com`

License: MIT
