import { Box, CircuitBoard, Layers3 } from "lucide-react";
import { WorkspaceView } from "@/physical/physical-design";
import { cn } from "@/lib/utils";

interface WorkspaceViewSwitcherProps { readonly value: WorkspaceView; readonly onChange: (value: WorkspaceView) => void; }

export function WorkspaceViewSwitcher({ value, onChange }: WorkspaceViewSwitcherProps) {
  const views = [
    { value: WorkspaceView.Circuit, label: "Circuit", icon: CircuitBoard },
    { value: WorkspaceView.Pcb, label: "PCB Preview", icon: Layers3 },
    { value: WorkspaceView.ThreeD, label: "3D Preview", icon: Box }
  ];
  return <nav aria-label="Workspace view" className="flex h-10 shrink-0 items-center justify-center gap-1 border-b border-border bg-card/90 p-1">{views.map((view) => <button key={view.value} type="button" aria-pressed={value === view.value} onClick={() => onChange(view.value)} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs", value === view.value ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}><view.icon className="h-3.5 w-3.5"/>{view.label}</button>)}</nav>;
}
