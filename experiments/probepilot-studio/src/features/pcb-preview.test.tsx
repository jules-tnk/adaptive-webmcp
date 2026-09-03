import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createDemoDesign } from "@/domain/fixtures";
import { PcbPreview } from "@/features/pcb-preview";
import { PhysicalLayout } from "@/physical/physical-layout";
import { PhysicalPlacementMode } from "@/physical/physical-design";

describe("PcbPreview", () => {
  afterEach(() => cleanup());

  it("shows revision, layout status, and local zoom controls", () => {
    const design = createDemoDesign();
    render(<PcbPreview design={design} physical={PhysicalLayout.generate(design)}/>);

    expect(screen.getByText("AUTO-LAYOUT PREVIEW")).toBeInTheDocument();
    expect(screen.getByText(`revision ${design.revision}`)).toBeInTheDocument();
    const image = screen.getByRole("img", { name: `PCB preview of ${design.name}` });
    expect(image).toHaveStyle({ transform: "scale(1)" });
    fireEvent.click(screen.getByRole("button", { name: "Zoom in PCB preview" }));
    expect(image).toHaveStyle({ transform: "scale(1.2)" });
  });

  it("shows generic-footprint warnings without failing the preview", () => {
    const design = createDemoDesign();
    const physical = PhysicalLayout.generate(design);
    const placement = physical.placements.r1!;
    render(<PcbPreview design={design} physical={{
      ...physical,
      placementMode: PhysicalPlacementMode.Manual,
      placements: { ...physical.placements, r1: { ...placement, footprint: "custom-package" } }
    }}/>);

    expect(screen.getByText("MANUAL PREVIEW")).toBeInTheDocument();
    expect(screen.getByText(/R1 uses generic geometry/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: `PCB preview of ${design.name}` })).toBeInTheDocument();
  });
});
