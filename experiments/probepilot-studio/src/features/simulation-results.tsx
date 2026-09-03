import { AlertTriangle, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SimulationResult } from "@/domain/types";
import { SimulationAnalysisType, SimulationEngineId, type SimulationCompatibility } from "@/simulation/simulation-engine";
import { WaveformChart } from "@/features/waveform-chart";

interface SimulationResultsProps {
  readonly result: SimulationResult | null;
  readonly requestedEngineId: SimulationEngineId | null;
  readonly requestedAnalysisType: SimulationAnalysisType | null;
  readonly executedEngineId: SimulationEngineId | null;
  readonly durationMs: number | null;
  readonly warnings: readonly string[];
  readonly compatibility: SimulationCompatibility | null;
}

export function SimulationResults({ result, requestedEngineId, requestedAnalysisType, executedEngineId, durationMs, warnings, compatibility }: SimulationResultsProps) {
  const requested = requestedEngineId?.toUpperCase() ?? "AUTO";
  const executed = executedEngineId?.toUpperCase() ?? "NOT RUN";
  const analysis = requestedAnalysisType?.replaceAll("_", " ").toUpperCase() ?? "NOT RUN";
  const waveforms = result?.waveforms ?? [];
  const nodeVoltages = Object.entries(result?.nodeVoltages ?? {});
  const components = Object.entries(result?.components ?? {});
  const hasDetails = waveforms.length > 0 || nodeVoltages.length > 0 || components.length > 0 || (result?.issues.length ?? 0) > 0 || (compatibility?.blockers.length ?? 0) > 0;
  return <section aria-label="Simulation results" className={`shrink-0 overflow-auto border-t border-border bg-card/95 px-5 py-3 ${hasDetails ? "max-h-80 min-h-44" : "h-32"}`}>
    <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary"><Zap className="h-4 w-4"/></span><div className="min-w-0"><div className="flex items-center gap-2"><span className="panel-heading">Simulation result</span><Badge variant={result?.status === "pass" ? "success" : result?.status === "warning" ? "warning" : "destructive"}>{result?.status.toUpperCase() ?? "NOT RUN"}</Badge></div><p className="mt-1 truncate text-xs text-muted-foreground">{result?.summary ?? "Run a simulation to see electrical results."}</p></div><dl className="ml-auto flex gap-5 text-xs"><div><dt className="text-muted-foreground">Requested</dt><dd className="mono font-semibold">{requested}</dd></div><div><dt className="text-muted-foreground">Executed</dt><dd className="mono font-semibold">{executed}</dd></div><div><dt className="text-muted-foreground">Duration</dt><dd className="mono font-semibold">{durationMs === null ? "—" : `${durationMs} ms`}</dd></div></dl></div>
    <dl className="mt-3 flex gap-5 text-xs"><div><dt className="text-muted-foreground">Analysis</dt><dd className="mono font-semibold">{analysis}</dd></div></dl>
    {warnings.length > 0 && <div className="mt-3 flex gap-2 text-xs text-amber-600 dark:text-amber-300"><AlertTriangle className="h-4 w-4 shrink-0"/><ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}
    {compatibility && !compatibility.compatible && <div className="mt-3 text-xs text-destructive"><p className="font-semibold">Compatibility blockers</p><ul className="mt-1 list-disc pl-4">{compatibility.blockers.map((blocker) => <li key={`${blocker.componentId}:${blocker.reason}`}><span className="mono">{blocker.componentId}</span>: {blocker.reason}</li>)}</ul></div>}
    {result && result.issues.length > 0 && <div className="mt-3 text-xs"><p className="font-semibold">Diagnostics</p><ul className="mt-1 list-disc pl-4 text-muted-foreground">{result.issues.map((issue, index) => <li key={`${issue.code}:${index}`}>{issue.message}</li>)}</ul></div>}
    {(nodeVoltages.length > 0 || components.length > 0) && <div className="mt-4 grid gap-4 lg:grid-cols-2">
      {nodeVoltages.length > 0 && <table className="w-full text-left text-xs"><caption className="mb-2 text-left font-semibold">Node voltages</caption><thead className="text-muted-foreground"><tr><th>Terminal</th><th>Voltage</th></tr></thead><tbody>{nodeVoltages.map(([terminalId, voltage]) => <tr key={terminalId}><td className="mono py-1">{terminalId}</td><td className="mono py-1">{voltage.toPrecision(5)} V</td></tr>)}</tbody></table>}
      {components.length > 0 && <table className="w-full text-left text-xs"><caption className="mb-2 text-left font-semibold">Component readings</caption><thead className="text-muted-foreground"><tr><th>Component</th><th>Voltage</th><th>Current</th><th>State</th></tr></thead><tbody>{components.map(([componentId, reading]) => <tr key={componentId}><td className="mono py-1">{componentId}</td><td className="mono py-1">{reading.voltageDrop.toPrecision(5)} V</td><td className="mono py-1">{reading.currentAmps.toPrecision(5)} A</td><td className="py-1">{reading.state ?? "—"}</td></tr>)}</tbody></table>}
    </div>}
    {waveforms.length > 0 && <div className="mt-4 grid gap-4 lg:grid-cols-2">{waveforms.map((waveform) => <WaveformChart key={waveform.id} waveform={waveform}/>)}</div>}
  </section>;
}
