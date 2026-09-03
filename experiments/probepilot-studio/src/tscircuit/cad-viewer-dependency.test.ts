import { describe, expect, it, vi } from "vitest";

describe("CadViewer dependency", () => {
  it("loads the pinned React viewer entry used by the interactive preview", async () => {
    const upstreamWarning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const module = await import("@tscircuit/3d-viewer");
      expect(module.CadViewer).toBeTypeOf("function");
    } finally {
      upstreamWarning.mockRestore();
    }
  }, 20_000);
});
