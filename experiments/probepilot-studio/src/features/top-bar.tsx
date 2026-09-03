import { Bot, Check, Copy, Download, FlaskConical, Home, RotateCcw, Trash2, Undo2, Redo2, Wrench } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ComponentCapability } from "@/components/component-capability";
import { ComponentDefinitionRegistry } from "@/components/component-definition-registry";
import { SimulationEngineId } from "@/simulation/simulation-engine";
import { SimulationRunStatus, useStudioStore } from "@/state/store";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/theme/theme-toggle";
import { ProjectFileTransfer } from "@/projects/project-file-transfer";
import { ProjectSaveIndicator } from "@/projects/project-save-indicator";
import { projectAutosave, projectRepository } from "@/projects/project-runtime";
import { DeleteProjectDialog } from "@/projects/delete-project-dialog";

const agentPrompt = "Build and simulate a 9 V switched red LED circuit with a 330-ohm resistor. Then help me diagnose the virtual bench without guessing: request the measurements you need, cite the evidence, and stage—but do not apply—the repair.";

export function TopBar() {
  const navigate = useNavigate();
  const projectId = useStudioStore((state) => state.projectId);
  const mode = useStudioStore((state) => state.mode);
  const name = useStudioStore((state) => state.projectName);
  const revision = useStudioStore((state) => state.design.revision);
  const components = useStudioStore((state) => state.design.components);
  const simulation = useStudioStore((state) => state.simulation);
  const simulatedRevision = useStudioStore((state) => state.simulatedRevision);
  const simulationStatus = useStudioStore((state) => state.simulationStatus);
  const executedEngineId = useStudioStore((state) => state.executedEngineId);
  const bench = useStudioStore((state) => state.bench);
  const webmcp = useStudioStore((state) => state.webmcpAvailable);
  const past = useStudioStore((state) => state.historyPast.length);
  const future = useStudioStore((state) => state.historyFuture.length);
  const rename = useStudioStore((state) => state.renameProject);
  const runSimulation = useStudioStore((state) => state.runSimulation);
  const startBench = useStudioStore((state) => state.startBench);
  const setMode = useStudioStore((state) => state.setMode);
  const discardBench = useStudioStore((state) => state.discardBench);
  const undo = useStudioStore((state) => state.undo);
  const redo = useStudioStore((state) => state.redo);
  const reset = useStudioStore((state) => state.resetDemo);
  const [copied, setCopied] = useState(false);
  const simulationPending = simulationStatus === SimulationRunStatus.Pending;
  const simulationSuperseded = simulationStatus === SimulationRunStatus.Superseded;
  const simulationBusy = simulationPending || simulationSuperseded;
  const benchReady = simulationStatus === SimulationRunStatus.Success &&
    executedEngineId === SimulationEngineId.Deterministic &&
    simulation &&
    simulatedRevision === revision &&
    simulation.status !== "fail";
  const unsupportedBenchComponents = Object.values(components).filter((component) =>
    !ComponentDefinitionRegistry.supports(component.kind, ComponentCapability.Bench)
  );
  let benchUnavailableReason: string | undefined;
  if (unsupportedBenchComponents.length > 0) {
    benchUnavailableReason = `Bench unavailable: ${unsupportedBenchComponents.map((component) => `${component.id}: ${ComponentDefinitionRegistry.get(component.kind).name} is not Bench-capable.`).join(" ")}`;
  } else if (simulationPending) {
    benchUnavailableReason = "Bench unavailable while simulation is running.";
  } else if (simulationSuperseded) {
    benchUnavailableReason = "Bench unavailable while a superseded simulation is finishing.";
  } else if (!benchReady) {
    benchUnavailableReason = `Run a non-failing deterministic simulation for revision ${revision} before starting Bench.`;
  }

  return (
    <header className="flex h-14 shrink-0 items-center border-b border-border bg-card/95 px-3 shadow-sm backdrop-blur">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Button variant="ghost" size="icon" asChild><Link to="/" aria-label="Open project launchpad"><Home className="h-4 w-4" /></Link></Button>
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary"><Wrench className="h-4 w-4" /></div>
        <div className="hidden text-sm font-bold tracking-tight sm:block">ProbePilot</div>
        <span className="text-muted-foreground">/</span>
        <input
          aria-label="Project name"
          defaultValue={name}
          key={name}
          onBlur={(event) => rename(event.currentTarget.value)}
          className="min-w-0 max-w-[230px] flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
        />
        <Badge variant="outline" className="hidden mono md:inline-flex">rev {revision}</Badge>
      </div>

      <div className="mx-3 hidden rounded-lg border border-border bg-background/60 p-1 lg:flex">
        <button
          type="button"
          onClick={() => { if (bench) { if (window.confirm("Discard this bench session and return to the design?")) discardBench({ actor: "human" }); } else { setMode("design"); } }}
          className={cn("rounded-md px-3 py-1.5 text-xs font-medium transition", mode === "design" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}
        >Design</button>
        <button
          type="button"
          disabled={Boolean(bench) || simulationBusy}
          aria-busy={simulationBusy}
          title={simulationPending ? "Simulation is running." : simulationSuperseded ? "A superseded simulation is finishing." : undefined}
          onClick={() => { if (!bench && !simulationBusy) void runSimulation({ actor: "human" }); }}
          className={cn("rounded-md px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-45", mode === "simulate" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}
        >{simulationPending ? "Simulating…" : simulationSuperseded ? "Finishing…" : "Simulate"}</button>
        <button
          type="button"
          disabled={Boolean(bench) || !benchReady || unsupportedBenchComponents.length > 0 || simulationBusy}
          title={benchUnavailableReason}
          onClick={() => startBench({ actor: "human" })}
          className={cn("rounded-md px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-35", mode === "bench" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}
        >Bench</button>
      </div>

      <div className="flex flex-1 items-center justify-end gap-1">
        <Button variant="ghost" size="icon" aria-label="Undo" disabled={!past || Boolean(bench)} onClick={undo}><Undo2 className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" aria-label="Redo" disabled={!future || Boolean(bench)} onClick={redo}><Redo2 className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" aria-label="Copy suggested agent prompt" onClick={async () => { await navigator.clipboard.writeText(agentPrompt); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }}>{copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}</Button>
        <Button variant="ghost" size="icon" aria-label="Export project" onClick={async () => { await projectAutosave.flush(); const project = projectRepository.get(projectId); if (project) ProjectFileTransfer.download(project, projectRepository.exportJson(project.id)); }}><Download className="h-4 w-4" /></Button>
        <DeleteProjectDialog projectName={name} onConfirm={() => { projectRepository.delete(projectId); navigate("/"); }} trigger={<Button variant="ghost" size="icon" aria-label="Delete project"><Trash2 className="h-4 w-4" /></Button>} />
        <ThemeToggle />
        <Button variant="ghost" size="icon" aria-label="Reset deterministic demo" onClick={() => { if (window.confirm("Reset the deterministic ProbePilot demo?")) reset(); }}><RotateCcw className="h-4 w-4" /></Button>
        <div className="ml-2 hidden items-center gap-2 rounded-md border border-border bg-background/60 px-2.5 py-1.5 xl:flex">
          <Bot className={cn("h-4 w-4", webmcp ? "text-primary" : "text-muted-foreground")} />
          <span className="text-[11px]">{webmcp ? "Site tools ready" : "Manual mode"}</span>
        </div>
        {mode === "bench" && <Badge variant="warning" className="ml-1"><FlaskConical className="mr-1 h-3 w-3" />BENCH</Badge>}
        <div className="ml-2 hidden xl:block"><ProjectSaveIndicator autosave={projectAutosave} /></div>
      </div>
    </header>
  );
}
