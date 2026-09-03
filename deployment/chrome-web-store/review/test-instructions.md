# Chrome Web Store Reviewer Instructions

These instructions remain a draft until the production extension and public deterministic lab are complete.

## Reviewer entry

Public guide: https://webmcp-forge.jules-tnk.com/lab/guide

Do not submit these instructions until that URL returns HTTP 200 and guides a reviewer through the production extension.

## Planned test sequence

1. Install the submitted production extension package.
2. Open the public lab guide.
3. Click the extension icon to open the Capability Forge side panel.
4. Open **Site** and choose **Enable on this site**.
5. Choose **Teach a workflow** and complete the guided catalog workflow.
6. Review the captured Human provenance and proposed capability.
7. Approve and replay-verify the read or local-UI workflow.
8. Invoke the learned WebMCP tool, reload the page, and invoke it again.
9. Give an agent a task with no matching learned tool. Confirm that it starts discovery through `capability_forge` without a user-facing Automatic button.
10. Start **Teach a workflow**, then let the agent join the active session. Confirm that the mixed trace is labelled Hybrid.
11. Switch the lab to its changed-target fixture, inspect the structured failure, and approve a verified repair.

## Permission explanation

The Site tab requests optional site access from a direct user action. Packaged isolated and main-world scripts record or execute workflows and register WebMCP tools. Chrome local storage retains reviewed tools and bounded evidence. The extension uses tab and route state to restore scope-matching tools and continue same-origin sessions.

## Reviewer credentials

No account or reviewer credentials are required. The public lab must provide every test state. Do not ask reviewers to use private websites or sensitive data.

## Submission gate

Submission remains blocked until the production ZIP passes human teaching, autonomous agent discovery, mixed provenance, reload, risk confirmation, stale-target, and repair checks in loaded Chrome and native WebMCP tests.
