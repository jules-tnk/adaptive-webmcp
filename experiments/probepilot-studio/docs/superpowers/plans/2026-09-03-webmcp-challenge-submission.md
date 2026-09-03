# WebMCP Challenge Submission Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a coherent, verifiable ProbePilot Studio submission whose live app, public repository, documentation, demo video, and Devpost entry all describe the same tested release.

**Architecture:** Treat the local ProbePilot tree as the release source of truth. Build and test it before deploying the resulting `dist` directory to its dedicated Firebase Hosting site, then expose the matching GitHub revision publicly and use a single checked submission document to populate Devpost.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, pnpm, Firebase Hosting, GitHub Actions, Devpost, YouTube.

**Spec:** Official WebMCP Challenge requirements at https://webmcp.devpost.com/

## Global Constraints

- The live URL must work without authentication in ChatGPT's in-app browser and WebMCP-enabled Chrome.
- The public repository must include source, assets, setup instructions, and a repository-level open-source license.
- The demo video must be public on YouTube, under three minutes, include audio, and show both the product and WebMCP use.
- Submission copy must explain WebMCP fit, UX improvement, human-agent collaboration, and implementation.
- Preserve unrelated work and do not create a branch or worktree.
- Do not commit or push until the user explicitly authorizes that exact Git operation.
- Stop before the final Devpost submission action and request action-time confirmation.

---

### Task 1: Complete the public release documentation

**Files:**
- Create: `LICENSE`
- Create: `experiments/probepilot-studio/docs/submission.md`
- Modify: `README.md`
- Modify: `experiments/probepilot-studio/README.md`

**Interfaces:**
- Consumes: verified live URL, public YouTube URL, application run commands, and the nine-tool WebMCP contract.
- Produces: repository-visible license metadata and one source of truth for the Devpost fields.

- [ ] **Step 1:** Add the MIT license at repository root so GitHub can detect it.
- [ ] **Step 2:** Add the public video and submission links to both README entry points.
- [ ] **Step 3:** Write the complete English Devpost copy with no placeholders.
- [ ] **Step 4:** Run `git diff --check` and inspect every documentation diff.

### Task 2: Verify and deploy the release build

**Files:**
- Verify: `experiments/probepilot-studio/src/**`
- Verify: `experiments/probepilot-studio/dist/**`
- Verify: `experiments/probepilot-studio/firebase.json`

**Interfaces:**
- Consumes: the current local application and lockfile.
- Produces: one tested Vite build deployed to `probepilot-jules-tnk`.

- [ ] **Step 1:** Run `pnpm test` and require all test files and tests to pass.
- [ ] **Step 2:** Run `pnpm typecheck`.
- [ ] **Step 3:** Run `pnpm build`.
- [ ] **Step 4:** Deploy only the `probepilot` Firebase Hosting target.
- [ ] **Step 5:** Verify the custom and default Hosting URLs return the current app and security headers.

### Task 3: Publish the exact source revision

**Files:**
- Stage: all intended ProbePilot release files plus repository documentation and license.

**Interfaces:**
- Consumes: the green Task 2 tree.
- Produces: a public GitHub repository whose default branch matches the deployed application.

- [ ] **Step 1:** Inventory the exact staged paths and exclude generated video artifacts.
- [ ] **Step 2:** Obtain explicit user authorization for the commit and push.
- [ ] **Step 3:** Commit in the repository's existing conventional style and push `main`.
- [ ] **Step 4:** Wait for ProbePilot CI and require a successful conclusion.
- [ ] **Step 5:** Change repository visibility to public and verify anonymous access plus detected MIT license.

### Task 4: Complete the Devpost entry

**Files:**
- Read: `experiments/probepilot-studio/docs/submission.md`

**Interfaces:**
- Consumes: verified live, repository, and video URLs.
- Produces: a fully populated WebMCP Challenge submission.

- [ ] **Step 1:** Open the entrant's existing Devpost challenge submission form.
- [ ] **Step 2:** Populate every required field from `docs/submission.md`.
- [ ] **Step 3:** Attach the public video, live app, and public source URLs.
- [ ] **Step 4:** Review the rendered submission and all required declarations.
- [ ] **Step 5:** Request action-time confirmation, submit, and verify the submitted project page.
