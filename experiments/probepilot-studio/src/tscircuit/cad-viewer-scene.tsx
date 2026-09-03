import { LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { CadViewer } from "@tscircuit/3d-viewer";
import type { AnyCircuitElement } from "circuit-json";

enum CadViewerEngine {
  Jscad = "jscad"
}

enum CadViewerStorageKey {
  Engine = "cadViewerEngine"
}

interface CadViewerProps {
  readonly circuitJson: AnyCircuitElement[];
  readonly resolveStaticAsset: (modelUrl: string) => string;
  readonly clickToInteractEnabled: boolean;
  readonly autoRotateDisabled: boolean;
  readonly onCameraControllerReady: (controller: object) => void;
}

const TypedCadViewer = CadViewer as ComponentType<CadViewerProps>;

export class CadViewerAssetPolicy {
  static resolve(_modelUrl: string): string {
    return "";
  }
}

export function CadViewerScene({ elements }: { readonly elements: readonly AnyCircuitElement[] }) {
  const [configured, setConfigured] = useState(false);
  const [viewerReady, setViewerReady] = useState(false);
  const revealTimer = useRef<number | null>(null);

  useEffect(() => {
    window.localStorage.setItem(CadViewerStorageKey.Engine, CadViewerEngine.Jscad);
    setConfigured(true);
    return () => {
      if (revealTimer.current !== null) window.clearTimeout(revealTimer.current);
    };
  }, []);

  const handleControllerReady = useCallback((_controller: object): void => {
    if (revealTimer.current !== null) window.clearTimeout(revealTimer.current);
    revealTimer.current = window.setTimeout(() => setViewerReady(true), 900);
  }, []);

  return <div role="region" aria-label="Interactive 3D PCB viewer" className="relative h-full w-full overflow-hidden bg-slate-950">
    {configured && <TypedCadViewer circuitJson={[...elements]} resolveStaticAsset={CadViewerAssetPolicy.resolve} clickToInteractEnabled={false} autoRotateDisabled={true} onCameraControllerReady={handleControllerReady}/>}
    {!viewerReady && <div role="status" aria-live="polite" className="pointer-events-none absolute inset-0 z-50 grid place-items-center bg-slate-950 text-slate-100">
      <div className="text-center"><LoaderCircle className="mx-auto h-8 w-8 animate-spin text-cyan-400 motion-reduce:animate-none"/><p className="mt-3 text-sm font-semibold">Building 3D preview…</p><p className="mt-1 text-xs text-slate-400">Preparing the board and component geometry.</p></div>
    </div>}
  </div>;
}
