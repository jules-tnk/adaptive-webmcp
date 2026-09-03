# Automatic Tool Extension Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved institutional editorial design system to the unsupported-site demo and every extension-owned interface while preserving the structured bootstrap protocol and loaded-extension behavior.

**Architecture:** Share the approved token vocabulary through separate CSS roots for the Vite demo and extension package. Recompose the demo as a dark operational hero followed by a white catalog and soft evidence band; recompose the popup, import dialog, and isolated Shadow DOM approval panel as compact institutional product surfaces using the same visual language.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, CSS custom properties, Vite, esbuild, Manifest V3, Vitest, Testing Library, Playwright

**Spec:** `experiments/automatic-tool-extension/DESIGN.md`

## Global Constraints

- Keep the names `Adaptive WebMCP` and `Unsupported Catalog Lab`; do not use Coinbase trademarks, wordmarks, navigation labels, or trading marketing copy.
- Use Coinbase Blue `#0052ff` as the only action accent; semantic green/red are text-only state colors.
- Use Inter and JetBrains Mono-compatible local fallback stacks with display weight 400.
- Keep raw color values in the two `styles.css` files and use token references in TSX.
- Preserve extension permissions, protocol operations, WebMCP tool names, origin/path behavior, all `name` and `data-*` selectors, accessible labels, and test contracts.
- Style all visible surfaces: demo, extension popup, tool list, import review, and injected approval panel.
- Preserve extension CSS isolation and packaged-code-only constraints.
- Add restrained entrance, depth, and affordance motion with reduced-motion support.
- Do not add gradients, unrelated features, commits, branches, worktrees, or external runtime services.

---

### Task 1: Establish demo and extension token foundations

**Files:**
- Verify: `experiments/automatic-tool-extension/DESIGN.md`
- Modify: `experiments/automatic-tool-extension/demo-web/src/styles.css`
- Modify: `experiments/automatic-tool-extension/extension/src/styles.css`

**Interfaces:**
- Consumes: design tokens and substitute font rules from `DESIGN.md`
- Produces: equivalent CSS-variable/component-class contracts in both rendering environments

- [x] **Step 1: Implement matching token systems**

Define canvas, soft/strong/dark surfaces, blue action, text, hairline, semantic, radius, spacing, shadow, and font variables in both `styles.css` files. Add the same named primitives for display type, mono values, pills, badges, elevated panels, inputs, and motion.

- [x] **Step 2: Keep extension packaging self-contained**

Use local/system font stacks only in the extension CSS. Do not introduce remote font URLs or runtime fetches outside the existing packaged `styles.css` load.

- [x] **Step 3: Build both CSS foundations**

Run: `pnpm build`

Expected: PASS with both token stylesheets in their production bundles.

### Task 2: Recompose the unsupported-site demo

**Files:**
- Modify: `experiments/automatic-tool-extension/demo-web/src/App.tsx`
- Modify: `experiments/automatic-tool-extension/demo-web/src/lab/UnsupportedCatalog.tsx`
- Modify: `experiments/automatic-tool-extension/demo-web/src/metrics/MetricsPanel.tsx`
- Test: `experiments/automatic-tool-extension/demo-web/src/App.test.tsx`
- Test: `experiments/automatic-tool-extension/demo-web/src/lab/UnsupportedCatalog.test.tsx`

**Interfaces:**
- Consumes: extension status, LabStore, MetricsStore, and demo token classes
- Produces: dark lifecycle hero, white editorial catalog, and soft evidence band

- [x] **Step 1: Add a failing demo structure test**

Require a region named `Extension lifecycle` in `src/App.test.tsx` without asserting presentation classes.

- [x] **Step 2: Run the focused test and confirm failure**

Run: `pnpm --dir demo-web test -- src/App.test.tsx`

Expected: FAIL because the lifecycle region does not exist.

- [x] **Step 3: Build the dark extension lifecycle hero**

Keep status text live. Place product name, concise unsupported-site explanation, version/reset controls, and a layered status stack in a full-bleed dark band. Add `aria-label="Extension lifecycle"` to the layered stack.

- [x] **Step 4: Restyle the catalog**

Keep all selector-bearing attributes unchanged. Use rounded inputs, primary search pill, divider-led item rows, circular glyph plates, mono prices, tertiary shortlist actions, and a distinct soft shortlist column.

- [x] **Step 5: Restyle evidence**

Use a soft full-width band with three hairline-separated values and mono numeric output. Avoid cards and filled semantic colors.

- [x] **Step 6: Complete responsive and motion behavior**

Collapse the lifecycle stack and catalog rows on mobile, preserve 44px targets, reduce display size to 36–40px, and add hero entrance, panel reveal/depth, and pill transitions with reduced-motion support.

- [x] **Step 7: Run demo tests**

Run: `pnpm --dir demo-web test`

Expected: PASS.

### Task 3: Recompose the extension popup and import review

**Files:**
- Modify: `experiments/automatic-tool-extension/extension/src/popup/Popup.tsx`
- Modify: `experiments/automatic-tool-extension/extension/src/popup/ToolList.tsx`
- Modify: `experiments/automatic-tool-extension/extension/src/popup/ImportReviewDialog.tsx`
- Test: `experiments/automatic-tool-extension/extension/src/popup/Popup.test.tsx`

**Interfaces:**
- Consumes: SiteStatus, stored tools, popup actions, and extension token classes
- Produces: compact dark-header popup, editorial tool rows, and 24px import review surface

- [x] **Step 1: Add a failing popup structure test**

Require a banner containing `Adaptive WebMCP` in `src/popup/Popup.test.tsx` without asserting class strings.

- [x] **Step 2: Run the focused test and confirm failure**

Run: `pnpm --dir extension test -- src/popup/Popup.test.tsx`

Expected: FAIL because the popup has no banner.

- [x] **Step 3: Build the compact branded popup shell**

Use a dark banner with product name, active origin, and status badge. Keep the body white and action hierarchy blue primary, soft-gray secondary, and text tertiary. Keep the popup width 380px and all existing button labels.

- [x] **Step 4: Restyle tool inventory rows**

Use divider-led rows, circular health glyphs, mono revision/path metadata, pill enable/disable controls, semantic text-only health, and a low-emphasis delete action.

- [x] **Step 5: Restyle import review**

Use a 24px white modal on a dark translucent floor, mono origin/tool metadata, pill actions, and one shadow tier. Preserve dialog labels and file-input behavior.

- [x] **Step 6: Run popup tests**

Run: `pnpm --dir extension test -- src/popup/Popup.test.tsx`

Expected: PASS.

### Task 4: Recompose the isolated approval panel

**Files:**
- Modify: `experiments/automatic-tool-extension/extension/src/approval/ApprovalPanel.tsx`
- Test: `experiments/automatic-tool-extension/extension/src/approval/ApprovalPanel.test.tsx`

**Interfaces:**
- Consumes: PendingProposal and ApprovalDecision inside the current Shadow DOM mount
- Produces: branded proposal review that remains isolated from page styles

- [x] **Step 1: Preserve the approval behavior baseline**

Run: `pnpm --dir extension test -- src/approval/ApprovalPanel.test.tsx`

Expected: PASS before edits.

- [x] **Step 2: Apply the institutional review hierarchy**

Use a dark header band, white detail body, pill classification, mono scope/selector rows, a text-only amber replacement warning, and paired reject/approve pills. Keep `role="dialog"`, `aria-modal`, auto-focus, and all button names.

- [x] **Step 3: Run approval tests**

Run: `pnpm --dir extension test -- src/approval/ApprovalPanel.test.tsx`

Expected: PASS.

### Task 5: Verify packaged extension and end-to-end journeys

**Files:**
- Modify: `experiments/automatic-tool-extension/extension/e2e/automatic-tools.spec.ts`
- Inspect: `experiments/automatic-tool-extension/extension/dist/`

**Interfaces:**
- Consumes: completed demo and extension presentation migration
- Produces: packaged and browser-verified release evidence

- [x] **Step 1: Add stable visual invariants to E2E**

Assert the demo lifecycle region is visible and the popup banner contains `Adaptive WebMCP` before continuing the existing enablement journeys. Do not couple tests to CSS class strings.

- [x] **Step 2: Run complete verification**

```powershell
pnpm test
pnpm typecheck
pnpm build
pnpm test:e2e
```

Expected: every command exits 0 and both loaded-extension journeys pass.

- [x] **Step 3: Scan for presentation violations**

```powershell
rg -n "#[0-9a-fA-F]{3,8}" demo-web/src extension/src -g "*.tsx"
rg -n "gradient" demo-web/src extension/src
```

Expected: no raw hex colors in TSX and no gradients.

- [x] **Step 4: Inspect all live surfaces**

Verify demo desktop/mobile layouts, popup disabled/enabled states, import review, and Shadow DOM approval panel. Confirm one blue action accent, dark/light rhythm, pill geometry, mono values, no overflow, and no console errors.

- [x] **Step 5: Run repository checks**

Run: `git diff --check` and `git status --short --branch`.

Expected: no whitespace errors, no commit, and only intended workspace changes.
