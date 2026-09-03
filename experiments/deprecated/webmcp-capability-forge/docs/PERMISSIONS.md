# Permission Justifications

WebMCP Capability Forge has one purpose: teach, discover, verify, and reuse browser workflows as reviewed WebMCP tools.

| Permission | Reason |
| --- | --- |
| `scripting` | Inject packaged recording, exploration, and WebMCP runtime files on an enabled site. |
| `storage` | Store sessions, definitions, verification, revisions, and bounded failures locally. |
| `tabs` | Coordinate the enabled tab, current origin/path, navigation checkpoints, and side panel. |
| `sidePanel` | Show teaching, review, tools, evidence, and confirmations beside the active page. |
| Optional HTTP/HTTPS host access | Run only on a site after the user grants access to that site. |

The production manifest requires no broad host permission at installation. Host access remains optional.
