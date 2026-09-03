import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { WorkspaceView } from "@/physical/physical-design";
import { WorkspaceViewSwitcher } from "@/features/workspace-view-switcher";

describe("WorkspaceViewSwitcher", () => {
  afterEach(() => cleanup());
  it("selects circuit, PCB, and 3D views accessibly", () => {
    let selected = WorkspaceView.Circuit;
    const { rerender } = render(<WorkspaceViewSwitcher value={selected} onChange={(value) => { selected = value; }} />);
    fireEvent.click(screen.getByRole("button", { name: "PCB Preview" }));
    expect(selected).toBe(WorkspaceView.Pcb);
    rerender(<WorkspaceViewSwitcher value={selected} onChange={(value) => { selected = value; }} />);
    expect(screen.getByRole("button", { name: "PCB Preview" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "3D Preview" }));
    expect(selected).toBe(WorkspaceView.ThreeD);
  });
});
