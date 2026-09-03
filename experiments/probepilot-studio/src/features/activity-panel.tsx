import { Bot, Cpu, UserRound } from "lucide-react";
import { useStudioStore } from "@/state/store";
import { cn } from "@/lib/utils";

export function ActivityPanel() {
  const events = useStudioStore((state) => state.activities);
  const setSelection = useStudioStore((state) => state.setSelection);
  return (
    <div className="space-y-2">
      {events.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
      {events.map((event) => {
        const Icon = event.actor === "agent" ? Bot : event.actor === "human" ? UserRound : Cpu;
        const selectable = event.affectedIds.find((id) => id.startsWith("w")) ?? event.affectedIds.find((id) => !id.includes(":"));
        return (
          <button
            key={event.id}
            type="button"
            className="flex w-full gap-3 rounded-lg border border-transparent p-2.5 text-left transition hover:border-border hover:bg-muted/40"
            onClick={() => { if (selectable) setSelection({ type: selectable.startsWith("w") ? "wire" : "component", id: selectable }); }}
          >
            <span className={cn("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border", event.actor === "agent" ? "border-primary/30 bg-primary/10 text-primary" : event.actor === "human" ? "border-violet-400/30 bg-violet-400/10 text-violet-300" : "border-border bg-muted text-muted-foreground")}><Icon className="h-3.5 w-3.5" /></span>
            <span className="min-w-0">
              <span className="block text-xs leading-relaxed">{event.summary}</span>
              <span className="mt-1 block mono text-[10px] uppercase tracking-wide text-muted-foreground">{event.actor} · {new Date(event.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
