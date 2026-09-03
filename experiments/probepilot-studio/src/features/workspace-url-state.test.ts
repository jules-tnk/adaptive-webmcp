import { describe, expect, it } from "vitest";
import { WorkspaceView } from "@/physical/physical-design";
import {
  WorkspaceInspectorTab,
  WorkspacePanelVisibility,
  WorkspaceUrlMode,
  WorkspaceUrlState
} from "@/features/workspace-url-state";

describe("WorkspaceUrlState", () => {
  it("parses restorable workspace state and omits defaults when serializing", () => {
    const parsed = WorkspaceUrlState.parse(new URLSearchParams("mode=design&view=3d&panel=activity&left=collapsed&right=collapsed"));

    expect(parsed).toEqual({
      mode: WorkspaceUrlMode.Design,
      view: WorkspaceView.ThreeD,
      panel: WorkspaceInspectorTab.Activity,
      left: WorkspacePanelVisibility.Collapsed,
      right: WorkspacePanelVisibility.Collapsed
    });
    expect(WorkspaceUrlState.serialize(parsed).toString()).toBe("view=3d&panel=activity&left=collapsed&right=collapsed");
  });

  it("normalizes invalid values and forces non-design modes to the circuit view", () => {
    expect(WorkspaceUrlState.parse(new URLSearchParams("mode=simulate&view=3d&panel=broken&left=wat"))).toEqual({
      mode: WorkspaceUrlMode.Simulate,
      view: WorkspaceView.Circuit,
      panel: WorkspaceInspectorTab.Inspector,
      left: WorkspacePanelVisibility.Expanded,
      right: WorkspacePanelVisibility.Expanded
    });
    expect(WorkspaceUrlState.serialize(WorkspaceUrlState.parse(new URLSearchParams("mode=bench&view=nope"))).toString()).toBe("");
  });
});
