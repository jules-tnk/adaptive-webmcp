import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CircuitDesign } from "@/domain/types";
import { PhysicalPlacementMode, type PhysicalDesign } from "@/physical/physical-design";
import { usePhysicalPreview } from "@/physical/use-physical-preview";

export function PcbPreview({ design, physical }: { readonly design: CircuitDesign; readonly physical: PhysicalDesign }) {
  const [zoom, setZoom] = useState(1);
  const preview = usePhysicalPreview(design, physical);
  const source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(preview.svg)}`;
  const layoutLabel = physical.placementMode === PhysicalPlacementMode.Automatic ? "AUTO-LAYOUT PREVIEW" : "MANUAL PREVIEW";
  return <section aria-label="PCB preview" className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto bg-background p-12">
    <div className="absolute left-4 top-4 z-10 flex items-center gap-2"><Badge>{layoutLabel}</Badge><span className="mono text-xs text-muted-foreground">revision {design.revision}</span></div>
    <div className="absolute right-4 top-4 z-10 flex gap-1"><Button type="button" size="icon" variant="outline" aria-label="Zoom out PCB preview" onClick={() => setZoom((value) => Math.max(0.6, value - 0.2))}><Minus className="h-4 w-4"/></Button><Button type="button" size="icon" variant="outline" aria-label="Zoom in PCB preview" onClick={() => setZoom((value) => Math.min(2, value + 0.2))}><Plus className="h-4 w-4"/></Button></div>
    {preview.warnings.length > 0 && <div role="status" className="absolute bottom-4 left-4 z-10 max-w-md rounded-md border border-amber-500/30 bg-background/95 p-2 text-xs text-amber-700 dark:text-amber-300">{preview.warnings.join(" ")}</div>}
    {preview.svg ? <img src={source} alt={`PCB preview of ${design.name}`} className="max-h-full max-w-full origin-center transition-transform motion-reduce:transition-none" style={{ transform: `scale(${zoom})` }}/> : <p className="text-sm text-destructive">PCB preview unavailable.</p>}
  </section>;
}
