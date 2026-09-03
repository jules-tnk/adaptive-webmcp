import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDemoDesign } from "@/domain/fixtures";
import { PhysicalLayout } from "@/physical/physical-layout";
import { PhysicalPreviewAdapter } from "@/tscircuit/physical-preview-adapter";

vi.mock("@tscircuit/3d-viewer", () => ({
  CadViewer: ({ autoRotateDisabled, onCameraControllerReady }: { readonly autoRotateDisabled: boolean; readonly onCameraControllerReady: (controller: object) => void }) => <><canvas aria-label="CadViewer canvas" data-auto-rotate-disabled={String(autoRotateDisabled)}/><button type="button" onClick={() => onCameraControllerReady({})}>Mark viewer ready</button></>
}));

import { CadViewerAssetPolicy, CadViewerScene } from "@/tscircuit/cad-viewer-scene";

describe("CadViewerScene", () => {
  afterEach(() => cleanup());

  it("shows progress until CadViewer reports that its controller is ready", async () => {
    const design = createDemoDesign();
    const preview = PhysicalPreviewAdapter.convert(design, PhysicalLayout.generate(design));
    render(<CadViewerScene elements={preview.elements}/>);

    expect(screen.getByRole("region", { name: "Interactive 3D PCB viewer" })).toBeInTheDocument();
    expect(screen.getByLabelText("CadViewer canvas")).toHaveAttribute("data-auto-rotate-disabled", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Building 3D preview");

    fireEvent.click(screen.getByRole("button", { name: "Mark viewer ready" }));
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument(), { timeout: 2_000 });
  });

  it("denies external and embedded model asset URLs", () => {
    expect(CadViewerAssetPolicy.resolve("https://example.com/model.glb")).toBe("");
    expect(CadViewerAssetPolicy.resolve("data:model/gltf-binary;base64,AAAA")).toBe("");
    expect(CadViewerAssetPolicy.resolve("/models/local.glb")).toBe("");
  });
});
