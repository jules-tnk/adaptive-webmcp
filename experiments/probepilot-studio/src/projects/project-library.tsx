import { ChevronDown, CircuitBoard, FileUp, FolderOpen, History, MoreHorizontal } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ProjectActions } from "@/projects/project-actions";
import { ProjectFileTransfer } from "@/projects/project-file-transfer";
import type { ProjectRepository } from "@/projects/project-repository";
import type { ProjectRecord } from "@/projects/project-types";
import { cn } from "@/lib/utils";

interface ProjectLibraryProps {
  readonly repository: ProjectRepository;
  readonly onOpen: (project: ProjectRecord) => void;
}

export function ProjectLibrary({ repository, onOpen }: ProjectLibraryProps) {
  const [projects, setProjects] = useState<ProjectRecord[]>(() => repository.list());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const refresh = (): void => setProjects(repository.list());

  const importFile = async (file: File): Promise<void> => {
    try {
      const project = repository.importJson(await ProjectFileTransfer.read(file));
      setError("");
      refresh();
      onOpen(project);
    } catch {
      setError("The file is not a valid ProbePilot project.");
    }
  };

  return (
    <section aria-label="Your projects" className="border-y border-border bg-card/55 py-14">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div><p className="panel-heading text-primary">LOCAL PROJECT LIBRARY</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Your projects</h2><p className="mt-2 max-w-2xl text-sm text-muted-foreground">ProbePilot saves circuit designs and their latest 100 activity entries in this browser.</p></div>
          <div>
            <input ref={inputRef} className="sr-only" aria-label="Import ProbePilot project" type="file" accept=".json,.probepilot.json,application/json" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void importFile(file); event.currentTarget.value = ""; }} />
            <Button variant="outline" onClick={() => inputRef.current?.click()}><FileUp className="h-4 w-4" />Import JSON</Button>
          </div>
        </div>
        {error && <div role="alert" className="mt-5 border-l-2 border-destructive bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}
        <div className="mt-8 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {projects.length === 0 && <div className="px-5 py-10 text-center"><FolderOpen className="mx-auto h-6 w-6 text-muted-foreground"/><p className="mt-3 text-sm font-medium">No saved projects yet.</p><p className="mt-1 text-xs text-muted-foreground">Start with the demo, create a blank circuit, or import a project file.</p></div>}
          {projects.map((project) => {
            const expanded = project.id === expandedId;
            return <div key={project.id}>
              <div className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <button type="button" aria-label={`Open ${project.name}`} className="min-w-0 text-left" onClick={() => onOpen(project)}>
                  <span className="block truncate text-sm font-semibold">{project.name}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground"><span className="flex items-center gap-1"><CircuitBoard className="h-3 w-3"/>{Object.keys(project.design.components).length} components · {Object.keys(project.design.wires).length} wires</span><span className="flex items-center gap-1"><History className="h-3 w-3"/>{project.activities.length} activities</span><span>Updated {new Date(project.updatedAt).toLocaleString()}</span></span>
                </button>
                <Button size="sm" variant="ghost" aria-label={`Manage ${project.name}`} aria-expanded={expanded} onClick={() => setExpandedId(expanded ? null : project.id)}><MoreHorizontal className="h-4 w-4"/><span className="hidden sm:inline">Manage</span><ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")}/></Button>
              </div>
              {expanded && <ProjectActions
                key={`${project.id}:${project.name}`}
                project={project}
                onRename={(name) => { repository.rename(project.id, name); refresh(); }}
                onDuplicate={() => { const duplicate = repository.duplicate(project.id); refresh(); onOpen(duplicate); }}
                onExport={() => ProjectFileTransfer.download(project, repository.exportJson(project.id))}
                onDelete={() => { repository.delete(project.id); setExpandedId(null); refresh(); }}
              />}
            </div>;
          })}
        </div>
      </div>
    </section>
  );
}
