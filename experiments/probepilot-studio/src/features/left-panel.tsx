import { AlertTriangle, CheckCircle2, CircuitBoard, FlaskConical, Info, LoaderCircle } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { ComponentPalette } from "./component-palette";
import { SimulationEngineId } from "@/simulation/simulation-engine";
import { SimulationRunStatus, useStudioStore } from "@/state/store";

export function LeftPanel() {
  const mode = useStudioStore((state) => state.mode);
  const design = useStudioStore((state) => state.design);
  const simulation = useStudioStore((state) => state.simulation);
  const simulationStatus = useStudioStore((state) => state.simulationStatus);
  const requestedEngineId = useStudioStore((state) => state.requestedEngineId);
  const executedEngineId = useStudioStore((state) => state.executedEngineId);
  const simulationDurationMs = useStudioStore((state) => state.simulationDurationMs);
  const simulationWarnings = useStudioStore((state) => state.simulationWarnings);
  const simulationCompatibility = useStudioStore((state) => state.simulationCompatibility);
  const bench = useStudioStore((state) => state.bench);
  const simulationPending = simulationStatus === SimulationRunStatus.Pending;
  const simulationSuperseded = simulationStatus === SimulationRunStatus.Superseded;
  const simulationBusy = simulationPending || simulationSuperseded;
  let requestedEngineLabel = "AUTO";
  if (requestedEngineId === SimulationEngineId.Spice) requestedEngineLabel = "SPICE";
  if (requestedEngineId === SimulationEngineId.Deterministic) requestedEngineLabel = "DETERMINISTIC";
  let executedEngineLabel = simulationBusy ? "PENDING" : "NOT RUN";
  if (executedEngineId === SimulationEngineId.Spice) executedEngineLabel = "SPICE";
  if (executedEngineId === SimulationEngineId.Deterministic) executedEngineLabel = "DETERMINISTIC";

  let statusLabel = simulation?.status.toUpperCase() ?? "NOT RUN";
  let statusVariant: BadgeProps["variant"] = "destructive";
  if (simulationPending) {
    statusLabel = "RUNNING";
    statusVariant = "warning";
  } else if (simulationSuperseded) {
    statusLabel = "SUPERSEDED";
    statusVariant = "warning";
  } else if (simulation?.status === "pass") {
    statusVariant = "success";
  } else if (simulation?.status === "warning") {
    statusVariant = "warning";
  }

  let panelIcon = <FlaskConical className="h-4 w-4 text-primary" />;
  let panelTitle = "Bench case";
  if (mode === "design") {
    panelIcon = <CircuitBoard className="h-4 w-4 text-primary" />;
    panelTitle = "Components";
  } else if (mode === "simulate") {
    panelIcon = simulationBusy
      ? <LoaderCircle className="h-4 w-4 animate-spin text-primary motion-reduce:animate-none" />
      : <CheckCircle2 className="h-4 w-4 text-primary" />;
    panelTitle = "Simulation";
  }

  return (
    <aside className="instrument-panel flex min-h-0 w-[258px] shrink-0 flex-col border-y-0 border-l-0">
      <div className="flex h-11 items-center gap-2 border-b border-border px-4">
        {panelIcon}
        <span className="text-sm font-semibold">{panelTitle}</span>
      </div>
      <div className={mode === "design" ? "min-h-0 flex-1 overflow-hidden" : "min-h-0 flex-1 overflow-y-auto p-4"}>
        {mode === "design" && <ComponentPalette />}
        {mode === "simulate" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-background/40 p-4" aria-live="polite">
              <div className="flex items-center justify-between"><span className="panel-heading">Result</span><Badge variant={statusVariant}>{statusLabel}</Badge></div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {simulationPending
                  ? requestedEngineId
                    ? `Simulation is running with a ${requestedEngineLabel} preference.`
                    : "Automatic engine selection is running for this revision."
                  : simulationSuperseded
                    ? "The superseded simulation is finishing before another run can start."
                  : simulation?.summary ?? "Run the simulator to inspect the intended circuit."}
              </p>
            </div>
            {(simulationStatus !== SimulationRunStatus.Idle || simulationDurationMs !== null) && (
              <dl className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <dt className="text-[11px] text-muted-foreground">Requested</dt>
                  <dd className="mono mt-1 text-xs font-semibold">{requestedEngineLabel}</dd>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <dt className="text-[11px] text-muted-foreground">Executed</dt>
                  <dd className="mono mt-1 text-xs font-semibold">{executedEngineLabel}</dd>
                </div>
                <div className="col-span-2 rounded-lg border border-border bg-muted/30 p-3">
                  <dt className="text-[11px] text-muted-foreground">Duration</dt>
                  <dd className="mono mt-1 text-xs font-semibold">{simulationDurationMs === null ? "—" : `${simulationDurationMs} ms`}</dd>
                </div>
              </dl>
            )}
            {simulationWarnings.length > 0 && (
              <section aria-label="Simulation warnings" className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                <h3 className="flex items-center gap-2 text-xs font-semibold"><AlertTriangle className="h-3.5 w-3.5 text-amber-400" />Warnings</h3>
                <ul className="mt-2 space-y-1 text-xs leading-relaxed text-muted-foreground">
                  {simulationWarnings.map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
              </section>
            )}
            {simulationCompatibility && !simulationCompatibility.compatible && simulationCompatibility.blockers.length > 0 && (
              <section aria-label="Simulation compatibility blockers" className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                <h3 className="flex items-center gap-2 text-xs font-semibold"><AlertTriangle className="h-3.5 w-3.5 text-red-400" />Compatibility blockers</h3>
                <ul className="mt-2 space-y-1 text-xs leading-relaxed text-muted-foreground">
                  {simulationCompatibility.blockers.map((blocker) => (
                    <li key={`${blocker.componentId}:${blocker.reason}`}>{blocker.componentId} · {blocker.reason}</li>
                  ))}
                </ul>
              </section>
            )}
            <section>
              <h3 className="panel-heading mb-2">Live components</h3>
              <div className="space-y-2">
                {Object.values(design.components).map((component) => {
                  const result = simulation?.components[component.id];
                  return <div key={component.id} className="rounded-md border border-border bg-muted/30 p-3"><div className="flex justify-between text-xs"><strong>{component.label}</strong><span className="mono text-muted-foreground">{result ? `${(result.currentAmps * 1000).toFixed(1)} mA` : "—"}</span></div><div className="mt-1 text-[11px] text-muted-foreground">Drop {result?.voltageDrop.toFixed(2) ?? "—"} V {result?.state ? `· ${result.state.toUpperCase()}` : ""}</div></div>;
                })}
              </div>
            </section>
          </div>
        )}
        {mode === "bench" && bench && (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Intended design passes</div>
              <p className="mt-2 text-xs text-muted-foreground">Revision {bench.sourceDesignRevision} is frozen for this bench session.</p>
            </div>
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-red-300"><AlertTriangle className="h-4 w-4" /> Bench mismatch</div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{bench.symptoms[0]?.message ?? "The repair has resolved the visible symptom."}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-border bg-muted/30 p-3"><div className="mono text-xl font-semibold">{bench.measurements.length}</div><div className="text-[11px] text-muted-foreground">Measurements</div></div>
              <div className="rounded-lg border border-border bg-muted/30 p-3"><div className="mono text-xl font-semibold">{bench.hypotheses.length}</div><div className="text-[11px] text-muted-foreground">Hypotheses</div></div>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground"><Info className="mr-1 inline h-3.5 w-3.5" />The hidden fault is not stored in page state and is never exposed through WebMCP.</div>
          </div>
        )}
      </div>
    </aside>
  );
}
