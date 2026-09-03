import { describe, expect, it } from "vitest";
import { createDemoDesign } from "@/domain/fixtures";
import { PhysicalLayout } from "@/physical/physical-layout";
import { PhysicalPreviewAdapter } from "@/tscircuit/physical-preview-adapter";
import { Simple3dAdapter } from "@/tscircuit/simple-3d-adapter";
import { Simple3dAngle } from "@/tscircuit/simple-3d-adapter";

describe("PhysicalPreviewAdapter", () => {
  it("creates PCB elements and SVG for every placed component", () => {
    const design = createDemoDesign();
    const physical = PhysicalLayout.generate(design);
    const result = PhysicalPreviewAdapter.convert(design, physical);
    expect(result.elements.filter((element) => element.type === "pcb_component")).toHaveLength(5);
    expect(result.svg).toContain("<svg");
    expect(JSON.stringify(result)).not.toContain("hiddenFault");
  });

  it("renders the derived board through the lightweight 3D adapter", async () => {
    const design = createDemoDesign();
    const preview = PhysicalPreviewAdapter.convert(design, PhysicalLayout.generate(design));
    const svg = await Simple3dAdapter.render(preview.elements, Simple3dAngle.Angle1);
    expect(svg).toContain("<svg");
  });
});
