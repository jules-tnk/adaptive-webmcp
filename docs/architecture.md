# Proposed Architecture

## Product boundary

The hackathon product should learn and reuse one workflow on one unsupported website. The extension owns the safe runtime. The agent proposes semantic tools through a constrained bootstrap interface, and the extension decides whether those tools can run.

```text
┌─────────────────────────────────────────────────────────────┐
│ WebMCP-aware browser agent                                  │
│                                                             │
│ explores once, proposes tool specs, invokes learned tools   │
└────────────────────────────┬────────────────────────────────┘
                             │
                             v
┌─────────────────────────────────────────────────────────────┐
│ Browser extension                                           │
│                                                             │
│ bootstrap tool -> validator -> compiler -> safe executor    │
│                         |                    |                │
│                         v                    v                │
│                    local registry       telemetry            │
└────────────────────────────┬────────────────────────────────┘
                             │
                             v
┌─────────────────────────────────────────────────────────────┐
│ Current website                                             │
│                                                             │
│ DOM / accessibility tree / existing frontend and backend    │
└─────────────────────────────────────────────────────────────┘
```

## Core components

### Bootstrap registration tool

The extension exposes one initial capability to the agent. It accepts a declarative tool specification, validates it, stores it under the current origin, and registers the resulting WebMCP tool.

The bootstrap tool must not accept source code or function bodies.

### Declarative workflow DSL

The first version needs a small action set:

- `fill`: set a value on an allowed input
- `click`: activate an allowed element
- `waitFor`: wait for a page condition with a fixed timeout ceiling
- `extract`: return bounded text or structured attributes

Each step can use declared tool inputs through references such as `$query`. The compiler should reject unknown actions, undeclared variables, malformed selectors, cross-origin navigation, and unbounded extraction.

Example:

```json
{
  "name": "search_products",
  "description": "Search the product catalog",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": { "type": "string" }
    },
    "required": ["query"]
  },
  "workflow": [
    {
      "action": "fill",
      "selector": "input[name=q]",
      "value": "$query"
    },
    {
      "action": "click",
      "selector": "button[type=submit]"
    },
    {
      "action": "waitFor",
      "selector": "[data-search-results]"
    }
  ]
}
```

### Validator and compiler

The validator checks the JSON schema, origin binding, allowed actions, permissions, selector shape, input references, and execution limits. The compiler converts an accepted workflow into a WebMCP registration backed by the extension's executor.

### Site-scoped registry

The registry keys tools by origin, path match, tool name, and format version. It stores the declarative manifest and validation metadata. It should not store executable JavaScript.

On page load, the extension selects compatible tools, runs lightweight preflight checks, and registers tools that still satisfy their preconditions.

### Dashboard

The companion interface should show:

- learned tools and their input schemas
- matched origins and paths
- workflow steps and requested permissions
- validation or preflight failures
- first-run and reuse measurements
- import and export controls

The dashboard supports the product story. It does not need to become a general registry during the hackathon.

## Runtime lifecycle

```text
FIRST VISIT

load page
  -> expose bootstrap tool
  -> agent explores the page
  -> agent completes one useful task
  -> agent proposes a declarative tool
  -> extension validates and compiles it
  -> user/browser approves sensitive permissions when required
  -> extension stores and registers the tool
```

```text
LATER VISIT

load matching page
  -> extension loads stored tool definitions
  -> preflight selectors and conditions
  -> register valid tools
  -> agent invokes a semantic tool
  -> executor performs bounded steps
  -> return a structured result and telemetry
```

## Portable tool-pack format

The portable artifact should remain declarative and reviewable:

```json
{
  "format": "adaptive-webmcp-toolpack",
  "version": 1,
  "site": {
    "origin": "https://example.com",
    "match": ["/products/*"]
  },
  "permissions": ["dom:read", "dom:interact"],
  "tools": [],
  "validation": {
    "createdAt": "2026-08-26T00:00:00Z",
    "browser": "record-the-tested-browser-build-here"
  }
}
```

Import sequence:

```text
parse JSON
  -> validate format and version
  -> enforce exact origin and path scope
  -> display requested permissions
  -> preflight selectors and conditions
  -> register accepted tools
```

The importer must reject executable code, unknown capabilities, unsupported versions, invalid origins, and manifests that exceed resource limits.

## Security boundaries

- Bind each tool to an explicit origin and path pattern.
- Keep the workflow action vocabulary small and allowlisted.
- Put time, step-count, output-size, and navigation limits on every run.
- Require a clear approval path for purchases, messages, deletion, account changes, and other consequential actions.
- Record who or what created and imported each tool pack.
- Surface tool definitions and permissions for review before installation.
- Revalidate tools after imports, browser changes, and repeated execution failures.
- Keep authentication inside the live browser session; never export cookies, tokens, or page data in a tool pack.

## Demo architecture

The demo needs one supported path:

```text
Browser profile A
  -> agent explores unsupported site
  -> extension learns search_items(query)
  -> export tool pack

Browser profile B
  -> import tool pack
  -> open matching site
  -> agent sees search_items(query)
  -> run task without exploration
```

Record browser operations, context usage, elapsed time, and outcome for both runs. These measurements turn the concept into a testable claim.

## Deferred work

Keep these outside the first vertical slice:

- automatic selector repair
- network-level workflow synthesis
- multi-site generalization
- collaborative or public registry
- signatures and publisher trust
- organization-wide policy management
- marketplace or monetization features
