import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createDemoDesign } from "@/domain/fixtures";
import { AssemblyPreview } from "@/features/assembly-preview";
import { PhysicalLayout } from "@/physical/physical-layout";

describe("AssemblyPreview", () => {
  afterEach(() => cleanup());

  it("loads the lightweight 3D renderer only inside the selected preview", async () => {
    const design = createDemoDesign();
    render(<AssemblyPreview design={design} physical={PhysicalLayout.generate(design)}/>);

    expect(screen.getByRole("status")).toHaveTextContent("Loading 3D preview");
    await waitFor(() => expect(screen.getByRole("img", { name: "Simplified 3D assembly preview" })).toBeInTheDocument());
  });
});
