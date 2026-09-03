import { AlertCircle, Check, LoaderCircle } from "lucide-react";
import { useSyncExternalStore } from "react";
import type { ProjectAutosave } from "@/projects/project-autosave";
import { ProjectSaveStatus } from "@/projects/project-types";

interface ProjectSaveIndicatorProps {
  readonly autosave: ProjectAutosave;
}

export function ProjectSaveIndicator({ autosave }: ProjectSaveIndicatorProps) {
  const status = useSyncExternalStore(
    (listener) => autosave.subscribe(listener),
    () => autosave.getStatus(),
    () => ProjectSaveStatus.Idle
  );
  if (status === ProjectSaveStatus.Saving) return <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><LoaderCircle className="h-3 w-3 animate-spin"/>Saving locally</span>;
  if (status === ProjectSaveStatus.Failed) return <span className="flex items-center gap-1.5 text-[10px] text-destructive"><AlertCircle className="h-3 w-3"/>Save failed</span>;
  if (status === ProjectSaveStatus.Saved) return <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><Check className="h-3 w-3 text-emerald-500"/>Saved locally</span>;
  return <span className="text-[10px] text-muted-foreground">Stored locally</span>;
}
