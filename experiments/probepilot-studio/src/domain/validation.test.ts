import { describe, expect, it } from "vitest";
import { createDemoDesign } from "./fixtures";
import { validateDesign, canConnect } from "./validation";

describe("circuit validation", () => {
  it("accepts the complete switched LED demo", () => {
    const result = validateDesign(createDemoDesign());
    expect(result.valid).toBe(true);
    expect(result.issues.filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it("rejects a duplicate terminal pair", () => {
    const design = createDemoDesign();
    const result = canConnect(design, { componentId: "v1", terminalId: "positive" }, { componentId: "sw1", terminalId: "a" });
    expect(result).toEqual({ ok: false, message: "These terminals are already connected." });
  });

  it("reports a missing source", () => {
    const design = createDemoDesign();
    delete design.components.v1;
    const result = validateDesign(design);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === "NO_SOURCE")).toBe(true);
  });
});
