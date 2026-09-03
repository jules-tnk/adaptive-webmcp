import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDemoDesign } from "@/domain/fixtures";
import { PhysicalLayout } from "@/physical/physical-layout";
import { PhysicalPreviewAdapter } from "@/tscircuit/physical-preview-adapter";

vi.mock("@/tscircuit/cad-viewer-scene", () => ({
  CadViewerScene: () => <div role="region" aria-label="Interactive 3D PCB viewer"/>
}));

import { AssemblyPreview, AssemblyPreviewBoundary } from "@/features/assembly-preview";

function BrokenViewer(): React.ReactNode {
  throw new Error("WebGL unavailable");
}

describe("AssemblyPreview", () => {
  afterEach(() => cleanup());

  it("loads the interactive CadViewer only inside the selected preview", async () => {
    const design = createDemoDesign();
    render(<AssemblyPreview design={design} physical={PhysicalLayout.generate(design)}/>);

    expect(screen.getByRole("status")).toHaveTextContent("Loading 3D preview");
    await waitFor(() => expect(screen.getByRole("region", { name: "Interactive 3D PCB viewer" })).toBeInTheDocument());
  });

  it("falls back to the simplified local renderer when the WebGL viewer fails", async () => {
    const design = createDemoDesign();
    const preview = PhysicalPreviewAdapter.convert(design, PhysicalLayout.generate(design));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<AssemblyPreviewBoundary elements={preview.elements}><BrokenViewer/></AssemblyPreviewBoundary>);

    await waitFor(() => expect(screen.getByRole("img", { name: "Simplified 3D assembly preview" })).toBeInTheDocument());
    consoleError.mockRestore();
  });
});
