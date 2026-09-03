import { Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Simple3dAdapter, Simple3dAngle } from "@/tscircuit/simple-3d-adapter";
import type { PhysicalPreviewResult } from "@/tscircuit/physical-preview-adapter";

export function Simple3dFallback({ elements }: { readonly elements: PhysicalPreviewResult["elements"] }) {
  const [angle, setAngle] = useState(Simple3dAngle.Angle1);
  const [zoom, setZoom] = useState(1);
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setError("");
    void Simple3dAdapter.render(elements, angle).then((nextSvg) => {
      if (active) setSvg(nextSvg);
    }).catch(() => {
      if (active) {
        setSvg("");
        setError("The local 3D preview could not be rendered.");
      }
    });
    return () => { active = false; };
  }, [elements, angle]);
  return <div className="flex h-full flex-col"><div className="flex justify-center gap-2 p-2">{Object.values(Simple3dAngle).map((item) => <button type="button" key={item} aria-pressed={angle === item} onClick={() => setAngle(item)} className="rounded border border-border px-2 py-1 text-[10px]">{item}</button>)}<Button type="button" size="icon" variant="outline" aria-label="Zoom out 3D preview" onClick={() => setZoom((value) => Math.max(0.6, value - 0.2))}><Minus className="h-3.5 w-3.5"/></Button><Button type="button" size="icon" variant="outline" aria-label="Zoom in 3D preview" onClick={() => setZoom((value) => Math.min(2, value + 0.2))}><Plus className="h-3.5 w-3.5"/></Button></div>{error ? <p role="alert" className="p-4 text-sm text-destructive">{error}</p> : svg ? <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} alt="Simplified 3D assembly preview" className="min-h-0 flex-1 origin-center object-contain transition-transform motion-reduce:transition-none" style={{ transform: `scale(${zoom})` }}/> : <p role="status" className="p-4 text-sm text-muted-foreground">Rendering local 3D preview…</p>}</div>;
}
