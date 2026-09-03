# Native WebMCP Test Checklist

Record the exact Chrome version, WebMCP flag state, extension build hash, website URL, date, agent, and model.

## Latest probe

On 2026-08-29, the open public lab rendered correctly in the user's Chrome, but the controlled page context exposed neither `document.modelContext` nor `navigator.modelContext`. Native tool discovery could not run in that tab. The fake-ModelContext suite remains the verified boundary until Chrome exposes the native API and the user reloads the rebuilt unpacked extension.

## Controlled website

- [ ] Install the production ZIP in the supported Chrome build.
- [ ] Enable `https://webmcp-forge.jules-tnk.com` or the verified prelaunch origin.
- [ ] Confirm `capability_forge` appears without a pasted prompt.
- [ ] Confirm `inspect` returns phases, limits, page, sessions, tools, failures, outcomes, and next calls.
- [ ] Complete human teaching, autonomous `capability_forge` discovery, and a mixed-provenance session.
- [ ] Approve and replay-verify a safe tool.
- [ ] Reload and reuse it.
- [ ] Trigger a stale target, preserve the working revision, and approve a repair.

## Public websites

- [ ] Complete one user-initiated, low-frequency Automatic workflow on Wikipedia.
- [ ] Run YouTube Hybrid evidence only after documenting written permission or another applicable Terms exception.
- [ ] Record restoration and reviewed repair on at least one public website.

Do not mark native compatibility complete from fake ModelContext or Playwright evidence.
