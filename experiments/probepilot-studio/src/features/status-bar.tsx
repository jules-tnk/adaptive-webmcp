import { Bot, Circle, ShieldCheck } from "lucide-react";
import { useStudioStore } from "@/state/store";

export function StatusBar() {
  const available = useStudioStore((item) => item.webmcpAvailable);
  const components = useStudioStore((item) => Object.keys(item.design.components).length);
  const wires = useStudioStore((item) => Object.keys(item.design.wires).length);
  const revision = useStudioStore((item) => item.design.revision);
  const mode = useStudioStore((item) => item.mode);
  return <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-border bg-card px-3 mono text-[10px] text-muted-foreground"><span className="flex items-center gap-1.5"><Circle className={`h-2 w-2 fill-current ${available ? "text-emerald-500 dark:text-emerald-400" : "text-slate-500"}`} />{available ? "WebMCP tools registered" : "Manual browser mode"}</span><span>{components} components</span><span>{wires} wires</span><span>revision {revision}</span><span className="ml-auto flex items-center gap-1.5"><ShieldCheck className="h-3 w-3" />Hidden bench state isolated</span><span className="flex items-center gap-1.5"><Bot className="h-3 w-3" />{mode}</span></footer>;
}
