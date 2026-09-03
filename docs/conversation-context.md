# Conversation Context

## Source

- Title: `Explain WebMCP`
- Conversation ID: `6a8ec6f4-5770-83ea-bd2a-612d819c7d74`
- Local import date: 2026-08-26
- Conversation state at import: idle after five user exchanges
- Referenced event: [OpenAI WebMCP Challenge](https://openai.com/webmcp-challenge/) on [Devpost](https://webmcp.devpost.com/)

This document summarizes the retrieved conversation. The source answers contained web citations, but the import interface did not expose their resolved URLs. This repository therefore treats claims about browser support, challenge rules, and prior art as conversation-derived notes that require live verification before implementation or submission.

## Starting context

The conversation began with a request to explain WebMCP, then moved from general browser architecture to a concrete hackathon idea. The user proposed a browser extension that exposes one bootstrap tool. An AI agent would explore an unfamiliar site, use the bootstrap tool to register site-specific WebMCP tools, and reuse those tools later instead of inspecting the same HTML again.

The discussion stayed at product and system-design level. No codebase, prototype, target website, browser build, or submission artifact appeared in the conversation.

## Discussion arc

### 1. WebMCP primer

User prompt: `what is web mcp`

The answer described WebMCP as an emerging browser standard through which a webpage exposes structured, typed actions to a compatible AI agent. The agent can call actions such as `search_products`, `add_to_cart`, or `book_appointment` instead of locating controls through DOM inspection or screenshots.

The conversation distinguished browser-side WebMCP from ordinary MCP:

| Ordinary MCP | WebMCP |
|---|---|
| Connects an agent to external services and data | Connects an agent to capabilities in the current webpage |
| Commonly uses a separate MCP server | Uses a browser/page API and page JavaScript |
| Often carries separate service credentials | Can reuse the current browser session and site permissions |

The answer described WebMCP as experimental and without universal browser support as of the conversation date.

### 2. Live website implementation

User prompt: `how is it implemented and how does it work in a live website in a browser ?`

The answer proposed this runtime path:

```text
browser agent
    |
    v
browser WebMCP API
    |
    v
tool registered by page JavaScript
    |
    v
existing application service
    |
    v
existing backend
```

A page registers typed tools through a model-context API. The source discussed both `document.modelContext` and the earlier `navigator.modelContext` surface because the proposal had changed across drafts. A compatible browser exposes the tool definitions to its agent, invokes the selected tool handler, and returns structured results.

The page can register different tools as the user navigates between products, cart, and checkout. In React, registration should follow component lifecycle. The tool handler should call the same service layer as the visible interface so the product does not duplicate business logic.

The answer also separated the WebMCP contract from the AI itself: the page publishes capabilities; a WebMCP-aware browser, extension, or bridge supplies the agent that discovers and calls them.

### 3. Adaptive tool-generation idea

User prompt, condensed: build a browser extension that injects one WebMCP bootstrap tool, lets an agent explore static page elements, and lets the agent register reusable tools for later visits. The user asked whether the idea was understood, feasible, and too close to existing work.

The answer found the architecture coherent and feasible:

```text
extension injects bootstrap registration tool
        |
agent explores an unsupported site
        |
agent identifies stable actions and inputs
        |
agent submits a constrained tool specification
        |
extension validates, registers, and persists it
        |
later tasks call the semantic tool
```

The useful abstraction was described as **agent-driven incremental compilation of an unfamiliar website into a persistent semantic tool interface**. The WebMCP registry becomes executable memory for the site.

The answer warned against broad novelty claims. It named adjacent projects and approaches, including Keak `webmcp-core`, `webmcp-gen`, Brave WebMCP injection, WebMCP userscripts, and Latch. Those projects overlap with crawling, DOM or network discovery, tool synthesis, URL-matched injection, persistence, and deterministic reuse.

The proposed differentiator is narrower: a running agent receives one bootstrap capability, learns through its own successful interaction, and registers new capabilities during the live session. The conversation did not establish patent-level novelty or complete a current prior-art review.

The safety recommendation was to accept a declarative workflow specification rather than arbitrary JavaScript. The extension would own the executor, validate actions and selectors, bind tools to an origin, declare permissions, and keep high-impact operations subject to browser or user controls.

### 4. Hackathon assessment

User prompt: submit the idea to the OpenAI WebMCP Challenge and assess whether it has enough substance despite overlap with existing tools.

The answer judged the idea competitive if the implementation demonstrates an adaptive capability layer rather than a thin tool injector. The core thesis became:

> Agents should compile successful interactions into reusable WebMCP capabilities instead of relearning the same website.

The recommended hackathon scope was one polished loop:

```text
LEARN -> COMPILE -> REUSE
```

Persistence and validation belong inside that loop. Automatic repair should follow only if time remains.

The proposed demo compares a first visit, where the agent explores the page, with a later visit, where it invokes one learned tool. Useful measurements include browser operations, context tokens, elapsed time, and reliability.

The answer also recommended a small companion dashboard. The extension remains the mechanism, while the dashboard gives judges a visible place to inspect learned tools, schemas, validation status, and measured savings.

### 5. Import and export

User prompt: `another thing that i think would be useful is the possibility to import/export. what do you think ?`

The answer treated import/export as a strong addition because it changes learned tools from local cache entries into portable artifacts:

```text
agent explores site
    |
compiles tools
    |
exports tool pack
    |
another browser imports it
    |
tools are available without a second exploration pass
```

The recommended artifact was a versioned JSON manifest rather than executable JavaScript. It would carry site matching, tool schemas, workflow steps, permissions, and validation metadata. Import would validate the schema, enforce the origin, review permissions, preflight selectors or other conditions, and register only accepted tools.

A public or organization registry could grow around tool packs later. The hackathon demo should limit this idea to one format and one transfer between two browser profiles or agents.

## Conversation outcome

The discussion produced these recommended decisions:

- Position the product as an adaptive WebMCP capability layer and executable site memory.
- Prove one end-to-end workflow on one site before attempting broad coverage.
- Compile into a constrained declarative DSL; do not execute generated or imported JavaScript.
- Persist origin-scoped tools and restore them on later visits.
- Measure the difference between first-run exploration and learned reuse.
- Add a small dashboard so reviewers can inspect what the extension learned.
- Support versioned JSON import/export after the local learn-and-reuse loop works.
- Treat repair and a public registry as later layers.
- Describe neighboring projects openly and avoid claiming that automatic WebMCP generation has no prior art.

## Current progress at the end of the conversation

Completed in the discussion:

- WebMCP mental model and live-browser execution path
- product problem and value proposition
- proposed bootstrap-tool architecture
- initial prior-art comparison
- security direction
- hackathon positioning and demo outline
- import/export concept

No implementation evidence appeared:

- no repository or source files
- no browser-extension scaffold
- no manifest schema or DSL implementation
- no selected demo website or workflow
- no browser compatibility test
- no validation or permission model in code
- no dashboard
- no benchmarks
- no public deployment, demo video, or submission package

The project therefore ended the conversation at **concept defined, implementation not started**.

## Verification boundary

Before building or submitting, verify these points against current primary sources:

- the supported WebMCP API surface and tool lifecycle
- browser builds, flags, origin trials, polyfills, or extension APIs needed for the demo
- current hackathon rules, judging criteria, deadlines, and submission requirements
- the feature set and licensing of named neighboring projects
- extension-store and browser security restrictions on main-world injection and dynamic behavior
