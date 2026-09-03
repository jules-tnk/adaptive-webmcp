import { useMemo } from "react";
import type { CircuitDesign } from "@/domain/types";
import type { PhysicalDesign } from "@/physical/physical-design";
import { PhysicalPreviewAdapter, type PhysicalPreviewResult } from "@/tscircuit/physical-preview-adapter";

export function usePhysicalPreview(design: CircuitDesign, physical: PhysicalDesign): PhysicalPreviewResult {
  return useMemo(() => PhysicalPreviewAdapter.convert(design, physical), [design, physical]);
}
