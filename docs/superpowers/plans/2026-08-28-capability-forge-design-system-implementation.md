# Capability Forge Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved institutional editorial design system to every Capability Forge surface without changing its WebMCP contracts, workflow behavior, or test selectors.

**Architecture:** Centralize color, typography, radius, spacing, elevation, and motion tokens in `src/styles.css`; compose a full-bleed dark operational hero in the shell; and restyle the lab, inspector, review, failure, and evidence regions with token-backed classes. Preserve existing React state and domain modules and change only presentation markup where accessibility or responsive composition requires it.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, CSS custom properties, Vitest, Testing Library, Playwright

**Spec:** `experiments/capability-forge/DESIGN.md`

## Global Constraints

- Keep the product name `Capability Forge`; do not use Coinbase trademarks, wordmarks, navigation labels, or trading marketing copy.
- Use Coinbase Blue `#0052ff` as the only action accent; semantic green/red are text-only state colors.
- Use Inter and JetBrains Mono-compatible local fallback stacks; display text stays weight 400.
- Use token references in TSX and keep raw color values in `src/styles.css` only.
- Preserve all WebMCP tool names, input schemas, lifecycle behavior, `name` attributes, `data-*` selectors, accessible names, and existing test contracts.
- Use pill geometry for controls, 24px radii for substantive containers, 96px desktop section rhythm, and responsive reductions on smaller screens.
- Add restrained entrance, depth, and affordance motion with `prefers-reduced-motion` support.
- Do not add gradients, unrelated features, commits, branches, worktrees, or external runtime services.

---

### Task 1: Establish the token-backed visual foundation

**Files:**
- Verify: `experiments/capability-forge/DESIGN.md`
- Modify: `experiments/capability-forge/src/styles.css`

**Interfaces:**
- Consumes: the approved token values and shape rules in `DESIGN.md`
- Produces: CSS variables and reusable classes used by all later tasks

- [x] **Step 1: Implement design tokens and component primitives**

Define `--color-primary`, `--color-primary-active`, surface, hairline, text, semantic, spacing, radius, shadow, and font-family variables in `src/styles.css`. Add reusable classes for display text, mono numbers, primary/secondary/tertiary pills, badges, dark elevated panels, inputs, editorial bands, and entrance/depth motion.

Use this contract:

```css
:root {
  --color-primary: #0052ff;
  --color-surface-dark: #0a0b0d;
  --color-surface-dark-elevated: #16181c;
  --color-canvas: #ffffff;
  --color-surface-soft: #f7f7f7;
  --radius-pill: 100px;
  --radius-xl: 24px;
  --spacing-section: 96px;
}

.display-type { font-weight: 400; letter-spacing: -0.025em; }
.number-type { font-family: "JetBrains Mono", "Geist Mono", ui-monospace, monospace; }
.button-primary { background: var(--color-primary); border-radius: var(--radius-pill); }
```

- [x] **Step 2: Build the CSS foundation**

Run: `pnpm build`

Expected: PASS with the token and component stylesheet included in the production bundle.

### Task 2: Build the full-bleed operational hero and navigation

**Files:**
- Modify: `experiments/capability-forge/src/App.tsx`
- Modify: `experiments/capability-forge/src/app/ForgeWorkspace.tsx`
- Modify: `experiments/capability-forge/src/App.test.tsx`

**Interfaces:**
- Consumes: token classes from Task 1 and current WebMCP readiness/version state
- Produces: dark full-width first viewport, responsive navigation, and layered lifecycle UI

- [x] **Step 1: Add a failing shell-structure test**

Assert that the rendered app exposes a banner, a navigation named `Prototype sections`, and a region named `Capability lifecycle`. Keep assertions semantic rather than checking class strings.

- [x] **Step 2: Run the focused test and confirm failure**

Run: `pnpm test -- src/App.test.tsx`

Expected: FAIL because the lifecycle region is not present.

- [x] **Step 3: Implement the branded shell**

Keep `Capability Forge` as the wordmark, use a dark 64px navigation, and retain the three existing anchor destinations. Add a compact mobile navigation treatment without changing href targets.

- [x] **Step 4: Implement the dark lifecycle hero**

Move the Workshop heading, readiness state, version controls, and reset action into a full-bleed dark band. Add a right-side layered stack composed from real product concepts—teaching, human review, replay verification, and reuse—rather than decorative fake statistics.

The accessible structure must include:

```tsx
<section aria-labelledby="workspace-heading">
  <div aria-label="Capability lifecycle">...</div>
</section>
```

- [x] **Step 5: Add restrained motion**

Apply a short hero entrance, staggered panel reveal, panel depth hover, and pill press transition. Disable transform animation under `prefers-reduced-motion: reduce`.

- [x] **Step 6: Run the focused test**

Run: `pnpm test -- src/App.test.tsx`

Expected: PASS.

### Task 3: Restyle the lab, inspector, review, and failure surfaces

**Files:**
- Modify: `experiments/capability-forge/src/lab/LegacyLab.tsx`
- Modify: `experiments/capability-forge/src/review/ReviewPanel.tsx`
- Modify: `experiments/capability-forge/src/review/FailureReport.tsx`
- Modify: `experiments/capability-forge/src/app/ForgeWorkspace.tsx`
- Test: `experiments/capability-forge/src/lab/LegacyLab.test.tsx`
- Test: `experiments/capability-forge/src/review/ReviewPanel.test.tsx`

**Interfaces:**
- Consumes: existing LabStore, recorder, repository, verification callbacks, and token primitives
- Produces: responsive white editorial workspace with a distinct inspector and review hierarchy

- [x] **Step 1: Preserve the behavioral test contract**

Run the two focused component suites before editing and record their passing baseline:

```powershell
pnpm test -- src/lab/LegacyLab.test.tsx src/review/ReviewPanel.test.tsx
```

- [x] **Step 2: Restyle the catalog as an editorial asset surface**

Keep every `name` and `data-*` attribute unchanged. Use 12px rounded inputs with a blue focus ring, a primary search pill, divider-led result rows, circular item glyph plates, mono prices, and tertiary blue shortlist actions.

- [x] **Step 3: Restyle the inspector and review hierarchy**

Use a soft-gray inspector floor, 24px review surface, pill status badges, mono workflow indices/selectors, and paired primary/secondary approval controls. Keep failure red as text and a narrow hairline only, never a filled red block.

- [x] **Step 4: Run focused tests**

Run: `pnpm test -- src/lab/LegacyLab.test.tsx src/review/ReviewPanel.test.tsx`

Expected: PASS.

### Task 4: Restyle evidence and finish responsive behavior

**Files:**
- Modify: `experiments/capability-forge/src/metrics/MetricsPanel.tsx`
- Modify: `experiments/capability-forge/src/styles.css`
- Modify: `experiments/capability-forge/e2e/capability-forge.spec.ts`

**Interfaces:**
- Consumes: MetricsStore values and existing `/lab` journey
- Produces: soft editorial evidence band, mono numerical values, and mobile-safe composition

- [x] **Step 1: Convert evidence to a divider-led band**

Render metrics without a dashboard-card mosaic. Use a soft-gray full-width band, hairline-separated values, mono numbers, semantic text-only status colors, and one clear heading.

- [x] **Step 2: Complete responsive rules**

At `<640px`, use 36–40px display text, one lifecycle panel, stacked asset rows, full-width pills, and a one-column workspace. At `640–1024px`, use a two-column lifecycle/evidence composition. Cap content at 1200px above 1280px.

- [x] **Step 3: Extend E2E visual invariants**

Keep behavioral selectors unchanged and add assertions that the lifecycle region and WebMCP readiness remain visible before the teaching journey.

- [x] **Step 4: Run browser journeys**

Run: `pnpm test:e2e`

Expected: both journeys PASS.

### Task 5: Verify design compliance and production output

**Files:**
- Inspect: all files modified above

**Interfaces:**
- Consumes: completed Capability Forge design migration
- Produces: test, build, and browser evidence suitable for handoff

- [x] **Step 1: Run complete automated verification**

```powershell
pnpm test
pnpm typecheck
pnpm build
pnpm test:e2e
```

Expected: every command exits 0.

- [x] **Step 2: Scan for presentation violations**

Run:

```powershell
rg -n "#[0-9a-fA-F]{3,8}" src -g "*.tsx"
rg -n "gradient" src
```

Expected: no raw hex colors in TSX and no gradients.

- [x] **Step 3: Inspect the live app at desktop and mobile widths**

Verify the dark full-bleed first screen, product identity, one blue action accent, pill geometry, layered lifecycle depth, readable 96px desktop rhythm, 40px mobile hero, stacked mobile rows, and 44px minimum primary targets. Check browser console errors.

- [x] **Step 4: Run repository checks**

Run: `git diff --check` and `git status --short --branch`.

Expected: no whitespace errors, no commit, and only intended workspace changes.
