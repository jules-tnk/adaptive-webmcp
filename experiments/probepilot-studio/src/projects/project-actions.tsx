import { Copy, Download, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeleteProjectDialog } from "@/projects/delete-project-dialog";
import type { ProjectRecord } from "@/projects/project-types";

interface ProjectActionsProps {
  readonly project: ProjectRecord;
  readonly onRename: (name: string) => void;
  readonly onDuplicate: () => void;
  readonly onExport: () => void;
  readonly onDelete: () => void;
}

export function ProjectActions({ project, onRename, onDuplicate, onExport, onDelete }: ProjectActionsProps) {
  const [name, setName] = useState(project.name);
  return (
    <div className="grid gap-3 border-t border-border/70 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="flex gap-2">
        <Input aria-label="Project name" value={name} onChange={(event) => setName(event.currentTarget.value)} className="h-8" />
        <Button size="sm" variant="outline" aria-label="Save name" onClick={() => onRename(name)}><Save className="h-3.5 w-3.5" />Save</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onDuplicate}><Copy className="h-3.5 w-3.5" />Duplicate</Button>
        <Button size="sm" variant="outline" onClick={onExport}><Download className="h-3.5 w-3.5" />Export</Button>
        <DeleteProjectDialog projectName={project.name} onConfirm={onDelete} trigger={<Button size="sm" variant="destructive"><Trash2 className="h-3.5 w-3.5" />Delete</Button>} />
      </div>
    </div>
  );
}
