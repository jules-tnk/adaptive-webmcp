# tsCircuit CadViewer Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the primary simplified 3D presentation with lazy-loaded `@tscircuit/3d-viewer` while retaining the existing local SVG renderer as an automatic fallback.

**Architecture:** ProbePilot continues to derive validated, public-only Circuit JSON through `PhysicalPreviewAdapter`. A new tsCircuit-isolated React adapter owns the `CadViewer` import and asset policy; `AssemblyPreview` lazy-loads that adapter and catches load, WebGL, or render failures before displaying the existing `Simple3dFallback`.

**Tech Stack:** React 19.1.0, TypeScript 5.7, Vite 5, Vitest 2, `@tscircuit/3d-viewer@0.0.597`, `@tscircuit/core@0.0.1830`, Circuit JSON.

**Spec:** `docs/superpowers/specs/2026-09-01-tscircuit-integration-design.md`

## Global Constraints

- Work in the existing workspace and branch; do not create a worktree, branch, commit, push, or deployment.
- Keep direct tsCircuit package imports inside `src/tscircuit/`.
- Pass only `PhysicalPreviewAdapter` output to the viewer; never expose private bench state.
- Do not resolve remote component models. Generic CAD bounding boxes are acceptable for the hackathon.
- Lazy-load the WebGL viewer only after the 3D tab is selected.
- Preserve the current six-angle SVG renderer as the visible failure fallback.
- Follow the repository string-enum and absolute type-safety rules.

---

### Task 1: Resolve and pin the CadViewer runtime

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `vite.config.ts`
- Create: `src/tscircuit/tscircuit-core-shim.ts`
- Create: `src/tscircuit/cad-viewer-dependency.test.ts`

**Interfaces:**
- Consumes: React 19.1, Zod 3, existing `@tscircuit/circuit-json-util`.
- Produces: an importable `CadViewer` React component and a reproducible pinned dependency graph.

- [x] **Step 1: Write the dependency contract test**

```ts
import { describe, expect, it } from "vitest";

describe("CadViewer dependency", () => {
  it("loads the pinned React viewer entry", async () => {
    const module = await import("@tscircuit/3d-viewer");
    expect(module.CadViewer).toBeTypeOf("function");
  });
});
```

- [x] **Step 2: Run the focused test and confirm RED**

Run: `pnpm test -- src/tscircuit/cad-viewer-dependency.test.ts`

Expected: failure because `@tscircuit/3d-viewer` is not installed.

- [x] **Step 3: Install exact viewer dependencies**

Run: `pnpm add -w -E @tscircuit/3d-viewer@0.0.597 @tscircuit/core@0.0.1830 three@0.165.0`

The viewer’s module-level core import reaches undeclared compiler peers even though ProbePilot never uses its JSX-children mode. Keep the declared core peer pinned, but alias its runtime import to `src/tscircuit/tscircuit-core-shim.ts`; do not substitute CDN imports.

- [x] **Step 4: Run the dependency contract and TypeScript**

Run: `pnpm test -- src/tscircuit/cad-viewer-dependency.test.ts && pnpm typecheck`

Expected: the viewer export loads and TypeScript succeeds.

### Task 2: Make CadViewer primary with SVG fallback

**Files:**
- Create: `src/tscircuit/cad-viewer-scene.tsx`
- Create: `src/tscircuit/cad-viewer-scene.test.tsx`
- Modify: `src/features/assembly-preview.tsx`
- Modify: `src/features/assembly-preview.test.tsx`
- Modify: `src/tscircuit/lazy-runtime-contract.test.ts`

**Interfaces:**
- Consumes: `readonly AnyCircuitElement[]` from `PhysicalPreviewAdapter.convert()`.
- Produces: `CadViewerScene({ elements })`, a full-size interactive WebGL viewer with local-only asset resolution.

- [x] **Step 1: Write failing adapter and integration tests**

Test that the adapter passes the exact Circuit JSON collection into `CadViewer`, rejects every model URL through its resolver, and labels the WebGL region. Update the assembly test to expect the interactive viewer after lazy loading and retain a source contract proving `Simple3dFallback` remains in the error path.

- [x] **Step 2: Run focused tests and confirm RED**

Run: `pnpm test -- src/tscircuit/cad-viewer-scene.test.tsx src/features/assembly-preview.test.tsx src/tscircuit/lazy-runtime-contract.test.ts`

Expected: failure because `CadViewerScene` does not exist and `AssemblyPreview` still loads the simplified renderer directly.

- [x] **Step 3: Implement the isolated viewer adapter**

```tsx
import { CadViewer } from "@tscircuit/3d-viewer";
import type { AnyCircuitElement } from "circuit-json";

export function CadViewerScene({ elements }: { readonly elements: readonly AnyCircuitElement[] }) {
  return <div aria-label="Interactive 3D PCB viewer"><CadViewer circuitJson={[...elements]} resolveStaticAsset={() => ""} /></div>;
}
```

The empty-string resolver denies HTTP, HTTPS, data, and local model URLs; generated CAD bounding boxes remain available without external assets.

- [x] **Step 4: Refactor `AssemblyPreview`**

Lazy-import `CadViewerScene`, display a loading status during module initialization, and make the error boundary render `Simple3dFallback` with the same validated elements. Remove the fixed-angle toolbar from the successful WebGL path because camera control belongs to `CadViewer`.

- [x] **Step 5: Run focused tests, full tests, and TypeScript**

Run: `pnpm test -- src/tscircuit/cad-viewer-scene.test.tsx src/features/assembly-preview.test.tsx src/tscircuit/lazy-runtime-contract.test.ts`

Then: `pnpm test && pnpm typecheck`

Expected: the primary viewer and fallback contracts pass without changing the nine WebMCP tools.

### Task 3: Build and verify the real viewer in Browser

**Files:**
- Modify: `README.md`
- Modify: `docs/product/experience-spec.md`
- Modify: `docs/architecture/system-design.md`
- Modify: `docs/testing.md`
- Modify: `docs/superpowers/specs/2026-09-01-tscircuit-integration-design.md`

**Interfaces:**
- Consumes: the lazy `CadViewerScene` and current local development server.
- Produces: verified interactive 3D behavior and documentation that distinguishes WebGL primary from SVG fallback.

- [x] **Step 1: Run the production build**

Run: `pnpm build`

Confirm the initial HTML does not preload the CadViewer, simplified 3D, or ngspice chunks. Record the generated viewer chunk sizes.

- [x] **Step 2: Verify in the in-app Browser**

Open the deterministic demo, select `3D Preview`, and verify the WebGL canvas appears. Exercise camera rotation and zoom, switch to PCB and back, and confirm no console errors. If WebGL cannot initialize, confirm the six-angle SVG fallback is visible instead of a blank workspace.

- [x] **Step 3: Update documentation**

Document `CadViewer` as the primary interactive renderer, generic bounding boxes as the initial geometry, local-only asset policy, lazy bundle behavior, and the simplified SVG failure fallback.

- [x] **Step 4: Run the final gate**

Run: `pnpm test && pnpm typecheck && pnpm build`

Expected: all commands exit successfully and the Browser remains open on the verified application.

## Completion evidence

- `@tscircuit/3d-viewer@0.0.597`, `@tscircuit/core@0.0.1830`, and `three@0.165.0` are pinned.
- The real viewer import, adapter, lazy boundary, generic-geometry, asset-denial, and SVG-fallback tests pass.
- 341 tests across 47 files, TypeScript, and the production build pass.
- The WebGL chunk is lazy: 2.21 MB raw and 654.35 kB gzip, with no initial HTML preload.
- The in-app Browser shows two CadViewer canvases using the JSCAD engine; drag and wheel input change the camera; a clean session has zero console errors and warnings.
