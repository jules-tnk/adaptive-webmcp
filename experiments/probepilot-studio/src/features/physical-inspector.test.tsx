import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PhysicalBoardSide, PhysicalPlacementMode } from "@/physical/physical-design";
import { PhysicalInspector } from "@/features/physical-inspector";
import { studioStore } from "@/state/store";

describe("PhysicalInspector", () => {
  afterEach(() => cleanup());
  it("updates board dimensions without changing electrical revision", () => {
    studioStore.getState().resetDemo();
    const revision = studioStore.getState().design.revision;
    render(<PhysicalInspector/>);
    const width = screen.getByLabelText("Board width (mm)");
    fireEvent.change(width, { target: { value: "95" } });
    fireEvent.blur(width);
    expect(studioStore.getState().physicalDesign.board.widthMm).toBe(95);
    expect(studioStore.getState().design.revision).toBe(revision);
  });

  it("updates the selected component placement without changing electrical revision", () => {
    studioStore.getState().resetDemo();
    studioStore.getState().setSelection({ type: "component", id: "r1" });
    const revision = studioStore.getState().design.revision;

    render(<PhysicalInspector/>);
    fireEvent.change(screen.getByLabelText("X position (mm)"), { target: { value: "41" } });
    fireEvent.change(screen.getByLabelText("Y position (mm)"), { target: { value: "27" } });
    fireEvent.change(screen.getByLabelText("Rotation (degrees)"), { target: { value: "90" } });
    fireEvent.change(screen.getByLabelText("Board side"), { target: { value: PhysicalBoardSide.Bottom } });
    fireEvent.change(screen.getByLabelText("Footprint"), { target: { value: "custom-package" } });

    expect(studioStore.getState().physicalDesign.placements.r1).toEqual({
      xMm: 41,
      yMm: 27,
      rotationDegrees: 90,
      side: PhysicalBoardSide.Bottom,
      footprint: "custom-package"
    });
    expect(studioStore.getState().physicalDesign.placementMode).toBe(PhysicalPlacementMode.Manual);
    expect(studioStore.getState().design.revision).toBe(revision);
  });

  it("resets manual placement to the deterministic automatic layout", () => {
    studioStore.getState().resetDemo();
    studioStore.getState().setSelection({ type: "component", id: "r1" });
    render(<PhysicalInspector/>);
    fireEvent.change(screen.getByLabelText("X position (mm)"), { target: { value: "41" } });
    fireEvent.click(screen.getByRole("button", { name: "Reset auto-layout" }));

    expect(studioStore.getState().physicalDesign.placementMode).toBe(PhysicalPlacementMode.Automatic);
    expect(studioStore.getState().physicalDesign.placements.r1?.xMm).not.toBe(41);
  });
});
