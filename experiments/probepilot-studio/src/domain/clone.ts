import type { CircuitDesign, PublicBenchSession } from "./types";

export function cloneDesign(design: CircuitDesign): CircuitDesign {
  return structuredClone(design);
}

export function cloneBench(bench: PublicBenchSession): PublicBenchSession {
  return structuredClone(bench);
}
