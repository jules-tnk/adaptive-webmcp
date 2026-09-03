import { MonitorUp } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
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

export function StudioPage() {
  const { projectId } = useParams();
  const project = projectId ? projectRepository.get(projectId) : null;
  const [loadedId, setLoadedId] = useState<string | null>(() => studioStore.getState().projectId === projectId ? projectId ?? null : null);
  const workspaceView = useStudioStore((state) => state.workspaceView);
  const design = useStudioStore((state) => state.design);
  const physicalDesign = useStudioStore((state) => state.physicalDesign);
  const setWorkspaceView = useStudioStore((state) => state.setWorkspaceView);

  useEffect(() => {
    if (!projectId || !project) return;
    if (studioStore.getState().projectId !== projectId) studioStore.getState().loadProject(project);
    setLoadedId(projectId);
  }, [projectId]);

  if (!projectId || !project) return <Navigate to="/?notice=project-not-found" replace />;
  if (loadedId !== projectId) return <div className="grid h-full place-items-center text-sm text-muted-foreground">Loading project…</div>;
  return <div className="h-full">
    <div className="flex h-full items-center justify-center p-8 lg:hidden"><div className="max-w-md rounded-xl border border-border bg-card p-7 text-center"><MonitorUp className="mx-auto h-8 w-8 text-primary"/><h1 className="mt-4 text-xl font-semibold">Desktop workspace required</h1><p className="mt-2 text-sm leading-relaxed text-muted-foreground">ProbePilot’s circuit board and virtual instrument are optimized for a viewport at least 1024 pixels wide.</p></div></div>
    <div className="hidden h-full min-h-0 flex-col overflow-hidden lg:flex">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <LeftPanel />
        <main className="flex min-w-0 flex-1 flex-col"><WorkspaceViewSwitcher value={workspaceView} onChange={setWorkspaceView}/>{workspaceView === WorkspaceView.Circuit && <><CircuitBoard /><Workbench /></>}{workspaceView === WorkspaceView.Pcb && <PcbPreview design={design} physical={physicalDesign}/>} {workspaceView === WorkspaceView.ThreeD && <AssemblyPreview design={design} physical={physicalDesign}/>}</main>
        <InspectorPanel />
      </div>
      <StatusBar />
    </div>
  </div>;
}
