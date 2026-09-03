import { MonitorUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { projectRepository } from "@/projects/project-runtime";
import { studioStore, useStudioStore } from "@/state/store";
import { CircuitBoard } from "./circuit-board";
import { InspectorPanel } from "./inspector-panel";
import { LeftPanel } from "./left-panel";
import { StatusBar } from "./status-bar";
import { TopBar } from "./top-bar";
import { Workbench } from "./workbench";
import { WorkspaceViewSwitcher } from "./workspace-view-switcher";
import { PcbPreview } from "./pcb-preview";
import { AssemblyPreview } from "./assembly-preview";
import { WorkspaceView } from "@/physical/physical-design";
import {
  WorkspaceInspectorTab,
  WorkspacePanelVisibility,
  WorkspaceUrlMode,
  WorkspaceUrlState,
  type WorkspaceUrlSnapshot
} from "./workspace-url-state";

export function StudioPage() {
  const { projectId } = useParams();
  const [searchParameters, setSearchParameters] = useSearchParams();
  const searchKey = searchParameters.toString();
  const initialUrlState = WorkspaceUrlState.parse(searchParameters);
  const urlStateRef = useRef<WorkspaceUrlSnapshot>(initialUrlState);
  const project = projectId ? projectRepository.get(projectId) : null;
  const [loadedId, setLoadedId] = useState<string | null>(() => studioStore.getState().projectId === projectId ? projectId ?? null : null);
  const [componentsPanelCollapsed, setComponentsPanelCollapsed] = useState(initialUrlState.left === WorkspacePanelVisibility.Collapsed);
  const [inspectorPanelCollapsed, setInspectorPanelCollapsed] = useState(initialUrlState.right === WorkspacePanelVisibility.Collapsed);
  const [inspectorTab, setInspectorTab] = useState(initialUrlState.panel);
  const workspaceView = useStudioStore((state) => state.workspaceView);
  const design = useStudioStore((state) => state.design);
  const physicalDesign = useStudioStore((state) => state.physicalDesign);
  const setWorkspaceView = useStudioStore((state) => state.setWorkspaceView);
  const patchUrlState = (patch: Partial<WorkspaceUrlSnapshot>, replace: boolean): void => {
    setSearchParameters((currentParameters) => {
      const next = { ...WorkspaceUrlState.parse(currentParameters), ...patch };
      urlStateRef.current = next;
      return WorkspaceUrlState.serialize(next);
    }, { replace });
  };
  const updateComponentsPanel = (collapsed: boolean): void => {
    setComponentsPanelCollapsed(collapsed);
    patchUrlState({ left: collapsed ? WorkspacePanelVisibility.Collapsed : WorkspacePanelVisibility.Expanded }, true);
  };
  const updateInspectorPanel = (collapsed: boolean): void => {
    setInspectorPanelCollapsed(collapsed);
    patchUrlState({ right: collapsed ? WorkspacePanelVisibility.Collapsed : WorkspacePanelVisibility.Expanded }, true);
  };
  const updateInspectorTab = (panel: WorkspaceInspectorTab): void => {
    setInspectorTab(panel);
    patchUrlState({ panel }, false);
  };

  useEffect(() => {
    if (!projectId || !project) return;
    if (studioStore.getState().projectId !== projectId) studioStore.getState().loadProject(project);
    const urlState = WorkspaceUrlState.parse(new URLSearchParams(searchKey));
    urlStateRef.current = urlState;
    setComponentsPanelCollapsed(urlState.left === WorkspacePanelVisibility.Collapsed);
    setInspectorPanelCollapsed(urlState.right === WorkspacePanelVisibility.Collapsed);
    setInspectorTab(urlState.panel);
    studioStore.getState().setMode(urlState.mode === WorkspaceUrlMode.Simulate ? WorkspaceUrlMode.Simulate : WorkspaceUrlMode.Design);
    studioStore.getState().setWorkspaceView(urlState.view);
    const canonicalParameters = WorkspaceUrlState.serialize(urlState);
    if (canonicalParameters.toString() !== searchKey) setSearchParameters(canonicalParameters, { replace: true });
    setLoadedId(projectId);
  }, [projectId, searchKey]);

  useEffect(() => studioStore.subscribe((state, previousState) => {
    if (state.projectId !== projectId || (state.mode === previousState.mode && state.workspaceView === previousState.workspaceView)) return;
    const mode = state.mode === WorkspaceUrlMode.Simulate ? WorkspaceUrlMode.Simulate : WorkspaceUrlMode.Design;
    const view = mode === WorkspaceUrlMode.Simulate ? WorkspaceView.Circuit : state.workspaceView;
    const current = urlStateRef.current;
    if (current.mode !== mode || current.view !== view) patchUrlState({ mode, view }, false);
  }), [projectId]);

  if (!projectId || !project) return <Navigate to="/?notice=project-not-found" replace />;
  if (loadedId !== projectId) return <div className="grid h-full place-items-center text-sm text-muted-foreground">Loading project…</div>;
  return <div className="h-full">
    <div className="flex h-full items-center justify-center p-8 lg:hidden"><div className="max-w-md rounded-xl border border-border bg-card p-7 text-center"><MonitorUp className="mx-auto h-8 w-8 text-primary"/><h1 className="mt-4 text-xl font-semibold">Desktop workspace required</h1><p className="mt-2 text-sm leading-relaxed text-muted-foreground">ProbePilot’s circuit board and virtual instrument are optimized for a viewport at least 1024 pixels wide.</p></div></div>
    <div className="hidden h-full min-h-0 flex-col overflow-hidden lg:flex">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <LeftPanel collapsed={componentsPanelCollapsed} onCollapsedChange={updateComponentsPanel}/>
        <main className="flex min-w-0 flex-1 flex-col"><WorkspaceViewSwitcher value={workspaceView} onChange={setWorkspaceView}/>{workspaceView === WorkspaceView.Circuit && <><CircuitBoard /><Workbench /></>}{workspaceView === WorkspaceView.Pcb && <PcbPreview design={design} physical={physicalDesign}/>} {workspaceView === WorkspaceView.ThreeD && <AssemblyPreview design={design} physical={physicalDesign}/>}</main>
        <InspectorPanel collapsed={inspectorPanelCollapsed} onCollapsedChange={updateInspectorPanel} activeTab={inspectorTab} onActiveTabChange={updateInspectorTab}/>
      </div>
      <StatusBar />
    </div>
  </div>;
}
