import { useEffect, useMemo, useState } from "react";
import { Bot, Gauge, Hand, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { allTestPoints, useStudioStore } from "@/state/store";
import { SimulationResults } from "@/features/simulation-results";

function StyledSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className="h-9 min-w-0 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring" />;
}

export function Workbench() {
  const mode = useStudioStore((state) => state.mode);
  const design = useStudioStore((state) => state.design);
  const simulation = useStudioStore((state) => state.simulation);
  const requestedEngineId = useStudioStore((state) => state.requestedEngineId);
  const requestedAnalysisType = useStudioStore((state) => state.requestedAnalysisType);
  const executedEngineId = useStudioStore((state) => state.executedEngineId);
  const simulationDurationMs = useStudioStore((state) => state.simulationDurationMs);
  const simulationWarnings = useStudioStore((state) => state.simulationWarnings);
  const simulationCompatibility = useStudioStore((state) => state.simulationCompatibility);
  const bench = useStudioStore((state) => state.bench);
  const complete = useStudioStore((state) => state.completeMeasurement);
  const points = useMemo(() => allTestPoints(bench?.sourceDesignSnapshot ?? design), [bench?.sourceDesignSnapshot, design]);
  const pending = bench?.pendingMeasurement;
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");

  useEffect(() => {
    if (pending) {
      setFirst(pending.firstTestPointId);
      setSecond(pending.secondTestPointId);
    }
  }, [pending?.id]);

  if (mode === "design") {
    return <div className="flex h-28 shrink-0 items-center justify-between border-t border-border bg-card/90 px-5"><div><div className="panel-heading">Agent collaboration</div><p className="mt-2 text-sm text-muted-foreground">Ask the browser agent to inspect, build, update, or simulate the same live circuit shown above.</p></div><div className="hidden max-w-xl rounded-lg border border-border bg-background/60 p-3 mono text-[11px] text-muted-foreground xl:block">studio_inspect · design_build_circuit · design_update_components · design_validate_and_simulate</div></div>;
  }

  if (mode === "simulate") {
    return <SimulationResults result={simulation} requestedEngineId={requestedEngineId} requestedAnalysisType={requestedAnalysisType} executedEngineId={executedEngineId} durationMs={simulationDurationMs} warnings={simulationWarnings} compatibility={simulationCompatibility} />;
  }

  if (!bench) return null;
  if (!pending) {
    const latest = bench.measurements.at(-1);
    return <div className="flex h-40 shrink-0 items-center border-t border-border bg-card/95 px-5"><div className="flex items-center gap-4"><span className="grid h-12 w-12 place-items-center rounded-xl border border-border bg-background text-primary"><Gauge className="h-6 w-6" /></span><div><div className="panel-heading">Virtual multimeter</div><p className="mt-2 text-sm text-muted-foreground">{latest ? `Last reading: ${latest.unit === "V" ? `${latest.value.toFixed(2)} V` : latest.unit}. The agent can now inspect the evidence and choose the next step.` : "Waiting for the agent to request a diagnostic measurement."}</p><div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Bot className="h-3.5 w-3.5" />The agent requests the test. <Hand className="ml-2 h-3.5 w-3.5" />The human takes it.</div></div></div></div>;
  }

  return (
    <div className="flex h-48 shrink-0 items-center gap-5 border-t border-primary/20 bg-card/95 px-5">
      <div className="grid h-28 w-44 shrink-0 place-items-center rounded-xl border border-border bg-[#05080c] shadow-inner">
        <div className="text-center"><div className="mb-1 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[.2em] text-muted-foreground"><Radio className="h-3 w-3" />{pending.mode === "dc_voltage" ? "DC voltage" : "Continuity"}</div><div className="mono text-3xl text-primary">READY</div><div className="mt-1 text-[10px] text-muted-foreground">Human input required</div></div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2"><Badge>AGENT REQUEST</Badge><span className="text-xs text-muted-foreground">{pending.purpose}</span></div>
        <div className="mt-4 grid grid-cols-[1fr_auto_1fr_auto] items-end gap-3">
          <label><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Black / first probe</span><StyledSelect value={first} onChange={(event) => setFirst(event.currentTarget.value)}>{points.map((point) => <option key={point.id} value={point.id}>{point.label}</option>)}</StyledSelect></label>
          <span className="pb-2 text-muted-foreground">→</span>
          <label><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Red / second probe</span><StyledSelect value={second} onChange={(event) => setSecond(event.currentTarget.value)}>{points.map((point) => <option key={point.id} value={point.id}>{point.label}</option>)}</StyledSelect></label>
          <Button disabled={!first || !second || first === second} onClick={() => complete({ firstTestPointId: first, secondTestPointId: second }, { actor: "human" })}><Gauge className="h-4 w-4" />Take measurement</Button>
        </div>
      </div>
    </div>
  );
}
