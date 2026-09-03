# Data Disclosure Matrix

Use this matrix to prepare the Chrome Web Store Privacy tab. Reconcile each row against the production package before selecting dashboard checkboxes.

| Data handled | Purpose | Processing and storage | Developer access | AI agent disclosure | Retention |
| --- | --- | --- | --- | --- | --- |
| Current origin and path | Scope permission, tools, sessions, and route continuation | Processed in the extension; bounded values may be stored in Chrome local storage | The developer receives no page data | May be included in bounded session or failure context | Until the user deletes the tool/session or removes the extension |
| Visible controls and bounded website content | Inspect, teach, verify, execute, and repair workflows | Processed on the enabled page; selected evidence may be stored locally | The developer receives no page data | A connected AI agent may receive bounded observations | Bounded evidence remains until deletion or extension removal |
| Workflow interactions | Build Manual, Automatic, or Hybrid traces | Stored as bounded local trace events | The developer receives no page data | A connected AI agent may read the trace to propose a tool | Until tool/session deletion or extension removal |
| Non-sensitive form examples | Infer tool inputs and verify workflows | Processed and stored locally when policy permits | The developer receives no page data | A connected AI agent may receive a bounded input example | Until trace or tool deletion |
| Extracted results | Return requested tool output and verify expected effects | Processed in the enabled page; bounded results may enter execution evidence | The developer receives no page data | Returned to the connected AI agent as requested | Transient, except bounded verification/failure evidence |
| Capability definitions and revisions | Persist and restore reviewed WebMCP tools | Stored in Chrome local storage | The developer receives no page data | The connected agent can discover active tool contracts | Until tool deletion or extension removal |
| Verification and failure evidence | Report tool health and support reviewed repair | Stored as bounded local records | The developer receives no page data unless a user sends specific evidence for support | A connected agent may receive bounded failure evidence | Until tool deletion or extension removal |

## Data excluded by design

Capability Forge blocks passwords, payment fields, authentication codes, file inputs, generated JavaScript, cookies, and browser credential stores. The production audit must confirm these exclusions before submission.

## Dashboard approach

Disclose website content, user interactions, non-sensitive form examples, and URL/path handling conservatively even when the extension processes them only on the device. Certify Limited Use only after the production behavior matches this matrix.
