import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createDemoDesign } from "@/domain/fixtures";
import { Simple3dFallback } from "@/features/simple-3d-fallback";
import { PhysicalLayout } from "@/physical/physical-layout";
import { PhysicalPreviewAdapter } from "@/tscircuit/physical-preview-adapter";

describe("Simple3dFallback", () => {
  afterEach(() => cleanup());

  it("offers all six local angle presets", async () => {
    const design = createDemoDesign();
    const preview = PhysicalPreviewAdapter.convert(design, PhysicalLayout.generate(design));
    render(<Simple3dFallback elements={preview.elements}/>);

    for (const name of ["angle1", "angle2", "left", "right", "left-raised", "right-raised"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole("button", { name: "right-raised" }));
    await waitFor(() => expect(screen.getByRole("img", { name: "Simplified 3D assembly preview" })).toBeInTheDocument());
    const image = screen.getByRole("img", { name: "Simplified 3D assembly preview" });
    fireEvent.click(screen.getByRole("button", { name: "Zoom in 3D preview" }));
    expect(image).toHaveStyle({ transform: "scale(1.2)" });
  });
});
