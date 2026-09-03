import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("lazy optional runtimes", () => {
  it("keeps local ngspice behind a dynamic import and out of Vite entry points", () => {
    const runtime = readFileSync(resolve("src/tscircuit/spice-runtime.ts"), "utf8");
    const vite = readFileSync(resolve("vite.config.ts"), "utf8");
    expect(runtime).toContain('await import("./local-ngspice-engine-adapter")');
    expect(vite).not.toContain("spice-runtime-browser-entry");
  });

  it("keeps the simplified 3D implementation behind the selected-view boundary", () => {
    const assembly = readFileSync(resolve("src/features/assembly-preview.tsx"), "utf8");
    expect(assembly).toContain('import("@/features/simple-3d-fallback")');
    expect(assembly).not.toContain('import { Simple3dFallback }');
  });
});
