import type { ReactElement } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface DeleteProjectDialogProps {
  readonly projectName: string;
  readonly onConfirm: () => void;
  readonly trigger: ReactElement;
}

export function DeleteProjectDialog({ projectName, onConfirm, trigger }: DeleteProjectDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-destructive/10 text-destructive"><AlertTriangle className="h-5 w-5" /></div>
          <DialogTitle>Delete project?</DialogTitle>
          <DialogDescription>“{projectName}” will be removed from this browser. This action cannot be undone.</DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-border bg-muted/35 px-4 py-3 text-xs text-muted-foreground">Export the project first if you want to keep a portable copy.</div>
        <DialogFooter className="mt-2">
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <DialogClose asChild><Button variant="destructive" onClick={onConfirm}><Trash2 className="h-4 w-4" />Delete project</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
