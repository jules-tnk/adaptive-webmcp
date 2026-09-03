import { AlertTriangle, Bot, CheckCircle2, LockKeyhole, Trash2, UnlockKeyhole } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ComponentPropertyEditor } from "@/components/component-property-editor";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { componentCatalog } from "@/domain/catalog";
import { useStudioStore } from "@/state/store";
import { ActivityPanel } from "./activity-panel";
import { PhysicalInspector } from "./physical-inspector";
import { WorkspaceView } from "@/physical/physical-design";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[11px] font-medium text-muted-foreground">{label}</span>{children}</label>;
}

function ComponentInspector({ id }: { id: string }) {
  const component = useStudioStore((state) => state.design.components[id]);
  const update = useStudioStore((state) => state.updateComponent);
  const remove = useStudioStore((state) => state.removeElements);
  const mode = useStudioStore((state) => state.mode);
  const simulation = useStudioStore((state) => state.simulation?.components[id]);
  if (!component) return null;
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between"><div><div className="mono text-sm font-semibold">{component.label}</div><div className="text-xs text-muted-foreground">{componentCatalog[component.kind].name}</div></div><Badge variant={component.agentLocked ? "warning" : "outline"}>{component.agentLocked ? "Protected" : "Editable"}</Badge></div>
      {mode === "simulate" && simulation && <div className="grid grid-cols-2 gap-2"><div className="rounded-lg border border-border bg-muted/30 p-3"><div className="mono text-base">{simulation.voltageDrop.toFixed(2)} V</div><div className="text-[10px] text-muted-foreground">Voltage drop</div></div><div className="rounded-lg border border-border bg-muted/30 p-3"><div className="mono text-base">{(simulation.currentAmps * 1000).toFixed(1)} mA</div><div className="text-[10px] text-muted-foreground">Current</div></div></div>}
      {mode === "design" && <>
        <Field label="Label"><Input key={`${component.id}:${component.label}`} defaultValue={component.label} onBlur={(event) => update(component.id, { label: event.currentTarget.value }, { actor: "human" })} /></Field>
        <ComponentPropertyEditor component={component} onUpdateProperties={(properties) => update(component.id, { properties }, { actor: "human" })} />
        <div className="space-y-2 border-t border-border pt-4">
          <Button variant="outline" className="w-full justify-start" onClick={() => update(component.id, { agentLocked: !component.agentLocked }, { actor: "human" })}>{component.agentLocked ? <UnlockKeyhole className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}{component.agentLocked ? "Allow agent changes" : "Protect from agent"}</Button>
          <Button variant="destructive" className="w-full justify-start" onClick={() => remove([component.id], [], { actor: "human" })}><Trash2 className="h-4 w-4" />Delete component</Button>
        </div>
      </>}
    </div>
  );
}

function WireInspector({ id }: { id: string }) {
  const wire = useStudioStore((state) => state.design.wires[id]);
  const design = useStudioStore((state) => state.design);
  const mode = useStudioStore((state) => state.mode);
  const remove = useStudioStore((state) => state.removeElements);
  if (!wire) return null;
  return <div className="space-y-4"><div><div className="mono text-sm font-semibold">{wire.id}</div><div className="text-xs text-muted-foreground">Circuit wire</div></div><div className="rounded-lg border border-border bg-muted/30 p-3 text-xs"><p>{design.components[wire.a.componentId]?.label}.{wire.a.terminalId}</p><div className="my-2 h-px bg-border"/><p>{design.components[wire.b.componentId]?.label}.{wire.b.terminalId}</p></div>{mode === "design" && <Button variant="destructive" className="w-full" onClick={() => remove([], [wire.id], { actor: "human" })}><Trash2 className="h-4 w-4" />Delete wire</Button>}</div>;
}

function EmptyInspector() {
  const design = useStudioStore((state) => state.design);
  const simulation = useStudioStore((state) => state.simulation);
  return <div className="space-y-4"><div className="rounded-lg border border-border bg-muted/30 p-4"><p className="text-sm font-medium">Project summary</p><div className="mt-3 grid grid-cols-2 gap-2"><div><div className="mono text-xl">{Object.keys(design.components).length}</div><div className="text-[10px] text-muted-foreground">Components</div></div><div><div className="mono text-xl">{Object.keys(design.wires).length}</div><div className="text-[10px] text-muted-foreground">Wires</div></div></div></div><p className="text-xs leading-relaxed text-muted-foreground">Select a component or wire to inspect it. Terminal clicks create semantic connections in Design mode.</p>{simulation && <div className="rounded-lg border border-border p-3"><div className="flex items-center justify-between"><span className="text-xs">Latest simulation</span><Badge variant={simulation.status === "pass" ? "success" : simulation.status === "warning" ? "warning" : "destructive"}>{simulation.status}</Badge></div></div>}</div>;
}

function BenchInspector() {
  const bench = useStudioStore((state) => state.bench);
  const approve = useStudioStore((state) => state.approveRepair);
  const reject = useStudioStore((state) => state.rejectRepair);
  const verify = useStudioStore((state) => state.verifyBench);
  const [open, setOpen] = useState(false);
  if (!bench) return null;
  const repair = bench.stagedRepair;
  return <div className="space-y-5">
    <section><h3 className="panel-heading mb-2">Evidence</h3><div className="space-y-2">{bench.measurements.length === 0 && <p className="text-xs text-muted-foreground">No human measurements yet.</p>}{bench.measurements.map((item) => <div key={item.id} className="rounded-lg border border-border bg-muted/30 p-3"><div className="flex justify-between"><span className="mono text-xs font-semibold">{item.id}</span><span className="mono text-xs text-primary">{item.unit === "V" ? `${item.value.toFixed(2)} V` : item.unit}</span></div><p className="mt-1 text-[10px] text-muted-foreground">{item.firstTestPointId} → {item.secondTestPointId}</p></div>)}</div></section>
    <section><h3 className="panel-heading mb-2">Hypotheses</h3><div className="space-y-2">{bench.hypotheses.length === 0 && <p className="text-xs text-muted-foreground">The agent has not published a hypothesis.</p>}{bench.hypotheses.map((item) => <div key={`${item.targetType}:${item.targetId}`} className="rounded-lg border border-border bg-muted/30 p-3"><div className="flex justify-between"><strong className="text-xs">{item.targetId}</strong><span className="mono text-xs">{Math.round(item.confidence * 100)}%</span></div><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.explanation}</p></div>)}</div></section>
    <section><h3 className="panel-heading mb-2">Repair gate</h3>{!repair ? <div className="rounded-lg border border-border bg-muted/30 p-3"><div className="flex items-center gap-2 text-xs font-medium">{bench.measurements.length >= 2 ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <LockKeyhole className="h-4 w-4 text-amber-300" />}{bench.measurements.length >= 2 ? "Evidence requirement met" : `${bench.measurements.length}/2 measurements`}</div><p className="mt-2 text-[11px] text-muted-foreground">The agent can stage a proposal after two human-originated measurements.</p></div> : <div className="rounded-lg border border-primary/30 bg-primary/5 p-3"><div className="flex items-center gap-2 text-xs font-semibold text-primary"><Bot className="h-4 w-4" />Agent repair proposal</div><p className="mt-2 text-xs text-muted-foreground">{repair.action.replaceAll("_", " ")} · {repair.target.type === "wire" ? repair.target.wireId : repair.target.componentId}</p>{repair.status === "awaiting_human" && <Button size="sm" className="mt-3 w-full" onClick={() => setOpen(true)}>Review repair</Button>}{repair.status === "approved" && bench.status === "repair_applied" && <Button size="sm" className="mt-3 w-full" onClick={() => verify({ actor: "human" })}>Verify bench</Button>}</div>}</section>
    {bench.verification && <div className={`rounded-lg border p-4 ${bench.verification.result === "pass" ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}`}><div className="flex items-center gap-2 text-sm font-semibold">{bench.verification.result === "pass" ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <AlertTriangle className="h-4 w-4 text-red-300" />}{bench.verification.result === "pass" ? "Bench verified" : "Verification failed"}</div><p className="mt-2 text-xs text-muted-foreground">{bench.verification.summary}</p></div>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Review proposed repair</DialogTitle><DialogDescription>The agent can stage this change, but only you can apply it to the virtual bench.</DialogDescription></DialogHeader>{repair && <div className="space-y-4 text-sm"><div className="rounded-lg border border-border bg-muted/30 p-4"><div className="panel-heading">Target</div><p className="mt-1 mono">{repair.target.type === "wire" ? repair.target.wireId : repair.target.componentId}</p></div><div><div className="panel-heading">Action</div><p className="mt-1 capitalize">{repair.action.replaceAll("_", " ")}</p></div><div><div className="panel-heading">Evidence</div><p className="mt-1 mono text-xs">{repair.evidenceIds.join(", ")}</p></div><div><div className="panel-heading">Expected outcome</div><p className="mt-1 text-muted-foreground">{repair.expectedOutcome}</p></div></div>}<DialogFooter><Button variant="outline" onClick={() => { reject({ actor: "human" }); setOpen(false); }}>Reject</Button><Button onClick={() => { approve({ actor: "human" }); setOpen(false); }}>Approve and apply</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

export function InspectorPanel() {
  const selection = useStudioStore((state) => state.selection);
  const mode = useStudioStore((state) => state.mode);
  const workspaceView = useStudioStore((state) => state.workspaceView);
  return (
    <aside className="instrument-panel flex min-h-0 w-[338px] shrink-0 flex-col border-y-0 border-r-0">
      <Tabs defaultValue="inspector" className="flex min-h-0 flex-1 flex-col p-3">
        <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="inspector">Inspector</TabsTrigger><TabsTrigger value="activity">Activity</TabsTrigger></TabsList>
        <TabsContent value="inspector" className="min-h-0 flex-1 overflow-y-auto px-1 pb-4">{workspaceView !== WorkspaceView.Circuit ? <PhysicalInspector/> : mode === "bench" ? <BenchInspector /> : selection?.type === "component" ? <ComponentInspector id={selection.id} /> : selection?.type === "wire" ? <WireInspector id={selection.id} /> : <EmptyInspector />}</TabsContent>
        <TabsContent value="activity" className="min-h-0 flex-1 overflow-y-auto px-1 pb-4"><ActivityPanel /></TabsContent>
      </Tabs>
    </aside>
  );
}
