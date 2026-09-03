import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from "react";
import type { CircuitDesign } from "@/domain/types";
import type { PhysicalDesign } from "@/physical/physical-design";
import { usePhysicalPreview } from "@/physical/use-physical-preview";
import type { PhysicalPreviewResult } from "@/tscircuit/physical-preview-adapter";

const LazyCadViewerScene = lazy(async () => {
  const module = await import("@/tscircuit/cad-viewer-scene");
  return { default: module.CadViewerScene };
});

const LazySimple3dFallback = lazy(async () => {
  const module = await import("@/features/simple-3d-fallback");
  return { default: module.Simple3dFallback };
});

interface AssemblyPreviewBoundaryProps {
  readonly children: ReactNode;
  readonly elements: PhysicalPreviewResult["elements"];
}
interface AssemblyPreviewBoundaryState { readonly failed: boolean; }

export class AssemblyPreviewBoundary extends Component<AssemblyPreviewBoundaryProps, AssemblyPreviewBoundaryState> {
  state: AssemblyPreviewBoundaryState = { failed: false };

  static getDerivedStateFromError(_error: Error): AssemblyPreviewBoundaryState {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // The visible fallback is sufficient; no private circuit payload is logged.
  }

  render(): ReactNode {
    return this.state.failed
      ? <Suspense fallback={<p role="status" className="p-4 text-sm text-muted-foreground">Loading simplified 3D fallback…</p>}><LazySimple3dFallback elements={this.props.elements}/></Suspense>
      : this.props.children;
  }
}

export function AssemblyPreview({ design, physical }: { readonly design: CircuitDesign; readonly physical: PhysicalDesign }) {
  const preview = usePhysicalPreview(design, physical);
  return <section aria-label="3D assembly preview" className="min-h-0 flex-1 overflow-hidden bg-background"><div className="border-b border-border px-4 py-2 text-xs text-muted-foreground">Interactive WebGL preview · generic packages · not fabrication-ready</div><AssemblyPreviewBoundary elements={preview.elements}><Suspense fallback={<p role="status" className="p-4 text-sm text-muted-foreground">Loading 3D preview…</p>}><LazyCadViewerScene elements={preview.elements}/></Suspense></AssemblyPreviewBoundary></section>;
}
