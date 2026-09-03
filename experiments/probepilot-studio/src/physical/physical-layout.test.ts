import { describe, expect, it } from "vitest";
import { createBlankDesign, createDemoDesign } from "@/domain/fixtures";
import { PhysicalLayout } from "@/physical/physical-layout";
import { PhysicalPlacementMode } from "@/physical/physical-design";

describe("PhysicalLayout", () => {
  it("generates stable automatic placements for every component", () => {
    const first = PhysicalLayout.generate(createDemoDesign());
    const second = PhysicalLayout.generate(createDemoDesign());
    expect(first).toEqual(second);
    expect(first.placementMode).toBe(PhysicalPlacementMode.Automatic);
    expect(Object.keys(first.placements)).toHaveLength(5);
    expect(first.board).toEqual({ widthMm: 80, heightMm: 60, thicknessMm: 1.6 });
  });

  it("handles an empty design", () => {
    expect(PhysicalLayout.generate(createBlankDesign()).placements).toEqual({});
  });

  it("keeps existing placements and adds new components", () => {
    const original = createDemoDesign();
    const physical = PhysicalLayout.generate(original);
    const changed = createDemoDesign();
    changed.components.extra = { ...changed.components.r1!, id: "extra", label: "R2" };
    const reconciled = PhysicalLayout.reconcile(changed, physical);
    expect(reconciled.placements.r1).toEqual(physical.placements.r1);
    expect(reconciled.placements.extra).toBeDefined();
  });
});
