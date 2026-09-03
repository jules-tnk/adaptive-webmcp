# ProbePilot project library and launchpad design

## Goal

Give ProbePilot a durable local project library, safe JSON interchange, a bounded activity record, and a launchpad that explains the product before a user enters the studio.

## Approved product decisions

- Keep the newest 100 activity entries per project.
- Save project changes automatically and show a local-save status.
- Store circuit design, project metadata, and public activity entries.
- Exclude simulation results, active bench sessions, private bench faults, selections, undo stacks, and viewport state from persistence and exports.
- Treat the deterministic demo as a template. Each opening creates a new editable project.
- Importing JSON always creates a new project ID and never overwrites an existing project.
- Add “(Imported)” only when the imported name conflicts with an existing project name.
- Confirm deletion. Deleting the active project returns the user to the project library.
- Keep all data in the current browser. No account, server, or cloud sync enters this scope.

## Architecture

### Project boundary

`ProjectRecord` is the only durable project shape. Version 1 contains:

- `schemaVersion`;
- `id`, `name`, `createdAt`, and `updatedAt`;
- one validated `CircuitDesign`;
- up to 100 `ActivityEvent` values.

The record does not contain `PublicBenchSession` or the private bench engine. Opening a saved or imported project always enters Design mode with no active simulation or bench.

### Local repository

`ProjectRepository` owns one namespaced local-storage collection. It exposes list, read, create/save, rename, duplicate, delete, import, and export operations. It sorts projects by `updatedAt` descending and uses immutable copies at the boundary.

The studio autosave bridge subscribes to durable store fields. It saves only when project name, design, or activity changes. Storage errors do not break the in-memory editor; the UI reports an error state instead of claiming the project was saved.

### Validation and JSON interchange

`ProjectCodec` validates every imported value with Zod before application logic receives it. The codec rejects malformed schema versions, invalid component kinds or properties, broken terminal references, duplicate IDs, invalid dates, and more than 100 imported activity entries. Export uses the same versioned shape and a `.probepilot.json` filename.

An import receives a new local project ID. The codec rewrites the design ID to match it, preserves the design content and revision, clears transient state, and resolves name collisions without overwriting a project.

### Studio routing

`/studio/:projectId` loads the requested durable record before rendering the workspace. Unknown IDs return to the launchpad with an explanatory notice. Creating a blank project, opening the demo template, duplicating a project, or importing JSON saves the project first and then navigates to its ID.

### Project library UI

The launchpad includes a “Your projects” working section near the first viewport. Each row shows the name, last update, component count, wire count, and activity count. Primary click opens the project. Secondary actions rename, duplicate, export, and delete it. A single Import button accepts `.json` and `.probepilot.json` files and reports validation errors in plain language.

The studio top bar shows `Saving locally`, `Saved locally`, or `Save failed`. It also exposes export and delete actions for the open project.

## Landing-page content

### Visual thesis

A precise engineering notebook on a pale circuit-grid surface: strong black type, cyan instrumentation, thin dividers, and one live circuit composition as the visual anchor. Dark mode keeps the existing instrument-bench character.

### Content plan

1. Hero: product name, promise, demo and blank-project actions, and the existing switched-LED proof panel.
2. Project library: recent local work plus import.
3. Workflow: Design, simulate, diagnose, and verify as one connected sequence.
4. Human-agent boundary: what the agent can change, what requires a person, and what the application enforces in code.
5. WebMCP explanation: the nine structured tools and why the agent does not need generic DOM automation.
6. FAQ: local storage, import/export, hidden faults, browser support, WebMCP availability, and what ProbePilot does not replace.
7. Final action: open the deterministic demo or start a blank circuit.

### Interaction thesis

- Reveal workflow stages as the reader scrolls, with reduced-motion support.
- Give project rows a short expansion transition for management actions.
- Use subtle circuit-line movement in the hero only; keep the project library still and operational.

## Activity policy

Every activity insertion uses one shared `ActivityLog.prepend` method. It retains the newest 100 values. Imported records above the limit fail validation rather than silently losing provenance. Existing projects migrate by retaining their newest 100 entries on first read.

## Error handling

- Malformed imports show one concise error and create no project.
- Storage quota or privacy errors keep the active in-memory project usable and show `Save failed`.
- Missing project routes return to the library without manufacturing a project.
- Delete requires confirmation.
- The active project cannot be overwritten through import.

## Testing

- Unit tests cover the 100-entry activity cap, repository CRUD, ordering, duplicate naming, safe import, collision handling, and export round trips.
- Store tests cover loading a project and clearing transient bench/simulation state.
- Component tests cover project-library actions and save status.
- The complete suite, TypeScript check, and production build must pass.
- Browser verification covers create, rename, reload, duplicate, export, import, delete, the 100-entry Activity panel, both themes, and responsive launchpad layout.

## Non-goals

- Cloud accounts or synchronization;
- collaboration between browsers;
- persisting or exporting private bench state;
- restoring undo/redo across reloads;
- arbitrary ECAD formats;
- mobile circuit editing.
