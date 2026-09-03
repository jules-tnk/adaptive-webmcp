import { WorkspaceView } from "@/physical/physical-design";

export enum WorkspaceUrlMode {
  Design = "design",
  Simulate = "simulate"
}

export enum WorkspaceInspectorTab {
  Inspector = "inspector",
  Activity = "activity"
}

export enum WorkspacePanelVisibility {
  Expanded = "expanded",
  Collapsed = "collapsed"
}

enum WorkspaceUrlParameter {
  Mode = "mode",
  View = "view",
  Panel = "panel",
  Left = "left",
  Right = "right"
}

export interface WorkspaceUrlSnapshot {
  readonly mode: WorkspaceUrlMode;
  readonly view: WorkspaceView;
  readonly panel: WorkspaceInspectorTab;
  readonly left: WorkspacePanelVisibility;
  readonly right: WorkspacePanelVisibility;
}

export class WorkspaceUrlState {
  static parse(parameters: URLSearchParams): WorkspaceUrlSnapshot {
    const mode = parameters.get(WorkspaceUrlParameter.Mode) === WorkspaceUrlMode.Simulate
      ? WorkspaceUrlMode.Simulate
      : WorkspaceUrlMode.Design;
    const requestedView = parameters.get(WorkspaceUrlParameter.View);
    let view = WorkspaceView.Circuit;
    if (requestedView === WorkspaceView.Pcb) view = WorkspaceView.Pcb;
    if (requestedView === WorkspaceView.ThreeD) view = WorkspaceView.ThreeD;
    if (mode === WorkspaceUrlMode.Simulate) view = WorkspaceView.Circuit;

    return {
      mode,
      view,
      panel: parameters.get(WorkspaceUrlParameter.Panel) === WorkspaceInspectorTab.Activity
        ? WorkspaceInspectorTab.Activity
        : WorkspaceInspectorTab.Inspector,
      left: parameters.get(WorkspaceUrlParameter.Left) === WorkspacePanelVisibility.Collapsed
        ? WorkspacePanelVisibility.Collapsed
        : WorkspacePanelVisibility.Expanded,
      right: parameters.get(WorkspaceUrlParameter.Right) === WorkspacePanelVisibility.Collapsed
        ? WorkspacePanelVisibility.Collapsed
        : WorkspacePanelVisibility.Expanded
    };
  }

  static serialize(state: WorkspaceUrlSnapshot): URLSearchParams {
    const parameters = new URLSearchParams();
    if (state.mode === WorkspaceUrlMode.Simulate) parameters.set(WorkspaceUrlParameter.Mode, state.mode);
    if (state.mode === WorkspaceUrlMode.Design && state.view !== WorkspaceView.Circuit) parameters.set(WorkspaceUrlParameter.View, state.view);
    if (state.panel === WorkspaceInspectorTab.Activity) parameters.set(WorkspaceUrlParameter.Panel, state.panel);
    if (state.left === WorkspacePanelVisibility.Collapsed) parameters.set(WorkspaceUrlParameter.Left, state.left);
    if (state.right === WorkspacePanelVisibility.Collapsed) parameters.set(WorkspaceUrlParameter.Right, state.right);
    return parameters;
  }
}
